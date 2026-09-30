import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('fetcher', Path(__file__).resolve().parents[1] / 'scripts/fetch-analytics.py')
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


class FetcherTests(unittest.TestCase):
    def test_mqtt_confirms_only_after_sqlite_commit_and_preserves_session(self):
        import paho.mqtt.client as mqtt
        with tempfile.TemporaryDirectory() as folder:
            db = fetcher.database(Path(folder) / 'events.sqlite')
            batch = {'schema': 1, 'session': 'test', 'receivedAt': datetime.now(timezone.utc).isoformat(),
                     'events': [{'id': '00000000-0000-4000-8000-000000000001', 'type': 'page_view'}]}
            calls = []

            class Client:
                def __init__(self, *args, **kwargs):
                    calls.append(('init', kwargs))
                    self.first = True
                def username_pw_set(self, *args): pass
                def tls_set(self, **kwargs): pass
                def reconnect_delay_set(self, **kwargs): pass
                def connect(self, *args, **kwargs): calls.append(('connect', kwargs))
                def subscribe(self, topic, qos): calls.append(('subscribe', qos))
                def ack(self, mid, qos):
                    self_count = db.execute('SELECT COUNT(*) FROM events').fetchone()[0]
                    calls.append(('ack_after_commit', self_count))
                    return mqtt.MQTT_ERR_SUCCESS
                def disconnect(self): calls.append(('disconnect', True))
                def loop(self, **kwargs):
                    if not self.first: raise KeyboardInterrupt
                    self.first = False
                    self.on_connect(self, None, SimpleNamespace(session_present=True), SimpleNamespace(is_failure=False), None)
                    self.on_subscribe(self, None, 1, [SimpleNamespace(is_failure=False)], None)
                    self.on_message(self, None, SimpleNamespace(payload=json.dumps(batch).encode(), mid=1, qos=1))
                    return mqtt.MQTT_ERR_SUCCESS

            try:
                with patch.object(mqtt, 'Client', Client):
                    fetcher.collect(db, {'HIVEMQ_HOST': 'test', 'HIVEMQ_USERNAME': 'test', 'HIVEMQ_PASSWORD': 'test'}, durable_save=lambda db: calls.append(('durable_push', True)))
                self.assertTrue(dict(calls)['init']['manual_ack'])
                self.assertFalse(dict(calls)['connect']['clean_start'])
                self.assertEqual(dict(calls)['connect']['properties'].SessionExpiryInterval, 604800)
                self.assertEqual(dict(calls)['ack_after_commit'], 1)
                self.assertLess([name for name, _ in calls].index('durable_push'), [name for name, _ in calls].index('ack_after_commit'))
                calls.clear()
                def fail_push(db): raise OSError('Push failed')
                with patch.object(mqtt, 'Client', Client), self.assertRaises(ValueError):
                    fetcher.collect(db, {'HIVEMQ_HOST': 'test', 'HIVEMQ_USERNAME': 'test', 'HIVEMQ_PASSWORD': 'test'}, durable_save=fail_push)
                self.assertNotIn('ack_after_commit', dict(calls))
            finally:
                db.close()

    def test_repeated_delivery_is_deduplicated_and_summary_omits_ips(self):
        with tempfile.TemporaryDirectory() as folder:
            db = fetcher.database(Path(folder) / 'events.sqlite')
            batch = {'schema': 1, 'session': 'test-session', 'receivedAt': datetime.now(timezone.utc).isoformat(),
                     'ip': '203.0.113.1', 'browser': 'Firefox', 'os': 'Windows',
                     'events': [{'id': '00000000-0000-4000-8000-000000000001', 'type': 'page_view', 'subject': 'eletronica-potencia', 'page': 'revisao'},
                                {'id': '00000000-0000-4000-8000-000000000002', 'type': 'active_time', 'subject': 'eletronica-potencia', 'page': 'revisao', 'seconds': 30}]}
            try:
                data = json.dumps(batch).encode()
                self.assertEqual(fetcher.ingest(db, data), 2)
                self.assertEqual(fetcher.ingest(db, data), 0)
                summary = fetcher.report(db, 30)
                self.assertEqual(summary['pages'][0]['views'], 1)
                self.assertEqual(summary['pages'][0]['active_seconds'], 30)
                self.assertNotIn('203.0.113.1', json.dumps(summary))
                self.assertEqual(summary['tab_sessions'], 1)
                self.assertEqual(db.execute('SELECT ip FROM events LIMIT 1').fetchone()[0], '203.0.113.1')
            finally:
                db.close()

    def test_invalid_batch_does_not_partially_persist(self):
        with tempfile.TemporaryDirectory() as folder:
            db = fetcher.database(Path(folder) / 'events.sqlite')
            batch = {'schema': 1, 'session': 'test', 'receivedAt': datetime.now(timezone.utc).isoformat(),
                     'events': [{'id': '00000000-0000-4000-8000-000000000001', 'type': 'page_view'}, {'id': 'invalid', 'type': 'page_view'}]}
            try:
                with self.assertRaises(ValueError):
                    fetcher.ingest(db, json.dumps(batch).encode())
                self.assertEqual(db.execute('SELECT COUNT(*) FROM events').fetchone()[0], 0)
            finally:
                db.close()


if __name__ == '__main__':
    unittest.main()
