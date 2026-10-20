# Cierre de inventario: siguiente paso

**Actualización 20/10/2026:** las tres migraciones de inventario y las dos administrativas ya están aplicadas por MCP, junto con ventas, recorridos, futura baja, caja y alquiler mensual. Ver [estado actual de la base](BASE_DE_DATOS.md). Los verificadores de inventario y contratos comerciales pasaron en remoto. No ejecutar nuevamente las migraciones indicadas abajo: el procedimiento se conserva como referencia histórica. Archivos y referencias usan ahora las versiones registradas por Supabase.

Estado al retomar el 19/10/2026: reinicio remoto terminado según la bitácora; tres migraciones adicionales pendientes de comprobar. En esta sesión no hay conexión autenticada de Supabase. No repetir el reinicio del inventario.

1. Conectar Supabase y verificar el proyecto destino mediante MCP autenticado.
2. Consultar su historial de migraciones y ejecutar `supabase/tests/inventory_preflight.sql`. Devuelve solo versiones y componentes, sin datos comerciales. `present` indica presencia de componentes, no equivalencia del código ni aplicación registrada de la migración. `partial` requiere investigar antes de modificar.
3. Comparar historial y esquema con los archivos locales. Si hay diferencias, detener la aplicación y resolverlas; no ejecutar nuevamente una migración registrada ni ignorar componentes parciales.
4. Aplicar únicamente las migraciones ausentes, en orden: `20261020130955_inventory_incidents.sql`, `20261020130959_dispenser_model_assignments.sql`, `20261020131002_product_archive_guard.sql`.
5. Ejecutar `supabase/tests/inventory_incidents_verify.sql`, de solo lectura, y revisar nuevamente el historial. Comprueba permisos, RLS, saldos, atribución de incidentes, asignaciones y protección de archivo.
6. Registrar el resultado comprobado en notas y guía de demo. Validar el flujo con sesión real del titular antes de dar el inventario por cerrado. Después continuar con ventas y cuentas corrientes transaccionales.

La consulta previa se prueba con esquema vacío, parcial y completo en PostgreSQL embebido. Estas pruebas locales no confirman el estado remoto.
