# Base de HidroTrack: estado al 20/10/2026

Fuente de continuidad para retomar desde otra PC. Supabase está conectado por MCP con una variable de entorno local; nunca guardar el token en el repositorio. El proyecto se verifica antes de modificarlo. No repetir el reinicio de inventario del 19/10.

## Instalado y verificado por MCP

20 migraciones, 31 tablas públicas con RLS. Archivos locales renombrados a los identificadores asignados por Supabase para que un futuro despliegue no intente aplicar nuevamente la misma migración. Se aplicó únicamente lo que faltaba, sin insertar datos comerciales de prueba. Cuenta, licencia y cliente existentes conservados; inventario y ventas siguen vacíos para la carga inicial.

| Bloque | Tablas principales | Comportamiento de servidor |
|---|---|---|
| Identidad y licencias | tenants, tenant_members, platform_admins, licenses, license_events, user_profiles | Roles separados, licencia vigente, cupo de asistentes y auditoría |
| Administración | admin_member_events | Pausar/reactivar choferes; historial exclusivo del administrador |
| Clientes | customers, customer_schedules, customer_product_preferences | Datos, localidad, calle/altura, coordenadas opcionales, días y cantidades habituales |
| Inventario | products, inventory_trips, inventory_trip_customers, inventory_operations, inventory_movements, inventory_load_preparations, catalog_archive_events | Patrimonio, llenos/vacíos, carga única, entregas/devoluciones y regreso |
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

Catálogo unificado: `catalog_create_item` recibe tipo explícito; `catalog_archive_item` corrige altas erróneas del depósito con movimientos de baja y archivo atómicos, usando un UUID estable. Rechaza unidades fuera del depósito. `inventory_writeoff_dispenser` distingue retiro de rotura para equipos identificados y conserva evento; un retiro exige propiedad del reparto y ubicación depósito. Catálogo reúne ambos tipos en el frontend; no se migraron ni duplicaron equipos existentes.


## Pendiente: cuenta propia de asistente y planes del jefe (20/10)

Nueva definicion representada en demo; NO aplicada como migracion. tenant_members ya tiene clave (tenant_id,user_id), por lo que una identidad puede vincularse con varias empresas. Falta alta personal verificada de Auth sin crear tenant/licencia, solicitud y consentimiento de vinculo, RPC del jefe para agregar/quitar con auditoria, cupo transaccional y revocacion conservando historial.

Planes: basico 1, intermedio 3, superior ilimitados; actualmente licenses usa driver_limit entero no nulo. Representar ilimitado explicitamente al migrar y actualizar tambien validaciones administrativas; no usar un numero magico ni cambiar licencias existentes sin politica de conversion. El asistente usa licencia vigente de cada jefe, sin una propia. Definir precios, conversion de licencias antiguas y cobro aparte antes de activarlos.

Acceso: sin recorrido asignado, solo estado de espera. Revisar RLS y RPC de TODOS los datos comerciales (catalogo, saldos, movimientos, equipo, avisos) y consultas de frontend: ocultar el menu no basta. Con recorrido, limitar a empresa y asignacion vigentes; cierre/reasignacion/revocacion quita acceso. Estado de rendicion pendiente mantiene solo lo necesario hasta resolverla (criterio provisional). Probar dos jefes, misma cuenta, revocacion y concurrencia de cupos por Auth/PostgREST antes de publicar esta funcion real.


## Pendiente: costo de llenado (20/10)

Implementado solo en demo. Contrato confirmado: configuracion opcional del jefe y costo por producto retornable de venta; cobrar como gasto SOLO unidades rellenadas dentro de fill_and_load, nunca llenos existentes ni vacios transportados sin rellenar. En servidor, guardar costo unitario historico y unidades junto a la recarga/carga, dentro de su transaccion idempotente. No permitir costos enviados por asistente ni recalcular viajes previos al editar catalogo. Separar del precio de venta y del saldo del cliente.

Mostrar solo al jefe vendido menos costo de llenado del reparto, separado de cobrado. Sin costos historicos: no inferir ganancia cero. No contabilizar dos veces al cerrar o reintentar. Definir costos de recarga independiente, devolucion o anulacion antes de incorporarlos al resultado; no forman parte de este pedido. Ninguna migracion aplicada por esta idea; RLS real y E2E pendientes al integrar.


## 20/10 - Planilla, coordenadas y flujos de visita

Frontend real de Nuevo/Editar cliente escribe latitude/longitude en customers y lee created_at; campos ya instalados en route_workflow/foundation. Selector en mapa y posicion actual son acciones explicitas, sin geocodificar ni sobrescribir direccion. No se agregaron migraciones ni datos de prueba. Probar guardar/recuperar coordenadas por Auth/PostgREST y permiso GPS real antes de uso operativo.

Demo ampliada con pedido habitual, dias, alta y coordenadas, pedidos de visita adicionales separados de agenda semanal y cambios de dispenser. Pendiente real: alta/edicion transaccional de horarios y preferencias existentes, libro de visitas extraordinarias y asignacion por fecha, cambio atomico de equipos con idempotencia, historia de contrato y retorno separado del stock disponible. No concatenar devolver/asignar desde navegador para simular atomicidad. Mantener cuota/ancla al cambiar salvo regla comercial futura. Equipo del cliente no se retira como propio. Danado a revision; reparar/reingresar pendiente. Devolucion parcial de bidones no cambia regla de saldo; no forzar devolucion total.


## Pendiente: recomendacion de carga y desglose de extras

Demo usa cantidades habituales estructuradas, pedido extraordinario por parada y equipos expresamente previstos en el recorrido. No deduce cantidades de texto ni cuenta equipos del cliente como carga nueva. El jefe/chofer confirma cantidades previstas ajustables mas extra en una sola carga; guarda sugerencia y desglose historicos, sin crear inventario ni habilitar recargas.

La RPC real actual admite cantidad inicial total por articulo y mantiene bloqueo de carga unica; falta integrar preferencias, necesidades de equipo por recorrido y snapshot previsto/extra transaccional. Stock insuficiente sigue bloqueado. Nuevos clientes requieren autorizacion existente; extra transportado no habilita por si solo acceso a carteras ajenas. No se aplico migracion para esta idea.


## Pendiente: tablero mensual y PDF de rendicion

Demo agrega agregacion por fecha de reparto/venta y gastos historicos de llenado. Servidor aun necesita categorias de gastos reales y contrato de rentabilidad; no inferir ganancia total si faltan costos. Consultas del jefe aisladas por tenant; no permitir al asistente agregados de otros repartos. Clientes nuevos se definen provisionalmente como alta el dia del reparto incluida en sus paradas.

Snapshot PDF local al aprobar cierre; variante del jefe con ventas/cobros y variante del asistente con efectivo propio a rendir y stock. Integracion real debe leer snapshot de trip_closures/ledger, generar idempotentemente, conservar versiones y autorizar segun la asignacion vigente; actualizacion 21/10: sin reparto asignado el asistente solo ve perfil basico y no PDFs. Conservar snapshots historicos sin exponerlos en espera. No deducir dinero recibido por generar el comprobante. Notificacion, almacenamiento/descarga autenticada y Realtime entre dispositivos quedan pendientes; no se aplico migracion ni se enviaron documentos a terceros.


## 20/10 - Diagnostico de selector de dispenser vacio

DIAGNOSTICO INICIAL INVALIDADO: la vista inventory_owned_stock filtra por private.has_role aun desde MCP. No se puede interpretar ausencia de filas como cero sin identidad del titular. La revision posterior del libro de movimientos y con identidad de jefe confirmo existencias ya registradas. Ver correccion posterior; no repetir ingresos desde este diagnostico. No se insertaron cantidades, asignaciones ni equipos remotos. Ficha mejorada con registro explicito de existencias no contadas, fecha y referencia, usando RPC instalada; asignacion posterior consume una unidad. Dos operaciones intencionales e independientes, con reintento por ID existente: no afirmar registro+asignacion atomicos. Sin migracion. No guardar correos, identificadores ni salidas crudas del diagnostico en Git.


## 20/10 - Alta atomica con stock y correccion del diagnostico

Migracion 20261020182832_catalog_initial_stock aplicada: crear modelo con cantidad positiva registra su existencia en la misma transaccion; errores revierten alta y movimientos. Dos IDs estables para reintento, guardas de jefe y licencia, cantidad/fecha/estado. Dispenser disponible inmediatamente; envase puede ingresar vacio o lleno. Cero crea solo catalogo mediante contrato anterior. 20 migraciones, 31 tablas con RLS; RPC nueva sin acceso anonimo.

AL REVISAR POR MCP: comprobar auth.uid()/private.has_role y contrastar movimientos del tenant. Las vistas filtran explicitamente aun usando conexion administrativa; una fila ausente no prueba saldo cero. La carga adicional realizada por ese diagnostico errado se compenso con retiros auditados de la misma cantidad, preservando asignaciones y datos previos. Saldo final verificado con identidad de titular y libro de movimientos; coincide con cantidades confirmadas por usuario. No guardar SQL con identidad ni registros comerciales en Git.

Unidad historica numerica: guarda de identidad bloquea cambiar unidad cuando hay movimientos, incluso si saldo neto fuera cero. No desactivar trigger ni crear otro modelo para ocultar historial. Para nuevas altas, unidad de dispenser fija y cantidad separada; ediciones de modelos antiguos conservan unidad historica para no bloquear otros cambios.
## Promociones: migracion instalada y verificada (20/10)

Interfaz OwnerPromotions conectada a las cinco RPC desde cuenta real del jefe. Consultas aisladas por empresa y aviso por destinatario; IDs estables en reintentos de red. Lectura paginada de operaciones para sumar tenencias sin truncar al límite de respuesta. Conversión refresca cartera de clientes; sin inventario adicional ni cobro. OwnerStock muestra in_promotions y promotion_damaged en catálogo/inventario. No se registraron movimientos reales durante pruebas. Sigue pendiente interfaz de asistentes, lectura autorizada de catálogo de su camión, mapas/seguimiento y aviso en vivo.

Instalada `20261020203608_promotions.sql`, tras autorizacion explicita del usuario sobre tablas, permisos y operaciones de inventario. El rechazo inicial se resolvio con dicha autorizacion; no hubo bypass. Remoto y local: 21 migraciones y 34 tablas con RLS. Historial MCP y huella de todos los movimientos existentes comparados antes/despues, sin cambios de cantidades ni personas reales. Permisos de asistentes deshabilitados y tablas de promociones vacias.

Contrato preparado: `promotion_set_permission`, `promotion_offer`, `promotion_resolve`, `promotion_recover` y `promotion_read_notification`. Permiso falso por defecto en vinculo tenant_members; baja de miembro lo revoca. Auditoria en promotion_events. Promociones separadas de customers, lectura del jefe o autor habilitado con recorrido activo propio. Avisos de oferta exclusivos al jefe en promotion_notifications.

Entrega atomica: deposito del jefe o camion activo del asistente; bienes pasan a promotion_held en el mismo libro, sin perder patrimonio. Vista inventory_owned_stock incorpora in_promotions y promotion_damaged conservando columnas existentes. Convertir mueve tenencias a customer_held y crea asignaciones de dispenser, sin segunda salida ni cobro. Cuota explicita; alquiler empieza al convertir, no se cobra la prueba automaticamente. Rechazo exige recuperacion: envases buenos vacios, dispenser buenos disponibles y danados separados; cierre solo al recuperar todo. Danados quedan pendientes de un futuro flujo de reparacion/baja, sin reutilizarlos. Guarda adicional bloquea archivar articulos con promociones o danos.

249 pruebas y build correctos. Nuevos casos SQL cubren permiso, revocacion, aislamiento, stock de camion, aviso unico, conversion idempotente, retorno de dispenser convertido y recuperacion parcial/danada. Verificador de contratos en supabase/tests/promotions_verify.sql. Aplicacion por MCP y verificador promotions_verify.sql completados; migracion local renombrada a la version remota efectiva. No se registraron promociones reales para probar. Pendientes: interfaz real, bandeja de avisos, seguimiento en mapa y PDF especifico de promociones; demo existente sigue disponible.

## Estado consolidado al 22/10

Ver docs/ESTADO_REAL.md para matriz actual de base, usuarios y pantallas. MCP confirma 21 migraciones y 34 tablas con RLS; no equivale a beta operativa. Perfil personal real ya conectado con politicas existentes; vinculo por ID e invitacion aceptada siguen sin contrato de servidor. No habilitar lecturas de recorrido del asistente hasta revisar inventory_trip_access y caminos de comercio/posicion/promociones. Optimizacion de mapa pospuesta por usuario.
# Avance 22/10/2026: vinculos de asistentes

Aplicada `20261022123826_assistant_links.sql`: auditoria de vinculos, RPC de jefe, nombres minimos para asistente, planes y cupos atomicos. 22 migraciones instaladas, 35 tablas con RLS. `supabase/pending/assistant_waiting_access.sql` NO instalada: rechazo de revision automatica por impacto global de permisos; no sincronizar ese directorio como migraciones. Ver [impacto y estado](ETAPA_1_USUARIOS.md).

Actualizacion 22/10: bloqueo temporal autorizado explicitamente e instalado como 20261022130128_assistant_waiting_access.sql; 23 migraciones, 35 tablas con RLS. Referencias anteriores al SQL pendiente son historicas. SMTP a cargo del usuario, aun sin validar.
Actualizacion etapa 2 (22/10): migracion 20261022131448_trip_invitations aplicada; 24 migraciones, 37 tablas con RLS. Agrega invitaciones/eventos, RPC limitados, guardia de carga y desvinculacion de planes rechazados/revocados sin carga. No habilita permisos operativos generales del driver. Ver [detalle](ETAPA_2_INVITACIONES.md).

## 24/10 - Solicitudes de visita

Aplicada 20261024134653_extra_visits.sql: solicitudes y eventos con RLS de jefe, RPC auditados e idempotentes, asignacion mediante route_edit_stop sin entrega/venta. 25 migraciones, 39 tablas con RLS. Sin abrir permisos operativos generales de driver. Detalle en ETAPA_3_PREPARACION.md.

## Cambio real de dispenser por modelo - 24/10/2026

Migracion `20261024140721_dispenser_exchange.sql` aplicada por MCP. Estado comprobado: 26 migraciones y 40 tablas publicas con RLS. Desde la planilla del cliente, Cambiar dispenser registra retiro y reemplazo en una transaccion, desde deposito o camion activo autorizado. Conserva contrato, modalidad, cuota y fecha inicial del alquiler. El retirado bueno vuelve al origen; roto significa baja definitiva del inventario activo, con fecha y responsable. No representa reparacion recuperable.

Reintentos idempotentes, disponibilidad previa al retiro y fechas coherentes; fallo revierte ambos movimientos. Historial de cambios visible al jefe. Equipos individualizados por serie y reparaciones siguen pendientes. Rama operativa del asistente permanece bloqueada hasta etapa 4. Sin cambios con stock real para probar ni ajustes de cuentas/claves.

Verificacion: 25 comprobaciones dirigidas de contratos y permisos y 2 del formulario aprobadas; compilacion correcta. MCP confirma cero cambios reales de dispenser, sin escritura directa ni ejecucion anonima. Suite general, prueba visual movil/PC y despliegue publico pendientes.

## Costo y detalle historico de carga real - 24/10/2026

Migracion `20261024183740_load_cost_snapshots.sql` aplicada por MCP: 27 migraciones y 42 tablas publicas con RLS. Nuevas tablas filling_cost_settings e inventory_load_snapshots, solo lectura del jefe de su empresa; escritura mediante RPC, sin acceso anonimo. No se modificaron cuentas ni existencias reales para comprobar; ambas tablas quedaron sin registros reales al verificar.

En Catalogo, Configuracion del costo de llenado permite activar el control y seleccionar productos retornables con costo por unidad, independiente del precio de venta. Desactivado por defecto; no aplica a dispenser. En carga se anticipa el gasto parcial solo del faltante a rellenar. Al confirmar, inventory_confirm_load registra carga y detalle juntos: nombres, sugerencia calculada en servidor, cantidades cargadas, extras/faltantes, rellenados y costo vigente. Pedido extraordinario reemplaza habitual sin doble suma. Si falla, no queda relleno o carga parcial; reintentar conserva el resultado original.

Repartos muestra las ultimas diez cargas con detalle historico. Cambiar nombre, preferencias o costos despues no altera ese registro. Las cargas anteriores o hechas mediante contratos antiguos no se reconstruyen: pueden existir sin este detalle. Costo desactivado o producto sin costo no significa ganancia conocida; el total solo incluye llenado configurado y excluye otros gastos. Graficos y resultado real del reparto siguen pendientes del circuito de ventas/cobros.

Verificacion: 30 contratos/permisos, 2 controles de configuracion/historial y 4 de sugerencia/preview aprobados (36 en total); compilacion correcta. Suite general y QA visual/publicacion movil-PC pendientes. Siguiente paso: circuito operativo real del asistente con permisos por reparto aceptado, entrega/devolucion y cobro; conservar pendientes de equipos por serie y reparacion.
