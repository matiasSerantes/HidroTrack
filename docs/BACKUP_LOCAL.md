# Copia nocturna manual de HidroTrack

Herramienta local: `tools/backup/Abrir backup.cmd`. Es independiente de la web y no modifica la base. No instala una tarea nocturna: hay que abrirla cada noche. PC encendida, Internet y conexión PostgreSQL disponibles.

## Preparación única

1. Python ya está disponible en esta PC. La ventana usa Tkinter y `cryptography`. Si falta la biblioteca, desde la raíz del proyecto ejecutar `python -m pip install -r tools/backup/requirements.txt`. No necesita Node ni arrancar la web.
2. Instalar las herramientas cliente de PostgreSQL desde [la distribución oficial para Windows](https://www.postgresql.org/download/windows/). Se necesitan `pg_dump.exe` y `pg_restore.exe` de la misma instalación. Usar una versión igual o más nueva que la versión principal del servidor. No hace falta crear una base local para exportar.
3. En Supabase, proyecto HidroTrack → **Connect → Session pooler**, copiar host, puerto y usuario. Usar conexión de sesión, habitualmente puerto **5432**, no el pooler transaccional 6543. No confundir estos datos con la URL de la web/API ni con la clave pública de Supabase.
4. Tener la **contraseña de PostgreSQL** de ese proyecto. No es la contraseña de Darío ni el token del MCP. Ingresarla únicamente en la ventana; no pegarla en Git, notas o capturas. No restablecerla si no es necesario: afectaría otras conexiones que la utilicen.
5. Abrir el `.cmd`, completar datos, elegir `pg_dump.exe` y una carpeta **fuera del proyecto**, preferiblemente en un disco con cifrado del sistema. Se recuerda únicamente esta configuración no secreta en `config.local.json`, ignorado por Git.

## Cada noche

1. Abrir **Abrir backup.cmd**.
2. Escribir la contraseña de PostgreSQL.
3. Elegir una **clave de la copia de al menos 12 caracteres** y repetirla. Puede reutilizarse una clave de respaldo robusta, guardada en un gestor de contraseñas separado del disco de copias. La herramienta no recuerda ninguna clave.
4. Tocar **Crear copia ahora** y esperar **Completado y verificado**. Si aparece error, no hay copia nueva confirmada; se conservan las anteriores.
5. Se genera `hidrotrack_FECHA_HORA-UTC_IDENTIFICADOR.htbackup`. No se reemplazan ni borran copias previas. Copiar el archivo cifrado también a otro disco o ubicación que controles; una única copia en la misma PC no protege ante falla o pérdida de esa PC. Guardar fuera del repositorio y verificar espacio periódicamente.

No cerrar la ventana durante el proceso. La aplicación no necesita permanecer abierta después de terminar. No hay programación automática ni borrado por antigüedad; podemos añadirlo después de validar la primera copia real.

## Qué incluye y cómo se comprueba

`pg_dump --format=custom` exporta esquema y datos de la base PostgreSQL accesibles a la conexión, incluidos clientes, stock, deudas, recorridos y tablas de Auth si los permisos lo permiten. Un fallo de permisos o versión cancela la copia. No se usa una exportación parcial por API ni un listado de la pantalla.

Antes de confirmar, `pg_restore --list` comprueba el archivo PostgreSQL. Luego se cifra con AES-256-GCM y clave derivada con scrypt y sal/nonce aleatorios; se descifra a un temporal y se comparan hashes SHA-256. Solo entonces se publica el archivo final. Una contraseña incorrecta o modificación del archivo impide publicar el descifrado. Esto comprueba el archivo, **no equivale a restaurarlo en una base y probar el programa**.

La exportación y la verificación requieren archivos temporales sin cifrar en la carpeta elegida; se retiran al terminar o fallar normalmente. Un apagado forzado puede dejar una carpeta `.hidrotrack-work-*`: tratarla como información sensible. Usar BitLocker/cifrado de disco para proteger estos temporales y no trabajar en carpetas compartidas. Los comandos no muestran contraseñas en argumentos ni imprimen registros del servidor; la contraseña DB se pasa solo al entorno del proceso hijo.

## Límites importantes

- No incluye los archivos físicos de **Supabase Storage** (fotos, logos, adjuntos); solo sus metadatos si son exportables. Storage requiere respaldo separado.
- No incluye configuración del panel/Auth/SMTP, Edge secrets, VAPID, configuración de cron externo, roles globales/contraseñas de roles ni claves raíz de cifrado de Supabase Vault. Los valores cifrados de Vault requieren su clave raíz y procedimiento específico para poder recuperarlos en otro proyecto. Código y migraciones están en Git; secretos deben custodiarse por separado.
- Se omiten propietario y privilegios globales en el dump. La recuperación de permisos, roles y esquemas administrados de Supabase requiere revisión técnica; no prometer una restauración directa con un botón en un proyecto nuevo.
- Se pierde lo registrado **después** de la última copia si no puede recuperarse del servidor. No es recuperación continua ni garantiza pérdida cero. Exportar la base consume transferencia y recursos del proyecto.
- La clave de la copia es imprescindible y permite descifrar desde otra PC con la misma herramienta. Si se pierde, no hay recuperación de ese archivo.

## Recuperación segura

1. Conservar el archivo original cifrado y su clave.
2. Usar **Descifrar copia a archivo (sin restaurar)** y elegir un nombre `.dump` nuevo; nunca sobrescribe un archivo existente. El resultado contiene información sensible sin cifrar.
3. No restaurar sobre producción para probar. Preparar un proyecto aislado, revisar versión, roles, extensiones, esquemas gestionados y claves de Vault antes de importar; seguir la [guía oficial de recuperación de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
4. Validar cantidades de registros, saldos, usuarios y permisos de acceso en ese entorno. Solo después definir el procedimiento de recuperación real. El programa local **no ejecuta restauraciones ni borra datos**.

## Estado

Herramienta preparada y comprobada con datos ficticios, cifrado/descifrado y fallos simulados. **Primera copia de producción y ensayo de restauración pendientes**: aún faltan los clientes PostgreSQL y configurar la conexión. No se cambió el plan de Supabase ni se verificaron sus respaldos administrados.

Fuentes: [backups de Supabase](https://supabase.com/docs/guides/platform/backups), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
