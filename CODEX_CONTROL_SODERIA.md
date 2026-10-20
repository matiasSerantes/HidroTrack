# Brief técnico para Codex — Control de Sodería

## Objetivo
Construir una aplicación web responsive SaaS para **repartidores independientes de soda** (no para las soderías proveedoras). El primer titular es el hermano del propietario del sistema y tendrá licencia permanente. Otros titulares podrán recibir licencias mensuales administradas manualmente por un superadministrador. Cada titular gestiona clientes, productos, choferes, rutas, entregas, envases, cuentas corrientes y cierres de jornada.

## Estado
- La especificación está aprobada a nivel funcional. **No asumir que existe backend ni código de producción**.
- Se adjunta `control_soderia_prototipo.html` como referencia visual e interactiva, **no** como arquitectura de producción.
- Antes de implementar, inspeccionar el repositorio y reportar dependencias existentes. No sobrescribir código previo.
- Desarrollar por fases pequeñas, verificables, con migraciones y tests.

## Roles y aislamiento
1. `superadmin`: alta de titulares, licencias, suspensiones, auditoría de licencias. No acceder por defecto a información comercial privada.
2. `owner` (sodero titular): administrar sus clientes, productos, choferes, rutas, finanzas y aprobar cierres.
3. `driver` (chofer): ver solo rutas/clientes asignados, registrar visitas, entregas, cobros, envases, rendición y enviar cierre. No aprobar su propio cierre ni cambiar precios o historial.

Modelo multi-tenant: `tenant_id` obligatorio en tablas comerciales; RLS en PostgreSQL, autorización en servidor, claves foráneas compuestas y pruebas de aislamiento entre tenants. Nunca confiar en IDs, roles ni importes del cliente.

## Reglas aprobadas
- Catálogo de productos configurable por titular.
- Cantidades habituales por cliente, editables en cada visita.
- Días fijos semanales más pedidos extraordinarios.
- Efectivo, transferencia y cuenta corriente; soportar pagos parciales mediante movimientos/asignaciones.
- Control de mercadería llena, envases vacíos y saldos de envases por cliente.
- Cierre diario realizado por chofer y aprobado/rechazado por titular con auditoría.
- Orden manual de visitas y apertura de navegación GPS externa; mapa con MapLibre.
- Web responsive primero, futura app móvil; registrar entregas offline en IndexedDB y sincronizar posteriormente con idempotencia.
- Licencia por titular: mensual o permanente. El titular crea cuentas de choferes; cantidad permitida configurable por licencia.

## Cierre de jornada (crítico)
- Jornada y ruta asignadas; carga inicial por producto/envase, visitas, ventas, cobros y devoluciones.
- Chofer declara mercadería restante, envases recuperados y efectivo rendido.
- Servidor calcula esperado vs declarado; diferencias exigen observación y revisión.
- Estados sugeridos: abierto, pendiente_sync, enviado, observado, aprobado.
- No aprobar mientras existan operaciones offline pendientes.
- Movimientos confirmados son inmutables; corregir con ajustes compensatorios auditados.
- El titular aprueba; el chofer no puede aprobar ni modificar cierres aprobados.
- Operaciones transaccionales e idempotentes para evitar cobros, ventas o inventario duplicados.

## Datos y dominios propuestos
Identidad/licencias: `tenants`, `profiles`, `tenant_members`, `licenses`, `license_events`, `audit_logs`.
Clientes/programación: `customers`, `customer_schedules`, `customer_product_preferences`, `special_orders`, `customer_price_rules`.
Rutas: `workdays`, `routes`, `route_assignments`, `route_stops`, `visits`, `delivery_items`.
Inventario: `products`, `container_types`, `stock_movements`, `route_loads`, `route_returns`, `container_movements`.
Finanzas: `sales`, `sale_items`, `payments`, `payment_allocations`, `customer_ledger`, `cash_movements`.
Cierres/sync: `daily_closures`, `closure_cash_counts`, `closure_stock_counts`, `closure_reviews`, `sync_operations`, `sync_conflicts`.

UUIDs; dinero `NUMERIC(14,2)` y moneda ARS inicialmente; timestamps UTC; zona horaria de presentación America/Argentina/Buenos_Aires. Precio histórico como snapshot. Evitar dobles visitas por programación recurrente mediante restricciones únicas. No usar float para dinero.

## Stack objetivo (validar versiones vigentes al iniciar)
- React + TypeScript + Vite, CSS modular, responsive.
- Cloudflare Pages para hosting web; Supabase para Auth y PostgreSQL.
- MapLibre para visualización de mapas, navegación externa para rutas.
- IndexedDB y cola durable para operaciones offline; sincronización con `operation_id` único, reintentos, resolución explícita de conflictos.
- Funciones seguras de backend/Postgres para cierres, licencias, pagos e inventario. RLS y políticas por tenant.
- Hosting gratuito inicialmente sujeto a cuotas/condiciones del proveedor. No exponer service-role keys en el frontend.

## Plan de ejecución
Fase 1: repositorio, configuración, diseño de esquema, migraciones, Auth, roles, RLS, licencias y CI básico.
Fase 2: clientes, productos habituales, calendario semanal/extraordinario, mapa y orden manual de rutas.
Fase 3: visitas, entregas, envases, ventas, cobros y cuentas corrientes.
Fase 4: choferes, cargas, rendiciones, diferencias, cierres y aprobación del titular.
Fase 5: IndexedDB, sincronización idempotente y conflictos offline.
Fase 6: pruebas E2E, seguridad, backups y despliegue piloto.

## Decisiones aún no aprobadas
Reglas exactas de expiración/gracia de licencias; máximo de choferes; política de stock negativo; mecanismo de backup y retención; permisos de ajuste; gestión de conflictos offline. Proponer defaults seguros, pedir aprobación antes de fijar reglas irreversibles.

## Instrucción inicial a Codex
1. Inspeccioná el proyecto abierto y describí qué existe y qué falta.
2. Proponé estructura modular, dependencias actuales y migraciones SQL para fase 1.
3. Identificá riesgos de RLS, autenticación, licencias y cierre diario.
4. Presentá un plan de archivos y tests; **no implementes todavía hasta mi confirmación**.
5. Respetá la interfaz de referencia, pero no copies el prototipo monolítico como arquitectura definitiva.
