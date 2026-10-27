"""Local manual PostgreSQL backup. No credentials are persisted or logged."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import threading
from datetime import datetime, timezone
import uuid

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

MAGIC = b'HTBACKUP1'
HEADER_SIZE = len(MAGIC) + 16 + 12
CHUNK = 1024 * 1024
CONFIG = Path(__file__).with_name('config.local.json')


def publish_without_overwrite(partial: Path, target: Path):
    if os.name == 'nt':
        # Windows rename fails if the destination exists; works on external drives too.
        os.rename(partial, target)
    else:
        os.link(partial, target)


def key_for(password: str, salt: bytes) -> bytes:
    return Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(password.encode('utf-8'))


def encrypt_file(source: Path, target: Path, password: str):
    salt, nonce = os.urandom(16), os.urandom(12)
    header = MAGIC + salt + nonce
    cipher = Cipher(algorithms.AES(key_for(password, salt)), modes.GCM(nonce)).encryptor()
    cipher.authenticate_additional_data(header)
    with source.open('rb') as src, target.open('xb') as dst:
        dst.write(header)
        while block := src.read(CHUNK):
            dst.write(cipher.update(block))
        dst.write(cipher.finalize())
        dst.write(cipher.tag)


def decrypt_file(source: Path, target: Path, password: str):
    """Only decrypt; never connect to a database or overwrite an existing file."""
    if target.exists():
        raise ValueError('El archivo de destino ya existe. Elegí otro nombre.')
    partial = target.with_name(target.name + '.' + uuid.uuid4().hex + '.partial')
    try:
        with source.open('rb') as src:
            header = src.read(HEADER_SIZE)
            size = source.stat().st_size
            if len(header) != HEADER_SIZE or not header.startswith(MAGIC) or size < HEADER_SIZE + 16:
                raise ValueError('No es una copia de HidroTrack válida.')
            src.seek(-16, 2)
            tag = src.read(16)
            src.seek(HEADER_SIZE)
            cipher = Cipher(algorithms.AES(key_for(password, header[len(MAGIC):len(MAGIC)+16])), modes.GCM(header[-12:], tag)).decryptor()
            cipher.authenticate_additional_data(header)
            remaining = size - HEADER_SIZE - 16
            with partial.open('xb') as dst:
                while remaining:
                    block = src.read(min(CHUNK, remaining))
                    if not block:
                        raise ValueError('Copia incompleta.')
                    dst.write(cipher.update(block))
                    remaining -= len(block)
                dst.write(cipher.finalize())
        # Publish only after authentication; never overwrite a race-created file.
        publish_without_overwrite(partial, target)
    finally:
        partial.unlink(missing_ok=True)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open('rb') as f:
        while block := f.read(CHUNK):
            result.update(block)
    return result.hexdigest()


def run_client(args: list[str], env: dict | None = None):
    try:
        result = subprocess.run(args, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=3600,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        raise RuntimeError('La operación superó una hora y se canceló. No hay copia nueva confirmada.') from None
    if result.returncode:
        raise RuntimeError('PostgreSQL no completó la operación. Revisá conexión, contraseña, permisos y versión del cliente. No hay copia nueva confirmada.')


def create_backup(settings: dict, db_password: str, backup_password: str) -> Path:
    pg_dump = Path(settings['pg_dump'])
    pg_restore = pg_dump.with_name('pg_restore.exe' if os.name == 'nt' else 'pg_restore')
    if not pg_dump.is_file() or not pg_restore.is_file():
        raise ValueError('Elegí pg_dump y verificá que pg_restore esté en la misma carpeta.')
    host, user = settings['host'].strip(), settings['user'].strip()
    if not host or not user or any(c in host + user for c in '\r\n\x00'):
        raise ValueError('Completá host y usuario de la conexión Session pooler de Supabase.')
    port = int(settings['port'])
    if not 1 <= port <= 65535:
        raise ValueError('Puerto inválido.')
    if not db_password or len(backup_password) < 12:
        raise ValueError('Ingresá la contraseña de base y una clave de copia de al menos 12 caracteres.')
    output = Path(settings['output']).expanduser().resolve()
    # Never put business data or archives anywhere inside this checkout.
    repo = Path(__file__).resolve().parent
    for ancestor in Path(__file__).resolve().parents:
        if (ancestor / 'AGENTS.md').is_file() and (ancestor / 'package.json').is_file():
            repo = ancestor
            break
    if output == repo or repo in output.parents:
        raise ValueError('Elegí una carpeta fuera del proyecto para guardar las copias.')
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d_%H-%M-%SZ')
    target = output / f'hidrotrack_{stamp}_{uuid.uuid4().hex[:8]}.htbackup'
    partial = target.with_suffix('.partial')
    # libpq environment avoids passwords in process arguments. Ignore inherited connection overrides.
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PG')}
    env.update(PGHOST=host, PGPORT=str(port), PGUSER=user, PGDATABASE='postgres', PGPASSWORD=db_password,
               PGSSLMODE='require', PGCONNECT_TIMEOUT='20', PGAPPNAME='hidrotrack-local-backup')
    try:
        # Temporary plaintext stays on the chosen backup drive, not the repo/system temp drive.
        with tempfile.TemporaryDirectory(prefix='.hidrotrack-work-', dir=output) as work:
            raw, verified = Path(work) / 'database.dump', Path(work) / 'verified.dump'
            run_client([str(pg_dump), '--no-password', '--format=custom', '--no-owner', '--no-privileges', '--file', str(raw)], env)
            if not raw.is_file() or raw.stat().st_size < 5:
                raise RuntimeError('La exportación está vacía. No hay copia confirmada.')
            run_client([str(pg_restore), '--list', str(raw)])
            encrypt_file(raw, partial, backup_password)
            decrypt_file(partial, verified, backup_password)
            if digest(raw) != digest(verified):
                raise RuntimeError('La verificación de la copia falló.')
        publish_without_overwrite(partial, target)
        return target
    finally:
        partial.unlink(missing_ok=True)
        env.pop('PGPASSWORD', None)


def main():
    import tkinter as tk
    from tkinter import ttk, filedialog, messagebox
    root = tk.Tk()
    root.title('HidroTrack · Copia de seguridad local')
    root.geometry('720x730')
    root.minsize(650, 680)
    root.configure(bg='#eaf7ff')
    style = ttk.Style()
    style.configure('TButton', padding=9)
    frame = ttk.Frame(root, padding=20)
    frame.pack(fill='both', expand=True)
    ttk.Label(frame, text='Respaldo nocturno de HidroTrack', font=('Segoe UI', 18, 'bold')).pack(anchor='w')
    ttk.Label(frame, text='Exporta la base sin modificarla. No incluye fotos/archivos de Storage,\nconfiguración de Auth, roles globales ni secretos de servicios.').pack(anchor='w', pady=10)
    try:
        config = json.loads(CONFIG.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        config = {}
    defaults = {'host':'', 'port':'5432', 'user':'', 'pg_dump':os.environ.get('HIDROTRACK_PG_DUMP') or shutil.which('pg_dump') or '',
                'output':str(Path.home() / 'HidroTrack-Backups')}
    if config.get('pg_dump') and not Path(config['pg_dump']).is_file():
        config.pop('pg_dump')  # A copied configuration must not keep another PC's obsolete executable path.
    variables = {key:tk.StringVar(value=config.get(key, default)) for key, default in defaults.items()}
    fields = ttk.Frame(frame)
    fields.pack(fill='x')
    fields.columnconfigure(1, weight=1)
    for row, (key, label) in enumerate([('host','Host (Session pooler)'), ('port','Puerto (Session, 5432)'), ('user','Usuario de PostgreSQL'), ('pg_dump','Archivo pg_dump.exe'), ('output','Carpeta de copias')]):
        ttk.Label(fields, text=label).grid(row=row, column=0, sticky='w', pady=5)
        ttk.Entry(fields, textvariable=variables[key]).grid(row=row, column=1, sticky='ew', padx=8)
        if key in ('pg_dump','output'):
            def choose(k=key):
                chosen = filedialog.askopenfilename(title='Seleccionar pg_dump.exe',filetypes=[('PostgreSQL','pg_dump.exe')]) if k=='pg_dump' else filedialog.askdirectory()
                if chosen:
                    variables[k].set(chosen)
            ttk.Button(fields, text='Elegir', command=choose).grid(row=row, column=2)
    passwords = [tk.StringVar() for _ in range(3)]
    for row, (label, variable) in enumerate(zip(['Contraseña de la base', 'Clave para cifrar la copia', 'Repetir clave de la copia'], passwords), start=5):
        ttk.Label(fields, text=label).grid(row=row, column=0, sticky='w', pady=7)
        ttk.Entry(fields, textvariable=variable, show='•').grid(row=row, column=1, columnspan=2, sticky='ew', padx=8)
    ttk.Label(frame, text='Las claves no se guardan. Conservá la clave de cada copia en un lugar seguro:\nsin ella no se puede recuperar, aunque tengas el archivo.').pack(anchor='w', pady=12)
    status = tk.StringVar(value='Sin copia confirmada en esta sesión.')
    ttk.Label(frame, textvariable=status, wraplength=650).pack(fill='x', pady=10)
    running = False
    def busy(value):
        nonlocal running
        running = value
        for button in buttons:
            button.configure(state='disabled' if value else 'normal')
    def done(path=None, error=None):
        busy(False)
        for var in passwords:
            var.set('')
        if error:
            status.set('No se confirmó una copia nueva. Las copias anteriores se conservan.')
            messagebox.showerror('No completado', error)
        else:
            status.set(f'Completado y verificado: {path}')
            messagebox.showinfo('Completado', f'Archivo verificado:\n{path}\n\nLa verificación no sustituye una prueba de restauración.')
    def start():
        if running:
            return
        settings = {k:v.get() for k,v in variables.items()}
        db_password, backup_password, repeat = [v.get() for v in passwords]
        if backup_password != repeat or len(backup_password) < 12:
            messagebox.showerror('Revisar clave', 'Repetí la misma clave de copia, con al menos 12 caracteres.')
            return
        try:
            CONFIG.write_text(json.dumps(settings, indent=2), encoding='utf-8')
        except OSError:
            messagebox.showerror('Configuración', 'No se pudo guardar la configuración local. Revisá permisos de la carpeta del programa.')
            return
        busy(True)
        status.set('Exportando y cifrando… Esperá la confirmación; no cierres la ventana.')
        def work():
            try:
                path = create_backup(settings, db_password, backup_password)
                root.after(0, lambda p=path:done(path=p))
            except Exception as exc:
                # Never display raw process errors or connection details.
                safe = str(exc) if isinstance(exc, (ValueError, RuntimeError)) else 'No se pudo guardar o verificar la copia. Revisá carpeta, espacio, conexión y dependencias.'
                root.after(0, lambda msg=safe:done(error=msg))
        threading.Thread(target=work, daemon=True).start()
    def unlock():
        if running:
            return
        from tkinter.simpledialog import askstring
        source = filedialog.askopenfilename(filetypes=[('Copia HidroTrack','*.htbackup')])
        if not source:
            return
        password = askstring('Clave de la copia','Clave usada al crear esta copia:', show='•')
        if not password:
            return
        target = filedialog.asksaveasfilename(defaultextension='.dump', initialfile='hidrotrack-recuperado.dump')
        if not target:
            return
        if not messagebox.askyesno('Descifrar archivo', 'Se creará un archivo .dump sin cifrar. No se restaurará ni modificará ninguna base. ¿Continuar?'):
            return
        busy(True)
        status.set('Descifrando y comprobando integridad…')
        def work():
            try:
                decrypt_file(Path(source), Path(target), password)
                root.after(0, lambda:done(path=target))
            except Exception:
                root.after(0, lambda:done(error='No se pudo descifrar: clave incorrecta, copia dañada o destino existente/no disponible.'))
        threading.Thread(target=work, daemon=True).start()
    buttons = [ttk.Button(frame, text='Crear copia ahora', command=start), ttk.Button(frame, text='Descifrar copia a archivo (sin restaurar)', command=unlock)]
    for button in buttons:
        button.pack(fill='x', pady=5)
    ttk.Label(frame, text='Manual: ejecutar cada noche con PC e Internet disponibles. No hay tarea\nautomática instalada ni borrado de copias antiguas. Guía: docs/BACKUP_LOCAL.md').pack(anchor='w', pady=12)
    root.protocol('WM_DELETE_WINDOW', lambda:messagebox.showinfo('En curso','Esperá a que finalice el respaldo.') if running else root.destroy())
    root.mainloop()


if __name__ == '__main__':
    main()
