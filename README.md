# HidroTrack

Repositorio: https://github.com/matiasSerantes/HidroTrack.git

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
- Acceso con contraseña de Supabase preparado. Después del login se informa que el panel conectado sigue pendiente. No habilita el panel demo como si fueran datos reales.
- Migración inicial con titulares, membresías, licencias, auditoría automática de cambios de licencia, clientes, productos, programación y preferencias. Roles derivados de tablas protegidas, RLS y claves compuestas entre tablas comerciales.

## Supabase

Copiar `.env.example` a `.env` y completar la URL y clave pública de un proyecto propio. Nunca usar `service_role` en Vite. Aplicar `supabase/migrations/202610170001_foundation.sql` en un proyecto de prueba nuevo. No se aplicó a un servidor desde este repositorio.

Crear usuarios con Supabase Auth. El alta inicial de tenant, membresía owner, licencia y superadministrador se realiza desde un servidor o consola confiable, en una transacción. No hay autoasignación de roles. Elegir explícitamente el límite de choferes; no tiene valor por defecto. Los administradores pueden leer metadatos de titulares y administrar licencias, pero no acceden automáticamente a información comercial. Una licencia suspendida o vencida bloquea acceso comercial sin gracia implícita. La política definitiva de gracia sigue pendiente.

## Próximo trabajo

Conectar el panel al tenant de la sesión, completar administración segura de altas y límites de choferes, probar RLS contra Supabase local, sumar rutas/asignaciones y MapLibre. Luego implementar ventas/pagos transaccionales e idempotentes, inventario, cierres calculados en servidor e IndexedDB. Ninguna operación comercial de producción debe basarse en la lógica de la demo.

`npm test` ejecuta las pruebas de dominio y también la migración y los escenarios SQL en PostgreSQL embebido (PGlite). El entorno de prueba crea un contrato mínimo de `auth.users`, `auth.uid()` y roles; no sustituye la integración con Supabase Auth/PostgREST. La migración inicial pasó esta validación local; falta ejecutarla e inspeccionarla en el proyecto remoto. No hay cuentas de producción configuradas desde este repositorio.

La prueba `supabase/tests/isolation.sql` prepara fixtures y los revierte. Para ejecutarla manualmente usar únicamente Supabase local descartable: `psql "$DATABASE_URL" -f supabase/tests/isolation.sql`. Verifica lectura/escritura entre titulares, autoasignación de membresías, chofer sin asignaciones, privacidad comercial frente al superadmin, suspensión, expiración, relaciones compuestas, acceso anónimo y auditoría de licencias. Los flujos administrativos futuros necesitarán sus propias pruebas.
