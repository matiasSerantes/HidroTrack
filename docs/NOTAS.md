# Notas de trabajo de HidroTrack

## Acuerdos vigentes

- 2026-10-19: el usuario pidió mantener notas de ideas y trabajo realizado, y hacer commits y push de los avances terminados.
- Registrar propuestas como ideas hasta que se decida implementarlas. No guardar secretos ni datos personales en este documento.

## 2026-10-19 — Revisión remota de Supabase

Se logró acceder al proyecto mediante el MCP de Supabase usando su autenticación OAuth existente. Se consultaron tablas, migraciones, asesores de seguridad/rendimiento, políticas RLS, funciones, restricciones, índices, triggers y conteos agregados. No se modificó la base.

Resultados:

- Nueve tablas públicas, todas con RLS activado.
- Un administrador registrado. Sin repartos, membresías, licencias, clientes, productos, horarios, preferencias ni eventos de licencia.
- Dos migraciones remotas: `foundation` y `admin_portal`. El repositorio solo contiene la migración inicial y su identificador difiere del remoto.
- Protección de contraseñas filtradas desactivada, cuatro claves foráneas sin índice de cobertura y dos políticas RLS con evaluación de identidad por fila.
- Las funciones públicas administrativas inspeccionadas verifican permisos; los avisos automáticos de SECURITY DEFINER no demuestran por sí solos una exposición.
- Acceso comercial de choferes pendiente por diseño de esta etapa.

Ver [informe completo](REVISION_SUPABASE_2026-10-19.md). No se probaron flujos reales de Auth/PostgREST ni escrituras con distintos usuarios; la inspección no equivale a validar la aplicación de punta a punta.

## Ideas y próximos pasos propuestos

- Reconciliar el historial remoto y local y versionar la migración administrativa antes de nuevos cambios de esquema.
- Preparar y revisar una migración con los cuatro índices faltantes y la optimización de las dos políticas.
- Evaluar la protección contra contraseñas filtradas según el plan de Supabase.
- Provisionar un reparto de prueba y validar acceso, licencia y clientes con cuentas de roles distintos, dentro del alcance acordado para esa tarea.
- Continuar productos y rutas/asignaciones según el plan existente en `public/plan.html`.

Estas propuestas no fueron implementadas durante la revisión.

## Registro de avances

- 2026-10-19: incorporados los acuerdos persistentes en `AGENTS.md`, esta bitácora y el informe de Supabase. Validación: revisión documental y `git diff --check`; no se cambió código de ejecución ni se corrieron pruebas de aplicación para esta actualización documental.
