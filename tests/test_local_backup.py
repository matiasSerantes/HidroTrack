"""Offline tests: no production database, credentials or business data."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('local_backup', Path(__file__).resolve().parents[1] / 'tools/backup/backup_app.py')
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)


class BackupTests(unittest.TestCase):
    def test_portable_encryption_roundtrip_and_wrong_password(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source, encrypted, restored = [folder / name for name in ('raw.dump', 'copy.htbackup', 'restored.dump')]
            source.write_bytes(b'PGDMP' + b'fictional stock\n' * 100000)
            app.encrypt_file(source, encrypted, 'fictional-password')
            self.assertNotIn(b'fictional stock', encrypted.read_bytes())
            with self.assertRaises(Exception):
                app.decrypt_file(encrypted, restored, 'wrong-password')
            self.assertFalse(restored.exists())
            self.assertEqual(list(folder.glob('*.partial')), [])
            app.decrypt_file(encrypted, restored, 'fictional-password')
            self.assertEqual(app.digest(source), app.digest(restored))
            with self.assertRaises(ValueError):
                app.decrypt_file(encrypted, restored, 'fictional-password')

    def test_tampered_archive_does_not_publish_plaintext(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source, encrypted, restored = [folder / n for n in ('raw.dump', 'copy.htbackup', 'out.dump')]
            source.write_bytes(b'fictional backup')
            app.encrypt_file(source, encrypted, 'fictional-password')
            damaged = bytearray(encrypted.read_bytes())
            damaged[-17] ^= 1
            encrypted.write_bytes(damaged)
            with self.assertRaises(Exception):
                app.decrypt_file(encrypted, restored, 'fictional-password')
            self.assertFalse(restored.exists())

    def test_dump_uses_password_only_in_child_environment_and_verifies_before_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            executable = folder / ('pg_dump.exe' if app.os.name == 'nt' else 'pg_dump')
            executable.touch()
            executable.with_name('pg_restore.exe' if app.os.name == 'nt' else 'pg_restore').touch()
            settings = dict(pg_dump=str(executable), host='fictional.pooler.supabase.com', user='postgres.fictional', port='5432', output=str(folder / 'copies'))
            def fake_client(args, env=None):
                if '--file' in args:
                    self.assertNotIn('fake-db-password', ' '.join(args))
                    self.assertEqual(env['PGPASSWORD'], 'fake-db-password')
                    self.assertEqual(env['PGSSLMODE'], 'require')
                    Path(args[args.index('--file') + 1]).write_bytes(b'PGDMP fictional export')
                else:
                    self.assertIn('--list', args)
            with patch.object(app, 'run_client', side_effect=fake_client) as runner:
                result = app.create_backup(settings, 'fake-db-password', 'fictional-password')
                self.assertEqual(runner.call_count, 2)
            self.assertTrue(result.exists())
            self.assertEqual(list(result.parent.glob('*.partial')), [])
            self.assertEqual(list(result.parent.glob('.hidrotrack-work-*')), [])
            with patch.object(app, 'run_client', side_effect=RuntimeError('Simulated connection failure')):
                with self.assertRaises(RuntimeError):
                    app.create_backup(settings, 'fake-db-password', 'fictional-password')
            self.assertTrue(result.exists())
            self.assertEqual(len(list(result.parent.glob('*.htbackup'))), 1)


if __name__ == '__main__':
    unittest.main()
