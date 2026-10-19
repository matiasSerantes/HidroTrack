# Revisión de HidroTrack — 19 de octubre de 2026

Proyecto: `tuqdutglubkmuxumjqyv`. Revisión realizada contra la base real mediante el MCP de Supabase y el cliente oficial de Codex. Se consultaron tablas, migraciones, asesores, políticas, funciones públicas y privadas, índices, restricciones, triggers y conteos. No se modificaron datos ni configuración de Supabase.

## Estado

Hay 9 tablas públicas y todas tienen RLS habilitado. Conteos exactos: `platform_admins` tiene 1 registro; `tenants`, `tenant_members`, `licenses`, `license_events`, `customers`, `products`, `customer_schedules` y `customer_product_preferences` tienen 0.

La base está preparada para la primera etapa, pero todavía no tiene ningún reparto ni licencia provisionados. Un usuario sin membresía no podrá entrar como titular. El acceso operativo de choferes está pendiente por diseño: las políticas de clientes, productos, horarios y preferencias solo permiten titulares; el frontend local también informa que los recorridos llegan en una etapa posterior.

## Hallazgos y prioridades

1. **Protección de contraseñas filtradas desactivada.** Confirmado por el asesor de seguridad. Evaluar habilitarla en Auth según disponibilidad del plan. [Documentación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

2. **Historial local incompleto respecto de la base.** Supabase registra `20261017193404_foundation` y `20261017222129_admin_portal`. En `HidroTrack/supabase/migrations` solo se encontró `202610170001_foundation.sql`. Falta versionar la migración administrativa y reconciliar los identificadores antes de depender de un despliegue reproducible. No se alteró el historial remoto.

3. **Cuatro claves foráneas sin índice de cobertura.** Agregar índices sobre `tenant_members(user_id)`, `license_events(tenant_id)`, `license_events(actor_id)` y `customer_product_preferences(tenant_id, product_id)`. Es una mejora preventiva; las tablas están vacías y no se midió una degradación actual. [Diagnóstico de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

4. **Dos políticas recalculan identidad por fila.** `tenant_members.members_read` y `licenses.license_read` usan `auth.uid()` directamente. Evaluar `(select auth.uid())` conservando la lógica y comprobar el plan con volumen representativo. [Diagnóstico de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).

## Avisos que requieren contexto

- `platform_admins` tiene RLS sin políticas: bloquea acceso directo de los roles sometidos a RLS. `private.is_admin()` consulta la tabla mediante SECURITY DEFINER y compara con `auth.uid()`. La ausencia de políticas puede ser intencional; no agregar una política permisiva para silenciar el aviso. [Referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `admin_directory()` e `is_platform_admin()` son SECURITY DEFINER ejecutables por `authenticated`, pero no por `anon`. La primera rechaza usuarios que no sean administradores; la segunda devuelve únicamente el resultado de la comprobación. Ambas fijan `search_path` vacío. El aviso por sí solo no demuestra una vulnerabilidad. [Referencia](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- `admin_provision()` no es ejecutable por `anon` ni `authenticated`. Confía en `p_actor` y modifica el contexto de identidad para la auditoría; es necesario mantener su ejecución restringida al backend y verificar allí la identidad del actor. No se revisó el backend ni se simuló esa operación.

## Controles observados

`private.has_role()` verifica usuario, membresía activa, rol permitido y licencia vigente. Las relaciones de horarios y preferencias con clientes/productos incluyen `tenant_id`, lo que impide referencias cruzadas entre repartos para esas relaciones. Hay restricciones de precios no negativos, cantidades positivas, días entre 1 y 7, coherencia entre tipo de licencia y vencimiento, y un titular por reparto. Los cambios de licencia tienen trigger de auditoría y un control al reducir el límite de choferes.

## Límites

Se inspeccionaron definiciones y configuración; no se hicieron pruebas de escritura, suplantación de usuarios, aislamiento con JWT reales, carga ni recorrido completo de la aplicación. No se ejecutó el test local de aislamiento porque crea registros. No se certifica ausencia total de vulnerabilidades. Las respuestas MCP se conservaron en la carpeta local de diagnóstico fuera del repositorio; este informe resume la evidencia revisada.

## Conexión MCP

La credencial OAuth existe y un cliente nuevo logró listar e invocar las herramientas de Supabase. Esta conversación no recibió el catálogo nativo del servidor. La vía de diagnóstico usada no extrajo ni mostró tokens. La CLI instalada informó versión 0.130.0 y errores al interpretar el nivel `max` del catálogo de modelos; no impidieron las consultas MCP. También apareció una integración Unity local inalcanzable. No se atribuye a esos errores una causa definitiva del fallo de esta conversación.

## Actualización posterior: base de stock

Después de la revisión de solo lectura anterior, el usuario priorizó implementar stock. Se aplicó por MCP `20261019160747_inventory`: cuatro tablas, tres vistas y tres RPC; total 13 tablas públicas con RLS. Sin operaciones demo ni datos comerciales insertados. Se recuperaron y versionaron foundation y admin_portal con las versiones reales, resolviendo el historial local incompleto sin modificar el historial remoto. Ver [contrato, pruebas y límites](STOCK.md). Las RPC nuevas son SECURITY DEFINER de forma deliberada y verifican autorización; el asesor las señala como ejecutables por authenticated. Las pruebas completas con Auth/PostgREST y los otros pendientes de la revisión siguen abiertos.

## Actualización: patrimonio físico y surtidores

Aplicada por MCP `20261019162655_owned_inventory`: recarga sin aumentar envases propios, apertura de envases en clientes, catálogo y surtidores con propiedad/ubicación e historial. Verificación remota: 15 tablas con RLS, nuevas RPC no ejecutables por anon y search_path vacío; cero empresas, surtidores y operaciones. Hay pantalla conectada del jefe y pruebas con cliente simulado; todavía no existe la cuenta de Darío y falta validación con Auth/PostgREST real. No se insertó información personal ni inventario de ejemplo.
