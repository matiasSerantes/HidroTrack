# Base de HidroTrack: estado al 20/10/2026

Fuente de continuidad para retomar desde otra PC. Supabase está conectado por MCP con una variable de entorno local; nunca guardar el token en el repositorio. El proyecto se verifica antes de modificarlo. No repetir el reinicio de inventario del 19/10.

## Instalado y verificado por MCP

18 migraciones, 30 tablas públicas con RLS. Archivos locales renombrados a los identificadores asignados por Supabase para que un futuro despliegue no intente aplicar nuevamente la misma migración. Se aplicó únicamente lo que faltaba, sin insertar datos comerciales de prueba. Cuenta, licencia y cliente existentes conservados; inventario y ventas siguen vacíos para la carga inicial.

| Bloque | Tablas principales | Comportamiento de servidor |
|---|---|---|
| Identidad y licencias | tenants, tenant_members, platform_admins, licenses, license_events, user_profiles | Roles separados, licencia vigente, cupo de asistentes y auditoría |
| Administración | admin_member_events | Pausar/reactivar choferes; historial exclusivo del administrador |
| Clientes | customers, customer_schedules, customer_product_preferences | Datos, localidad, calle/altura, coordenadas opcionales, días y cantidades habituales |
| Inventario | products, inventory_trips, inventory_trip_customers, inventory_operations, inventory_movements, inventory_load_preparations | Patrimonio, llenos/vacíos, carga única, entregas/devoluciones y regreso |
| Dispenser | dispensers, dispenser_events, dispenser_assignments | Equipos propios/del cliente, modelos por cantidad, préstamo/alquiler, devolución y rotura |
| Cuenta corriente | sales, sale_items, payments, credit_requests | Precio histórico, pagos parciales, apertura de deuda y aprobación separada del saldo |
| Alquiler mensual | rental_charges | Una cuota por equipo/contrato/período, anclada a fecha de entrega |
| Recorrido | route_stops, route_events | Orden, retiro de paradas sin borrar historial, presencia, ausencia y reprogramación auditadas |
| Posición | driver_positions | Última posición publicada por el propio chofer en reparto activo; fecha de servidor y detención explícita |
| Futura baja | customer_deactivations | Bloquea entregas nuevas, mantiene devoluciones/cobros y exige recuperación antes de aprobar |
| Rendición | trip_closures | Caja esperada/declarada, conteo de camión, observaciones y aprobación del jefe |
| Avisos internos | owner_notifications | Ventas, crédito, recuperación y rendición, sin duplicados por reintento |

## Contratos para conectar la web

- **Entrega:** `commerce_deliver` recibe UUID estable, reparto, cliente, cantidades y cobro inicial. Precio y total salen del servidor. Venta, stock, envases, pago y solicitud de crédito se confirman juntos. La RPC anterior `inventory_post` también genera la venta; no permite omitir contabilidad. No usar esa RPC para entregar o devolver dispenser: usar su asignación/devolución específica.
- **Cobro posterior:** `commerce_record_payment` referencia una venta/cuota/apertura, efectivo o transferencia, fecha y reparto de cobro. Permite pagos parciales, rechaza sobrepagos y conserva el UUID al reintentar. Cobrar varias ventas requiere un UUID por pago; no admite saldo a favor ni reparto automático entre facturas.
- **Crédito:** `commerce_review_credit`, solo jefe. Rechazar deja el importe pendiente de cobro al cliente; no lo borra ni lo pasa al chofer. `customer_sale_balances` separa total, pagado, saldo y estado de aprobación. Consultar el saldo actual, no interpretar el importe original de la solicitud como deuda actual. Una solicitud saldada puede conservar su notificación histórica.
- **Apertura:** `commerce_open_customer_balance`, solo jefe, registra deuda anterior con fecha y motivo, una vez antes de otras ventas. No cambia envases ni genera un ingreso de stock.
- **Cuotas:** `commerce_charge_rental`, solo jefe, genera explícitamente un período de un alquiler activo. Período 0 comienza en la entrega; 1 empieza un mes después, etc. Cada fecha se calcula desde el ancla original: 31/01 → 28/02 → 31/03. Cuota completa pactada, sin cron, prorrateo ni débito bancario. Préstamos gratuitos y equipos del cliente no generan cuota. No se crean nuevas cuotas después de devolver el equipo; las ya creadas conservan su deuda. El ID estable permite reintentar después de la devolución sin repetir un cargo previo.
- **Recorrido:** `route_manifest` devuelve clientes autorizados, deuda completa, envases y equipos, evitando sumar solo el historial parcial del chofer. `route_edit_stop` permite al jefe agregar, ordenar y retirar paradas pendientes; mantiene sus relaciones históricas. `route_record_visit` usa versión esperada para rechazar cambios sobre una parada modificada. Una entrega confirmada resuelve la parada y evita una segunda entrega con otro UUID para esa misma parada.
- **Posición:** `route_publish_position` / `route_stop_position`. `fleet_last_positions.recent` exige reparto activo y posición de menos de dos minutos. No representa seguimiento en segundo plano ni emisión GPS automática: la web debe pedir permiso y publicar únicamente durante su uso acordado.
- **Futura baja:** `customer_request_deactivation` crea la solicitud y aviso al jefe. `pending_recovery` conserva al cliente activo para recuperar lo que tiene, bloqueando nuevas entregas/equipos. `customer_review_deactivation` aprueba solo sin envases ni equipos propios pendientes. No exige devolver un dispenser que pertenece al cliente. La baja conserva cuenta e historial. El archivo antiguo tampoco puede ocultar artículos pendientes. Rechazar la solicitud habilita nuevamente las entregas.
- **Rendición:** `trip_submit_close` compara caja y stock declarados con lo esperado por servidor. Diferencias requieren observación. `trip_review_close` permite al jefe aprobar o devolver observado; devolución conserva la declaración anterior y reabre el reparto. Aprobar exige conciliar físicamente faltantes/roturas y ejecuta el regreso del camión en la misma transacción. El cierre antiguo está bloqueado cuando hay pagos o una declaración de caja. Repartos sin pagos ni declaración conservan el flujo anterior de cierre de stock.

Las funciones serializan escrituras de una empresa con el bloqueo de su fila de tenant, validan pertenencia y licencia y rechazan UUID reutilizados con otro contenido. Clientes autenticados no pueden escribir directamente los libros comerciales, visitas ni rendiciones. La demostración conserva datos ficticios separados; no utilizar sus cálculos como autoridad de producción.

## Verificación y límites

`supabase/tests/inventory_preflight.sql`, `inventory_incidents_verify.sql` y `beta_database_verify.sql` permiten comprobar presencia, RLS, permisos y consistencia sin devolver datos personales. Pruebas locales con PostgreSQL embebido cubren aislamiento, reintentos, sobrepagos, deuda rechazada, cuotas, ausencia/reprogramación, futura baja y diferencias de rendición. No sustituyen sesiones Auth/PostgREST reales ni concurrencia con varias conexiones.

La web real de stock, planilla y administración puede usar las actualizaciones anteriores. Los nuevos recorridos, ventas/cobros, futura baja, GPS y caja requieren conectar sus pantallas a estas RPC y probar el flujo completo antes de retirar su demo. El frontend no se desplegó manualmente en esta tarea.

## Para cerrar todo el alcance del producto

- Definir prorrateo del alquiler, correcciones/anulaciones y reintegros con movimientos compensatorios; no editar pagos históricos.
- Precisar qué altas puede solicitar un asistente y qué campos aprueba el jefe. No existe todavía una aprobación genérica real de altas de clientes/artículos/usuarios.
- Conectar la cola offline del navegador a los UUID estables; no aprobar mientras haya envíos pendientes. El servidor no puede inferir operaciones que todavía están solo en un teléfono.
- Definir exigencia y recuperación de TOTP, política de gracia de licencia y backups/restauración para beta. No se cambiaron estas políticas silenciosamente.
- Integrar y probar Auth/PostgREST, permisos reales, concurrencia multiconexión y flujos móvil/PC. Notificaciones push y publicación Realtime requieren integración adicional; estos avisos internos pueden consultarse por lectura autorizada.

La base principal para beta está preparada; esto no equivale a declarar todo el programa terminado ni la integración de todas sus pantallas validada.

Ingreso de bidones: la web del jefe pregunta Vacíos/Llenos. `inventory_fill_and_load` usa primero llenos, rellena solamente el faltante retornable del depósito y carga el camión en la misma transacción. Conserva patrimonio y carga única; no permite rellenar dispenser ni consumibles. La preparación conserva ambos UUID para reintentos. Es una acción explícita del jefe; no supone que todo el inventario está lleno.
