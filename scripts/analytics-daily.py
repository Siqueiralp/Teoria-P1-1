"""Persist encrypted SQLite in a dedicated branch before acknowledging MQTT."""
import argparse
import base64
import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parents[1]
BRANCH = 'codex/analytics-data'
START, END = '<!-- analytics:start -->', '<!-- analytics:end -->'
spec = importlib.util.spec_from_file_location('fetcher', ROOT / 'scripts/fetch-analytics.py')
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


def git(folder, *args, allow_missing=False):
    result = subprocess.run(['git', '-C', str(folder), *args], capture_output=True, text=True, env=os.environ)
    if result.returncode and not (allow_missing and result.returncode == 2):
        raise OSError('Git operation failed; MQTT message must remain pending')
    return result.stdout.strip()


def auth(token):
    # Secrets stay in process environment, never command arguments or repository config.
    os.environ['GIT_CONFIG_COUNT'] = '1'
    os.environ['GIT_CONFIG_KEY_0'] = 'http.https://github.com/.extraheader'
    os.environ['GIT_CONFIG_VALUE_0'] = 'AUTHORIZATION: basic ' + base64.b64encode(('x-access-token:' + token).encode()).decode()
    os.environ['GIT_TERMINAL_PROMPT'] = '0'


def identity(folder):
    git(folder, 'config', 'user.name', 'github-actions[bot]')
    git(folder, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')


def open_history(folder, remote, cipher):
    folder.mkdir(parents=True, exist_ok=True)
    git(folder, 'init', '-b', BRANCH)
    identity(folder)
    git(folder, 'remote', 'add', 'origin', remote)
    found = git(folder, 'ls-remote', '--exit-code', 'origin', 'refs/heads/' + BRANCH, allow_missing=True)
    if found:
        git(folder, 'fetch', 'origin', 'refs/heads/' + BRANCH)
        git(folder, 'reset', '--hard', 'FETCH_HEAD')
        if not (folder / 'engagement.sqlite.enc').is_file() or not (folder / 'state.json').is_file():
            raise ValueError('Existing data branch incomplete; refusing to create empty replacement')
        data = cipher.decrypt((folder / 'engagement.sqlite.enc').read_bytes())
        state = json.loads((folder / 'state.json').read_text())
        if hashlib.sha256(data).hexdigest() != state['sha256']:
            raise ValueError('Snapshot checksum mismatch')
        path = folder.parent / 'working.sqlite'
        path.write_bytes(data)
        check = sqlite3.connect(f'file:{path.as_posix()}?mode=ro', uri=True)
        try:
            if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Invalid SQLite history')
            check.execute('SELECT id FROM events LIMIT 1')
        finally:
            check.close()
        return path
    path = folder.parent / 'working.sqlite'
    seed = ROOT / '.analytics' / 'engagement.sqlite'
    if seed.is_file():
        source, target = sqlite3.connect(f'file:{seed.as_posix()}?mode=ro', uri=True), sqlite3.connect(path)
        try:
            source.backup(target)
        finally:
            source.close()
            target.close()
    return path


def snapshot(db, folder, cipher):
    path = folder.parent / 'snapshot.sqlite'
    target = sqlite3.connect(path)
    try:
        db.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Invalid SQLite snapshot')
    finally:
        target.close()
    data = path.read_bytes()
    path.unlink()
    digest = hashlib.sha256(data).hexdigest()
    state_path = folder / 'state.json'
    if state_path.exists() and json.loads(state_path.read_text())['sha256'] == digest:
        return
    (folder / 'engagement.sqlite.enc').write_bytes(cipher.encrypt(data))
    state_path.write_text(json.dumps({'schema': 1, 'sha256': digest, 'updatedAt': datetime.now(timezone.utc).isoformat()}, indent=2) + '\n')
    (folder / 'README.md').write_text('# Encrypted analytics history\n\nDecrypt with the private ANALYTICS_DB_KEY. Never replace this branch with an empty database.\n')
    git(folder, 'add', 'engagement.sqlite.enc', 'state.json', 'README.md')
    git(folder, 'commit', '-m', 'Preserve encrypted engagement history')
    git(folder, 'push', 'origin', 'HEAD:refs/heads/' + BRANCH)
    local = git(folder, 'rev-parse', 'HEAD')
    remote = git(folder, 'ls-remote', '--exit-code', 'origin', 'refs/heads/' + BRANCH).split()[0]
    if remote != local:
        raise OSError('Snapshot push not verified')


def summary(db, status):
    data = fetcher.report(db, 30)
    total = db.execute('SELECT COUNT(*) FROM events').fetchone()[0]
    last = db.execute('SELECT MAX(collected_at) FROM events').fetchone()[0] or 'Nenhum evento coletado'
    views = sum(row['views'] for row in data['pages'])
    minutes = sum(row['active_seconds'] for row in data['pages']) / 60
    rows = [START, '## Uso do guia', '', status, '', f'Último evento coletado (UTC): {last}.', '',
            f'Histórico preservado: **{total} eventos**. Nos últimos 30 dias: **{views} visitas**, **{data["tab_sessions"]} sessões de abas**, **{minutes:.1f} minutos ativos**.', '',
            '| Página | Visitas | Minutos ativos | Ações nos gráficos |', '| --- | ---: | ---: | ---: |']
    for row in data['pages']:
        # Only valid slugs are rendered; no arbitrary telemetry becomes Markdown.
        label = row['subject'] + '/' + row['page']
        if not re.fullmatch(r'[a-z0-9/-]{1,161}', label):
            continue
        rows.append(f'| {label} | {row["views"]} | {row["active_seconds"] / 60:.1f} | {row["graph_actions"]} |')
    rows += ['', 'Sessões de abas não equivalem a pessoas únicas. IPs, IDs de sessões e eventos individuais ficam no banco criptografado da branch `codex/analytics-data`.', END]
    for field, title in [('browser', 'Navegadores'), ('os', 'Sistemas')]:
        values = [f'{name}: {count}' for name, count in data[field].items() if isinstance(name, str) and re.fullmatch(r'[a-zA-Z0-9]+', name)]
        if values:
            rows.insert(-2, f'{title} por visita: ' + ', '.join(values) + '.')
    return '\n'.join(rows)


def update_readme(db, status, remote):
    # A separate clone reads current main; it cannot commit runner secrets or plaintext DB.
    folder = ROOT / '.analytics' / 'readme'
    git(ROOT, 'clone', '--depth', '1', '--branch', 'main', remote, str(folder))
    identity(folder)
    path = folder / 'README.md'
    for attempt in range(3):
        text = path.read_text(encoding='utf-8')
        block = summary(db, status)
        if START in text and END in text:
            text = text[:text.index(START)] + block + text[text.index(END) + len(END):]
        else:
            first, rest = text.split('\n', 1)
            text = first + '\n\n' + block + '\n' + rest
        path.write_text(text, encoding='utf-8')
        if not git(folder, 'status', '--porcelain'):
            return
        git(folder, 'add', 'README.md')
        git(folder, 'commit', '-m', 'docs: update aggregated engagement metrics')
        try:
            git(folder, 'push', 'origin', 'HEAD:refs/heads/main')
            return
        except OSError:
            if attempt == 2:
                raise
            git(folder, 'fetch', 'origin', 'main')
            git(folder, 'reset', '--hard', 'origin/main')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--initialize-only', action='store_true')
    parser.add_argument('--decrypt', type=Path, help='Restore an encrypted snapshot locally; does not contact GitHub')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.decrypt:
        from dotenv import load_dotenv
        load_dotenv(ROOT / '.env', override=False)
        if not args.output or args.output.exists():
            raise ValueError('Choose a new output file; existing databases are never overwritten')
        content = Fernet(os.environ['ANALYTICS_DB_KEY'].encode()).decrypt(args.decrypt.read_bytes())
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as output:
            output.write(content)
        check = sqlite3.connect(f'file:{args.output.resolve().as_posix()}?mode=ro', uri=True)
        try:
            if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Restored snapshot invalid')
        finally:
            check.close()
        print('Snapshot restored to a new local SQLite file; existing database preserved.')
        return
    cipher = Fernet(os.environ['ANALYTICS_DB_KEY'].encode())
    auth(os.environ['GITHUB_TOKEN'])
    remote = 'https://github.com/' + os.environ['GITHUB_REPOSITORY'] + '.git'
    folder = ROOT / '.analytics' / 'daily' / 'history'
    path = open_history(folder, remote, cipher)
    db = fetcher.database(path)
    try:
        snapshot(db, folder, cipher)
        ready = all(os.environ.get(name) for name in ['HIVEMQ_USERNAME', 'HIVEMQ_PASSWORD'])
        if ready and not args.initialize_only:
            fetcher.collect(db, os.environ, drain=True, idle_seconds=15, durable_save=lambda db: snapshot(db, folder, cipher))
            status = 'Coleta diária concluída; lotes confirmados após preservar o banco no GitHub.'
        else:
            status = 'Aguardando configuração das credenciais MQTT; coleta ainda não ativada.'
        update_readme(db, status, remote)
        if not ready and not args.initialize_only:
            raise ValueError('MQTT secrets missing; persistent subscription not initialized')
    finally:
        db.close()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Daily fetch failed. History preserved; no unpersisted MQTT messages acknowledged. Check private credentials, encryption key and Git permissions.', file=sys.stderr)
        sys.exit(1)
