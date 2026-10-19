# Base de stock — primera etapa

Aplicada al proyecto de HidroTrack por MCP el 19/10/2026: `20261019160747_inventory`. Se reutilizó `products` y se agregaron cuatro tablas; hay 13 tablas públicas con RLS. Sin datos operativos de ejemplo. Esta sección describe la primera migración. La ampliación y la pantalla real del jefe se detallan más abajo.

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

Verificación local inicial: 9 pruebas de PostgreSQL (70 en toda la aplicación), incluyendo aislamiento, ingreso/carga/entrega/regreso, repetición, rollback, cantidades, permisos, precio histórico y siguiente reparto. MCP confirmó migración, tablas con RLS, vistas, funciones sin ejecución anónima y cero operaciones demo. Falta integración con JWT reales de Auth/PostgREST y prueba de concurrencia sobre el servidor.

El asesor remoto señala las tres funciones de stock por ser `SECURITY DEFINER` ejecutables por usuarios autenticados. Es deliberado: son la entrada transaccional y contienen sus propios controles de autorización; no otorgan escritura libre. Se mantiene el pendiente anterior de protección de contraseñas filtradas, además de los hallazgos previos descritos en el informe.

Referencias técnicas: [funciones de Supabase](https://supabase.com/docs/guides/database/functions) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Pendientes al cerrar la primera etapa (ampliación abajo)

Conectar una pantalla real del jefe para catálogo e ingreso inicial al depósito; provisionar empresa/membresías/licencia de prueba. Después conectar carga única y consulta de camión con estos IDs y funciones. Completar lectura de catálogo y saldo completo de envases para asistentes autorizados, gestión de paradas, conteo declarado y diferencias. Ventas, cobros, cuotas/series de equipos, inventario inicial de clientes, conversión lleno/vacío y ajustes de depósito quedan fuera de esta primera base. El importe entregado no es un libro contable ni el dinero cobrado.

## Ampliación: patrimonio y pantalla del jefe

Aplicada por MCP `20261019162655_owned_inventory`. Ahora hay 15 tablas públicas con RLS; no se crearon empresas ni operaciones ficticias en el servidor.

- `inventory_owner_stock`: recibe vacíos comprados (`receive_empty`), registra envases que ya estaban en un cliente (`opening_customer`) y rellena vacíos del depósito (`refill`). Conserva el ID al reintentar. La apertura en cliente solo se permite antes de cualquier movimiento de ese cliente/artículo; no sirve para ajustar entregas posteriores.
- `inventory_owned_stock`: total físico y distribución por artículo. Recargar suma llenos y resta vacíos, sin modificar el total. Envases del cliente = en su poder, con contenido consumido o sin consumir desconocido.
- `inventory_create_product`: catálogo del jefe con alta idempotente, precio de entrega y retornabilidad.
- `dispensers` y `dispenser_events`: unidades identificadas e historial de ubicación. `inventory_save_dispenser` registra/traslada equipos con un ID de operación. Propiedad company/customer; ubicación depósito/camión/cliente; modalidad préstamo gratuito/alquiler/propiedad del cliente. El equipo del cliente no se suma a los propios. No se cambia la propiedad mediante un traslado.

`OwnerStock.tsx`, accesible desde Stock y dispenser dentro de OwnerWorkspace, consulta datos reales y llama a estas RPC. Incluye preparación de reparto/asignación básica, carga única y regreso exacto con las funciones anteriores. Un reparto se finaliza, queda submitted y el jefe confirma cantidades de regreso. Las cantidades declaradas deben coincidir con el libro; pérdidas/diferencias quedan pendientes.

El frontend conserva el comando y su UUID mientras una escritura no obtiene respuesta; bloquea edición y navegación interna hasta reintentar. Los errores SQL confirmados liberan el formulario para corregirlo. Tras una confirmación se limpian campos; si falla la actualización posterior, se informa que la operación ya se guardó. Ese comando incierto no es una cola offline persistente: no cerrar la pestaña durante un reintento; falta recuperación durable al recargar.

Pruebas actuales: 12 PostgreSQL y 70 totales. Incluyen el ciclo apertura→carga→entrega/devolución→regreso→recarga con conservación del patrimonio, equipos del cliente, préstamos gratuitos, alquileres, permisos y reintentos. Pantalla probada con cliente simulado; todavía falta Auth/PostgREST real, concurrencia con varias conexiones y revisión visual en teléfono/PC. Se confirmó por MCP RLS y que las nuevas funciones no son ejecutables por anon. La base remota continúa sin empresas provisionadas.

La pantalla real de ventas/cobros de choferes, aprobaciones de deuda, bajas con revisión, inventario de pérdidas y cuentas corrientes siguen pendientes. Los dispenser registran una cuota pactada; no generan facturas ni cobran alquileres automáticamente. El precio del artículo es el precio de entrega, no el costo de adquirir el envase. Los envases nuevos adquiridos se ingresan; rellenar los propios no es una compra.

Para empezar con Darío: [datos iniciales y corte de inventario](DATOS_INICIALES.md). Las pantallas demo y las conectadas permanecen separadas.

## Primer acceso real habilitado

El primer jefe ya tiene Auth, perfil, empresa inicial y licencia activa sin asistentes. Se comprobó inicio de sesión y lectura REST de catálogo, patrimonio y dispenser con su JWT real. No se insertaron productos, clientes ni movimientos de prueba. El siguiente paso es el conteo inicial desde la pantalla conectada. La función administrativa temporal se deshabilitó después del alta y las credenciales no están en Git.

## Fechas y roturas — migración local pendiente

`20261019180000_inventory_incidents.sql` está probada localmente, **sin aplicar aún al proyecto remoto** por falta de conexión MCP en esta sesión. Aplicar por MCP y verificar con sesión real antes de considerar disponible. No ejecutar inferencias de cantidades desde el campo Unidad.

Agrega familia de producto (artículo/dispenser), fecha de hecho y persona involucrada. `inventory_record_stock` envuelve las entradas y carga única con fecha; `inventory_remove` registra baja/rotura desde una ubicación concreta y descuenta del libro; `inventory_retire_dispenser` retira un equipo identificado conservando ubicación e historial. Autor autenticado y persona involucrada se conservan por separado. Se rechazan fechas futuras, cantidades insuficientes y personas de otra empresa. Reintentos con igual ID no repiten el descuento. No hay cargos automáticos.

La pantalla conserva las RPC anteriores para entradas mientras no exista la nueva columna y muestra que bajas/fechas editables requieren actualizar la base. Los modelos reconocidos como dispenser se muestran en esa sección con el mismo ID y libro; no se convierten en equipos individuales ni duplican stock. Tras aplicar, familia conserva la clasificación aun si se renombra el modelo. Equipos retirados no aparecen como disponibles en la ficha del cliente.

Validación actual: 95 pruebas, incluidas 17 de PostgreSQL; compilación aprobada. Nuevas RPC aún sin comprobación remota; revisión visual y concurrencia multiconexión pendientes.

Verificación posterior preparada en `supabase/tests/inventory_incidents_verify.sql`: ejecutar por MCP después de aplicar la migración. Es de solo lectura, no devuelve datos de clientes y comprueba funciones/permisos/RLS, protección del libro y saldos negativos por ubicación. Pasa localmente; 96 pruebas totales, 18 de PostgreSQL. OAuth del MCP completado y confirmado por CLI; el cliente de esta conversación sigue respondiendo Auth required. Reconectar/reiniciar el cliente MCP antes de aplicar y verificar la migración remota, que aún está pendiente.

## Disponibilidad de dispenser por modelo — pendiente remoto

Aplicar `20261019190000_dispenser_model_assignments.sql` después de la migración de incidentes. Agrega asignaciones por unidad con RLS y RPC `inventory_assign_dispenser_model` / `inventory_return_dispenser_model`. Consumir stock desde depósito o camión del reparto del cliente cambia la ubicación, no el patrimonio. Devolver suma al depósito. Una rotura/baja del libro en el cliente cierra las asignaciones correspondientes, conserva su operación y no permite devolver unidades ya retiradas. Las fechas de baja/devolución no pueden ser anteriores a la entrega.

La planilla combina modelos disponibles del libro y equipos individualizados previos. No materializa de nuevo todas las existencias ni exige serie para modelos contados por cantidad. Sin tabla nueva, avisa que requiere actualización; los equipos anteriores conservan su flujo. El verificador SQL ahora requiere ambas migraciones y también controla las asignaciones activas contra las unidades en clientes.

102 pruebas locales, incluidas 21 PostgreSQL; 17 tablas locales con RLS. Ninguna de estas dos migraciones fue aplicada al remoto desde esta sesión.

## Reinicio administrativo solicitado

`supabase/maintenance/reset_inventory.sql` vacía catálogo e inventario de una sola empresa verificada por MCP; conserva cuenta, usuarios, licencia y clientes. Ejecutar en una transacción con empresa explícita, verificar antes de confirmar y rechazar si hay repartos activos/en rendición. No es una migración ni una función pública. Limpieza autorizada pero todavía no ejecutada remotamente: MCP requiere reconexión. Validación local actual: 109 pruebas, incluidas 24 de PostgreSQL, y build correctos.

## Eliminar modelos/artículos de activos

Botón Eliminar en stock de bidones y tarjetas de catálogo/dispenser: vuelve a consultar saldos, rechaza existencias positivas y confirma active=false conservando filas e historial. Opera con los permisos de actualización ya existentes. `20261019200000_product_archive_guard.sql` agrega la protección atómica del servidor usando el mismo bloqueo de empresa que las RPC de inventario. Pendiente de aplicar remotamente después de las migraciones 180000 y 190000. Hasta entonces la comprobación de interfaz no cubre una modificación concurrente desde otro dispositivo.

El verificador de solo lectura requiere las tres migraciones y comprueba también este trigger. 107 pruebas locales aprobadas, 22 PostgreSQL. Nuevo OAuth exitoso; cliente MCP de esta conversación aún responde Auth required, sin cambios remotos.

Actualización 19/10: MCP conectado y proyecto verificado. Limpieza remota sin ejecutar porque existe un reparto pendiente de rendición; resolverlo antes del reinicio. Migraciones adicionales pendientes.
