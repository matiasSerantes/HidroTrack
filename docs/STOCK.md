# Base de stock — primera etapa

Aplicada al proyecto de HidroTrack por MCP el 19/10/2026: `20261019160747_inventory`. Se reutilizó `products` y se agregaron cuatro tablas; hay 13 tablas públicas con RLS. Sin datos operativos de ejemplo. La interfaz de stock continúa en demo local: todavía no llama a estas funciones.

## Modelo

| Objeto | Uso |
| --- | --- |
| `products` | Catálogo por empresa; precio ARS, unidad, venta/alquiler, retornable y activo. |
| `inventory_trips` | Reparto, chofer, fecha y estado: planned → active → submitted → closed. |
| `inventory_trip_customers` | Clientes asignados al reparto, con referencias dentro de la misma empresa. |
| `inventory_operations` | Cabecera inmutable: tipo, usuario, fecha, reparto, cliente e ID para reintentos. |
| `inventory_movements` | Cantidades con signo para depósito/camión, llenos/vacíos, envases del cliente y precio histórico. |
| `inventory_depot_stock` | Saldo por producto del depósito; solo jefe. |
| `inventory_truck_stock` | Carga inicial, disponibles, vacíos e importe entregado; jefe o chofer asignado. |
| `inventory_customer_containers` | Saldo histórico completo de envases por cliente; solo jefe en esta primera etapa. |

Los saldos se calculan del historial; no se editan directamente. Un cajón y un sifón son productos distintos: no se convierten automáticamente. Las cantidades son enteras. Los importes usan `numeric(14,2)` en pesos, mientras la demo usa centavos. No se deben mezclar unidades al integrar el frontend.

## Funciones disponibles

Llamar con la sesión real de Supabase Auth, membresía activa y licencia vigente; nunca con una identidad enviada como parámetro. Los UUID los genera el cliente y debe conservarlos para reintentar la misma operación.

`inventory_create_trip(p_tenant, p_id, p_driver, p_name, p_date, p_customers)` permite al jefe crear un reparto con clientes activos de su empresa. Repetir ID y los mismos datos devuelve el mismo reparto. No permite al asistente asignarse recorridos.

`inventory_post(p_tenant, p_id, p_kind, p_trip, p_customer, p_items, p_note='')` registra una operación completa. Cada elemento de `p_items` tiene esta forma:

```json
{"product_id":"UUID del artículo","quantity":3,"returned":1}
```

| Tipo | Quién | Efecto |
| --- | --- | --- |
| `receive` | Jefe | Ingresa `quantity` de productos listos al depósito; reparto/cliente nulos y returned=0. |
| `load` | Jefe o chofer asignado | Transfiere depósito → camión y comienza el reparto. Una sola carga; sin edición ni recarga. |
| `delivery` | Jefe o chofer asignado | Descuenta entregados, suma vacíos retirados y actualiza envases del cliente asignado. |
| `close` | Jefe | Aprueba un reparto submitted y devuelve sus productos/vacíos al depósito. |

En `close`, `quantity` es el conteo que vuelve por artículo y debe coincidir con lo esperado. Los vacíos se transfieren desde el saldo del camión. Incluir también los artículos que vuelven con cero llenos pero tienen vacíos. Se acepta `[]` si no quedan productos ni vacíos. No hay todavía circuito de diferencias, daños, ajustes o rechazo de rendición.

`inventory_submit_trip(p_tenant, p_trip)` finaliza el recorrido activo y lo deja pendiente del jefe. Bloquea nuevas entregas. No recibe todavía un formulario de conteo del asistente; ese formulario y la revisión de paradas pendientes se integrarán junto con recorridos reales. Hasta aprobar el anterior, no se inicia otro reparto del mismo chofer.

Reintentar `inventory_post` con el mismo UUID, usuario y contenido devuelve el ID sin duplicar movimientos, incluso después de cerrar. Cambiar los datos con ese UUID se rechaza. Debe conservarse el mismo JSON de artículos, incluido su orden. Si falla un artículo, se revierte toda la operación. No usar un UUID nuevo para reintentar una entrega ya enviada.

## Controles y verificación

Se niega escritura directa del libro a `anon` y `authenticated`. Las funciones verifican empresa, rol, asignación y licencia; usan nombres de esquema explícitos y `search_path` vacío. Las vistas respetan RLS (`security_invoker`). Los cambios de modalidad/unidad/retornabilidad se bloquean cuando un producto tiene movimientos. El precio puede cambiar; las entregas anteriores conservan el registrado.

Las escrituras se serializan mediante bloqueo de la empresa durante la transacción para evitar saldos negativos por operaciones simultáneas. Es una primera implementación para volúmenes pequeños; no se midió rendimiento ni concurrencia con varias conexiones reales. No hay edición/borrado de movimientos desde la API de usuario.

Verificación local: 9 pruebas de PostgreSQL (51 en toda la aplicación), incluyendo aislamiento, ingreso/carga/entrega/regreso, repetición, rollback, cantidades, permisos, precio histórico y siguiente reparto. MCP confirmó migración, tablas con RLS, vistas, funciones sin ejecución anónima y cero operaciones demo. Falta integración con JWT reales de Auth/PostgREST y prueba de concurrencia sobre el servidor.

El asesor remoto señala las tres funciones de stock por ser `SECURITY DEFINER` ejecutables por usuarios autenticados. Es deliberado: son la entrada transaccional y contienen sus propios controles de autorización; no otorgan escritura libre. Se mantiene el pendiente anterior de protección de contraseñas filtradas, además de los hallazgos previos descritos en el informe.

Referencias técnicas: [funciones de Supabase](https://supabase.com/docs/guides/database/functions) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Siguiente parte

Conectar una pantalla real del jefe para catálogo e ingreso inicial al depósito; provisionar empresa/membresías/licencia de prueba. Después conectar carga única y consulta de camión con estos IDs y funciones. Completar lectura de catálogo y saldo completo de envases para asistentes autorizados, gestión de paradas, conteo declarado y diferencias. Ventas, cobros, cuotas/series de equipos, inventario inicial de clientes, conversión lleno/vacío y ajustes de depósito quedan fuera de esta primera base. El importe entregado no es un libro contable ni el dinero cobrado.
