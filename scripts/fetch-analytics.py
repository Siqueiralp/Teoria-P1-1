"""Private MQTT collector and offline engagement report. Secrets stay in local .env."""
import argparse
import json
import os
import sqlite3
import ssl
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENT_TYPES = {"page_view", "active_time", "graph_play", "graph_channel", "graph_speed", "graph_seek", "solution_toggle", "formula_open", "goal_change"}


def database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, session TEXT, received_at TEXT, collected_at TEXT,
        subject TEXT, page TEXT, type TEXT, seconds INTEGER, value TEXT,
        ip TEXT, browser TEXT, os TEXT, device_class TEXT, language TEXT, viewport TEXT
    )""")
    return db


def ingest(db, payload):
    if len(payload) > 32768:
        raise ValueError("Oversized message")
    batch = json.loads(payload)
    if not isinstance(batch, dict) or batch.get("schema") != 1:
        raise ValueError("Unknown schema")
    events = batch.get("events")
    if not isinstance(events, list) or len(events) > 20:
        raise ValueError("Invalid batch")
    stamp = datetime.fromisoformat(batch["receivedAt"].replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        raise ValueError("UTC timestamp required")
    received = stamp.astimezone(timezone.utc).isoformat()
    collected = datetime.now(timezone.utc).isoformat()
    before = db.total_changes
    with db:
        for event in events:
            if event.get("type") not in EVENT_TYPES:
                continue
            fields = [event.get("id"), batch.get("session"), received, collected,
                      event.get("subject"), event.get("page"), event.get("type"),
                      event.get("seconds", 0), event.get("value"), batch.get("ip"),
                      batch.get("browser"), batch.get("os"), batch.get("deviceClass"),
                      batch.get("language"), batch.get("viewport")]
            if not isinstance(fields[0], str) or len(fields[0]) != 36:
                raise ValueError("Invalid event ID")
            if any(value is not None and not isinstance(value, (str, int)) for value in fields):
                raise ValueError("Invalid fields")
            if any(isinstance(value, str) and len(value) > 256 for value in fields):
                raise ValueError("Oversized field")
            db.execute("INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", fields)
    return db.total_changes - before


def report(db, days):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = db.execute("""SELECT subject, page,
        SUM(type='page_view'), SUM(CASE WHEN type='active_time' THEN seconds ELSE 0 END),
        SUM(type LIKE 'graph_%'), SUM(type='solution_toggle' AND value='open')
        FROM events WHERE received_at >= ? GROUP BY subject,page ORDER BY 3 DESC""", (since,)).fetchall()
    sessions = db.execute("SELECT COUNT(DISTINCT session) FROM events WHERE received_at >= ?", (since,)).fetchone()[0]
    result = {"since": since, "tab_sessions": sessions, "pages": [dict(zip(
        ["subject", "page", "views", "active_seconds", "graph_actions", "solutions_opened"], row)) for row in rows]}
    for column in ["browser", "os", "device_class", "language"]:
        result[column] = dict(db.execute(f"SELECT {column}, COUNT(*) FROM events WHERE type='page_view' AND received_at >= ? GROUP BY {column}", (since,)))
    return result


def collect(db, env):
    import paho.mqtt.client as mqtt
    host, username, password = (env.get(name) for name in ["HIVEMQ_HOST", "HIVEMQ_USERNAME", "HIVEMQ_PASSWORD"])
    if not all([host, username, password]):
        raise ValueError("Fill HIVEMQ_HOST, HIVEMQ_USERNAME and HIVEMQ_PASSWORD in local .env")
    topic = env.get("HIVEMQ_TOPIC", "study-guide/engagement/v1")
    if topic != "study-guide/engagement/v1":
        raise ValueError("Use the dedicated engagement topic")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="study-guide-fetcher", clean_session=False)
    client.username_pw_set(username, password)
    client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    client.reconnect_delay_set(min_delay=1, max_delay=60)

    def connected(client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            print("MQTT connection rejected. Check private credentials/permissions.", file=sys.stderr)
            return
        client.subscribe(topic, qos=1)
        print("Connected; listening for engagement events. Ctrl+C to stop.", flush=True)

    def subscribed(client, userdata, mid, reason_codes, properties):
        if any(code.is_failure for code in reason_codes):
            print("Subscription rejected: use a credential with Subscribe Only on the engagement topic.", file=sys.stderr)
        else:
            print("Subscription confirmed.", flush=True)

    def message(client, userdata, message):
        try:
            count = ingest(db, message.payload)
            print(f"Stored {count} new events.", flush=True)
        except (ValueError, KeyError, TypeError, sqlite3.Error):
            print("Invalid message discarded; payload omitted.", file=sys.stderr)

    client.on_connect, client.on_message, client.on_subscribe = connected, message, subscribed
    try:
        client.connect(host, int(env.get("HIVEMQ_PORT", "8883")), 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("Collector stopped.")
    finally:
        client.disconnect()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["collect", "report", "import"])
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--db")
    parser.add_argument("--input", help="JSON event batch for offline import/test")
    args = parser.parse_args()
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env", override=False)
    except ImportError:
        if args.command == "collect":
            raise ValueError("Install scripts/requirements-analytics.txt first")
    if not 1 <= args.days <= 365:
        raise ValueError("Choose 1 to 365 days")
    path = Path(args.db or os.getenv("ANALYTICS_DB", ".analytics/engagement.sqlite"))
    if not path.is_absolute():
        path = ROOT / path
    db = database(path)
    try:
        if args.command == "collect":
            collect(db, os.environ)
        elif args.command == "import":
            if not args.input:
                raise ValueError("Supply --input with a JSON batch")
            print(f"Stored {ingest(db, Path(args.input).read_bytes())} events.")
        else:
            print(json.dumps(report(db, args.days), ensure_ascii=False, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error):
        print("Collector unavailable. Check dependencies, private .env, database path and connection. No secret details logged.", file=sys.stderr)
        sys.exit(1)
