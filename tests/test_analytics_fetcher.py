import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location('fetcher', Path(__file__).resolve().parents[1] / 'scripts/fetch-analytics.py')
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


class FetcherTests(unittest.TestCase):
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
