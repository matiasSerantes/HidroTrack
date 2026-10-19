# HidroTrack

Repositorio: https://github.com/matiasSerantes/HidroTrack.git

## Demo completa para revisar el programa

Con `npm run dev`, abrir `http://127.0.0.1:5173/?demo=1`, elegir jefe o asistente y usar el código ficticio **123456**. También se puede entrar desde «Explorar demostración». Ver [guía y recorrido de prueba](docs/DEMO.md).

La nueva demo integra artículos/venta/alquiler, clientes y cuadra, recorridos asignables, atención y cobros, envases/stock, solicitudes/bajas, rendiciones, equipo, reportes y nombre/logo de empresa. Todos los datos se guardan en este navegador; el autenticador, mapa y seguimiento son simulaciones. No modifica Supabase. El acceso conectado anterior se conserva fuera de la demo.

Esta sección describe la demo integral agregada el 19/10/2026. Las secciones de alcance e integración siguientes describen la base previa y el trabajo de producción todavía pendiente.

## Plan de acción

Abrir `public/plan.html` directamente en el navegador o visitar `/plan.html` al ejecutar Vite. Incluye estado verificado, próximas entregas, seis etapas, criterios de aceptación, dependencias y decisiones pendientes. Los estados son un registro manual del desarrollo, no una consulta en vivo a Supabase.

## Cloudflare Pages

Conectar el repositorio con al menos un commit en `main`. Configuración: rama de producción `main`, directorio raíz del repositorio, comando de compilación `npm run build`, salida `dist`, Node.js 24 (`.node-version`). Sin Supabase configurado funciona el modo demo. Para habilitar el acceso real, configurar las variables públicas de `.env.example` en Cloudflare y volver a desplegar.

Base inicial para gestionar repartos independientes. React, TypeScript y Vite. Referencia visual conservada en `control_soderia_prototipo.html`; requisitos originales en `CODEX_CONTROL_SODERIA.md`.

## Ejecutar

Con Node.js 24 LTS o superior:

```powershell
npm ci
npm run dev
```

Abrir la dirección que informa Vite. `npm test` ejecuta las pruebas y `npm run build` verifica TypeScript y genera `dist/` para Cloudflare Pages.

En esta computadora también se puede ejecutar `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1`: usa Node portable de `.tools/`, sin instalación global. Las dependencias quedaron fijadas y el lockfile está incluido.

## Alcance actual

- Acceso de demostración explícito, independiente de Supabase.
- Clientes, días habituales, búsqueda, orden manual de visitas y apertura de búsqueda externa de direcciones.
- Entregas demo con precio fijo, envases recuperados, pagos parciales, efectivo, transferencia y saldo pendiente. Importes en centavos enteros; no se pueden reabrir entregas.
- Persistencia local únicamente para datos ficticios. No representa sincronización offline de producción.
- Resumen calculado de jornada; no simula envío ni aprobación de un cierre real.
- Acceso con contraseña de Supabase y recuperación de sesión. Panel conectado del titular con consulta de membresía/licencia, listado, búsqueda, alta y archivo de clientes; archivo lógico mediante `active=false`. Choferes y cuentas sin titular asignado reciben un estado explícito. Suspensión o vencimiento impiden cargar clientes desde la interfaz; RLS sigue siendo la autoridad en el servidor.
- Esta integración está probada con un cliente Supabase simulado, pero falta validarla contra Auth/PostgREST y la base remota. El panel requiere migración aplicada, usuario, membresía owner y licencia válidos, además de URL y clave pública en el entorno.
- Migración inicial con titulares, membresías, licencias, auditoría automática de cambios de licencia, clientes, productos, programación y preferencias. Roles derivados de tablas protegidas, RLS y claves compuestas entre tablas comerciales.

## Supabase

Copiar `.env.example` a `.env` y completar la URL y clave pública de un proyecto propio. Nunca usar `service_role` en Vite. Las migraciones de `supabase/migrations` coinciden con el historial remoto: foundation, admin_portal, inventory y owned_inventory. En un proyecto nuevo se aplican en orden; no volver a ejecutar foundation sobre HidroTrack. La base de stock se aplicó mediante MCP el 19/10/2026. Ver [modelo y funciones de stock](docs/STOCK.md). El acceso real del jefe incluye Stock y surtidores; requiere membresía owner y licencia. La demostración mantiene datos locales.

Crear usuarios con Supabase Auth. El alta inicial de tenant, membresía owner, licencia y superadministrador se realiza desde un servidor o consola confiable, en una transacción. No hay autoasignación de roles. Elegir explícitamente el límite de choferes; no tiene valor por defecto. Los administradores pueden leer metadatos de titulares y administrar licencias, pero no acceden automáticamente a información comercial. Una licencia suspendida o vencida bloquea acceso comercial sin gracia implícita. La política definitiva de gracia sigue pendiente.

## Próximo trabajo

Validar el panel conectado contra el proyecto Supabase, completar administración segura de altas y límites de choferes, sumar productos, rutas/asignaciones y MapLibre. La base transaccional de stock ya está aplicada. Catálogo, ingreso, recarga, carga y regreso ya tienen pantalla real del jefe. Provisionar una cuenta y validar el flujo con Auth/PostgREST; después conectar ventas del chofer. Completar ventas/pagos, diferencias de rendición e IndexedDB. Ninguna operación comercial de producción debe basarse en la lógica de la demo.

`npm test` ejecuta las pruebas de dominio y también la migración y los escenarios SQL en PostgreSQL embebido (PGlite). El entorno de prueba crea un contrato mínimo de `auth.users`, `auth.uid()` y roles; no sustituye la integración con Supabase Auth/PostgREST. Las cuatro migraciones pasan la validación local; la base de stock y sus permisos también se inspeccionaron en el proyecto remoto. No hay cuentas de producción configuradas desde este repositorio.

La prueba `supabase/tests/isolation.sql` prepara fixtures y los revierte. Para ejecutarla manualmente usar únicamente Supabase local descartable: `psql "$DATABASE_URL" -f supabase/tests/isolation.sql`. Verifica lectura/escritura entre titulares, autoasignación de membresías, chofer sin asignaciones, privacidad comercial frente al superadmin, suspensión, expiración, relaciones compuestas, acceso anónimo y auditoría de licencias. Los flujos administrativos futuros necesitarán sus propias pruebas.

## Notas y estado verificado

Los [requisitos funcionales](docs/REQUISITOS.md) reúnen los pedidos de artículos, alquileres, equipo, recorridos, cobros, stock y aprobaciones, con criterios de aceptación y decisiones pendientes.

Consultar [notas de trabajo](docs/NOTAS.md) y [revisión remota de Supabase del 19/10/2026](docs/REVISION_SUPABASE_2026-10-19.md). La inspección remota ya se realizó; las referencias anteriores a validación pendiente siguen aplicando a las pruebas completas de Auth/PostgREST y de la aplicación. Los acuerdos de continuidad están en AGENTS.md.

Para preparar la carga de Darío, ver [datos y plantillas de inventario inicial](docs/DATOS_INICIALES.md). No incluir datos reales de clientes, correos ni inventarios privados en commits.
