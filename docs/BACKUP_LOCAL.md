# Copia nocturna manual de HidroTrack

Herramienta local: `tools/backup/Abrir backup.cmd`. Es independiente de la web y no modifica la base. No instala una tarea nocturna: hay que abrirla cada noche. PC encendida, Internet y conexión PostgreSQL disponibles.

## Preparacion automatica en otra PC

1. Llevar el ZIP HidroTrack-Backup-Autoinstalable a una PC **Windows 10/11 x64**. Extraer toda la carpeta en una ubicacion con permiso de escritura; no ejecutar dentro del ZIP/RAR ni copiar solamente el .cmd.
2. Abrir **Abrir backup.cmd**. Descarga Python 3.14 desde python.org, verifica firma de Python Software Foundation, instala por usuario con Tkinter/pip y crea un entorno privado para cryptography desde PyPI. No cambia PATH ni depende del Python de otra aplicacion.
3. Descarga el ZIP oficial de clientes PostgreSQL 18 publicado por EDB (enlace resuelto y limitado a su dominio oficial). Extrae solo pg_dump, pg_restore y DLLs de su carpeta bin; no instala ni inicia un servidor PostgreSQL. Primera descarga aproximadamente 400 MB. Las siguientes aperturas reutilizan las herramientas en `%LOCALAPPDATA%\HidroTrack-Backup`.
4. Si los clientes no arrancan por falta de runtime, descarga Visual C++ desde Microsoft, verifica su firma y pide elevacion mediante el permiso normal de Windows. Si se cancela o falla, no abre el backup como si estuviera listo. La preparacion requiere Internet, espacio y permisos de instalacion permitidos en esa PC.
5. Se abre la ventana con pg_dump ya elegido. En Supabase, proyecto HidroTrack ? **Connect ? Session pooler**, copiar host, puerto y usuario. Usar conexion de sesion, habitualmente puerto **5432**, no el pooler transaccional 6543. No confundir con URL de la web/API ni clave publica.
6. Tener la **contrasena PostgreSQL** de ese proyecto. No es la de Dario ni el token MCP. Ingresarla unicamente en la ventana. No resetearla si no es necesario: afectaria otras conexiones.
7. Elegir carpeta **fuera de la carpeta del programa/proyecto**, preferiblemente en disco con cifrado del sistema. Solo se recuerda configuracion no secreta en config.local.json; las claves no se guardan.

El paquete solo incluye codigo, requisitos e instrucciones: sin configuracion personal, copias, claves ni herramientas ya instaladas. La instalacion x64 no cubre ARM/Windows 32 bits. No crea una tarea programada. Puede revisarse el origen de descargas sin instalar con `powershell -NoProfile -File tools/backup/preparar-y-abrir.ps1 -CheckOnly` desde el repositorio.

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

26/10/2026: iniciador automatico verificado en modo consulta sin instalaciones ni base real: enlaces oficiales Python 3.14.10 y PostgreSQL 18.6 x64 disponibles. Pruebas de cifrado/backup ficticio y traslado de carpeta aprobadas. Instalacion integral en Windows limpio y permisos/UAC pendientes de comprobar en la PC destino.
