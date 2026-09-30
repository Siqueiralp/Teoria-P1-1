import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from cryptography.fernet import Fernet, InvalidToken

spec = importlib.util.spec_from_file_location('daily', Path(__file__).resolve().parents[1] / 'scripts/analytics-daily.py')
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


class DailyTests(unittest.TestCase):
    def test_encrypted_history_roundtrip_deduplication_and_wrong_key_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            remote = root / 'remote.git'
            daily.git(root, 'init', '--bare', str(remote))
            cipher = Fernet(Fernet.generate_key())
            with patch.object(daily, 'ROOT', root):
                folder = root / 'first' / 'history'
                path = daily.open_history(folder, str(remote), cipher)
                db = daily.fetcher.database(path)
                batch = {'schema': 1, 'session': 'private-session', 'receivedAt': '2026-09-29T01:00:00Z', 'ip': '203.0.113.123',
                         'events': [{'id': '00000000-0000-4000-8000-000000000001', 'type': 'page_view', 'subject': 'potencia', 'page': 'buck'}]}
                try:
                    daily.fetcher.ingest(db, json.dumps(batch).encode())
                    daily.snapshot(db, folder, cipher)
                    self.assertNotIn(b'203.0.113.123', (folder / 'engagement.sqlite.enc').read_bytes())
                    previous = daily.git(folder, 'rev-parse', 'HEAD')
                    daily.snapshot(db, folder, cipher)
                    self.assertEqual(previous, daily.git(folder, 'rev-parse', 'HEAD'))
                finally:
                    db.close()
                restored = daily.open_history(root / 'second' / 'history', str(remote), cipher)
                db = daily.fetcher.database(restored)
                try:
                    self.assertEqual(db.execute('SELECT COUNT(*) FROM events').fetchone()[0], 1)
                    self.assertEqual(daily.fetcher.ingest(db, json.dumps(batch).encode()), 0)
                finally:
                    db.close()
                with self.assertRaises(InvalidToken):
                    daily.open_history(root / 'wrong' / 'history', str(remote), Fernet(Fernet.generate_key()))
                self.assertEqual(daily.git(folder, 'rev-parse', 'HEAD'), previous)


if __name__ == '__main__': unittest.main()
