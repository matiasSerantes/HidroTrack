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

## Apertura real del recorrido del asistente - 24/10/2026

Migracion `20261024184611_assistant_trip_stock.sql` aplicada por MCP. Estado: 28 migraciones y 42 tablas publicas con RLS. Extiende solo assistant_open_trip: lectura de clientes activos, posiciones, estados de parada y stock agregado del camion del reparto aceptado vigente. No devuelve deposito, otros camiones, precios/costos ni cartera general. No se habilita helper global driver ni escrituras operativas. Revocar, cerrar o suspender licencia impide consultar; lectura anonima bloqueada. Sin cambios de datos comerciales, cuentas o posiciones reales para comprobar.

Pantalla real del asistente: Abrir reparto, stock del camion, contador de entregas y selector de parada; mapa de pines y navegacion externa por destino o recorrido pendiente. GPS real solo por boton, con precision y manejo de error, sin compartirlo con el jefe en este avance. No hay deteccion automatica de llegada ni optimizacion de rutas. El mapa se carga al abrirlo.

Retoma reparto/parada guardando solo IDs por cuenta en navegador. No guarda nombres, direcciones, existencias ni coordenadas; al abrir consulta y verifica servidor. Error de lectura oculta la informacion, revocacion elimina el puntero al comprobar invitaciones. Los datos en pantalla se actualizan cada 30 segundos con pagina visible y al recuperar foco; no es una suscripcion en tiempo real ni modo offline.

Verificacion: 31 controles de contratos/permisos y 6 de invitaciones/pantalla aprobados (37), compilacion correcta. Prueba visual movil-PC pendiente: Chrome fue detectado, pero Computer Use se detuvo por no poder verificar su URL con suficiente confianza para aplicar la politica. Se retiro el archivo temporal de revision. No se verifico despliegue publico. Siguiente: entrega/devolucion parcial, cobro y deuda mediante operaciones atomicas autorizadas por reparto; carga inicial del asistente y GPS compartido siguen pendientes.

## Atencion real, devolucion parcial y cobro - 24/10/2026

Migracion `20261024185546_assistant_delivery.sql` aplicada por MCP: 29 migraciones y 43 tablas publicas con RLS. Nueva assistant_delivery_receipts, lectura exclusiva del jefe y sin escritura directa. assistant_customer_visit y assistant_deliver verifican destinatario, aceptacion vigente, licencia, empresa, reparto activo y parada activa. No se reabre has_role driver ni las operaciones antiguas. Sin datos comerciales, stock, cuentas o posiciones reales modificados para comprobar; cero recibos reales al verificar.

Desde Abrir reparto > Atender cliente: saldo real del cliente (incluye importes rechazados aun pendientes), envases que tiene, equipos y productos del camion. Entrega y devolucion parcial dejan para la proxima visita los envases no recuperados. Confirmar registra movimientos, cargo, pago declarado en efectivo/transferencia, deuda restante y avisos internos al jefe juntos. El servidor valida precio total esperado, version de parada, stock disponible, enteros y limites; no acepta mas cobro que esa entrega. Una futura baja admite solo retorno de envases. Los dispenser se muestran, pero no se cambian desde este formulario.

Recibo e ID estable evitan duplicar entrega/pago. Ante respuesta desconocida se bloquean cantidades y cambio de parada y se permite reintentar el mismo comando. Rechazo SQL pide actualizar planilla. Seleccion inicial queda fijada, para no saltar a otro cliente por una actualizacion mientras falta confirmar la respuesta. La parada queda resuelta incluso si solo recupera envases; contador se presenta como Atendidos, sin confundirlo con unidades vendidas.

En Repartos y camion del jefe: Deudas para aprobar, primeras 20 pendientes y cantidad total; aprobar/rechazar con nota usa commerce_review_credit existente. Al resolver aparecen las siguientes. Rechazar no borra cargo ni carga la deuda al asistente. Lista se actualiza cada 30 segundos visible/al foco; avisos guardados en base, sin push del sistema ni correos. Transferencia declarada no verifica acreditacion bancaria.

Verificacion: 38 contratos/permisos, 3 pruebas de formulario/deuda y 7 de invitaciones/continuidad aprobados (48 en total). Compilacion correcta. Suite general, QA visual movil-PC y despliegue publico pendientes. Siguiente: ausencia y reprogramacion, cobros de saldos anteriores, alta de clientes en recorrido; aun pendientes carga inicial del asistente, dispenser operativo, seguimiento compartido, rendicion/PDF y circuito completo entre dispositivos. Pedido extraordinario asignado aun no cambia a estado atendido automaticamente.

## Ausencias y cobros anteriores reales - 24/10/2026

Migracion `20261024190247_assistant_followups_payments.sql` aplicada por MCP: 30 migraciones y 44 tablas publicas con RLS. Nuevas funciones assistant_record_visit, assistant_customer_debts y assistant_collect_debt; assistant_payment_receipts guarda confirmaciones de cobro con lectura del jefe y sin escritura directa. No abre has_role driver ni contratos antiguos. Verificacion remota: anonimo sin acceso, cero recibos de cobro reales; sin operaciones comerciales, cuentas, stock o posiciones reales usados para probar.

En planilla del asistente: No esta / no compro. Ausente permite mas tarde hoy o fecha futura; guarda evento, version y pendiente sin crear venta ni cambiar stock. No compro resuelve parada sin reprogramar. Pendientes de visita se muestran en el recorrido con seleccion rapida. Fecha de hoy se calcula en Buenos Aires. Reintento conserva ID y resultado; version desactualizada pide revisar planilla. La fecha futura no crea otro reparto ni reasigna automaticamente; bandeja global del jefe entre recorridos aun pendiente.

Cobrar saldo pendiente consulta hasta 20 cargos del cliente asignado, con cantidad total y saldo completo; despues de cobrarlos/actualizar aparecen los siguientes. Incluye entregas, alquileres y apertura, tambien deuda rechazada. Seleccion de cargo, importe parcial/total y efectivo/transferencia declarados. Se guarda pago asociado al reparto de cobro, sin nueva venta ni movimiento de stock ni marcar entrega. Si otro pago cambio el saldo se rechaza hasta actualizar; no admite sobrepago. Pago completo resuelve solicitud pending como settled; rechazo historico se conserva aunque luego el saldo quede en cero.

Planilla ya atendida sigue disponible para estos cobros, con otra entrega deshabilitada. Operacion sin respuesta bloquea cambios y permite reintentar mismo ID. Error confirmado obliga a actualizar toda la planilla. Sin datos comerciales en almacenamiento local y sin modo offline/push de pagos.

Verificacion: 46 contratos/permisos y 13 controles UI/continuidad aprobados (59 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: alta de cliente del recorrido con aprobacion del jefe y bandeja global de visitas pendientes; siguen carga inicial del asistente, equipos/promociones, seguimiento compartido y rendicion/PDF. Etapa 4 aun no completa.

## Bandeja global de visitas pendientes del jefe - 24/10/2026

Migracion `20261024191505_owner_followup_queue.sql` aplicada por MCP: 31 migraciones y 45 tablas publicas con RLS. Nueva followup_resolutions registra decisiones atomicas/idempotentes; solo jefe de empresa lee/gestiona, sin escritura directa ni acceso anonimo. Helper global driver sigue bloqueado. Cero resoluciones reales al verificar; no se usaron pendientes, inventario, cuentas ni cobros reales para probar.

En Repartos y camion: Visitas pendientes de todos los repartos, paginadas de 20 con conteo total. Incluye origen abierto o cerrado, cliente, direccion, fecha prevista y nota de ausencia. Trasladar a otro reparto planned/active exige fecha de destino igual/posterior a la prevista y no anterior a hoy. Reutiliza parada pendiente existente o agrega/reactiva una elegible sin duplicar; rechaza destino ya atendido o con otro pendiente. No modifica carga ni asigna/acepta invitaciones. Revisar stock disponible si el destino ya salio.

Traslado desactiva operativamente la parada origen, preservando outcome absent, fecha, nota, eventos y movimientos. Tambien se admite origen cerrado: no cambia estado ni rendicion del recorrido. Resuelve en una transaccion con version e IDs estables; error revierte ambos lados y reintento conserva resultado. Cerrar pendiente con motivo exige nota, retira solo de la bandeja y no registra entrega ni cobro. No infiere resolucion por una venta de otra ruta. Una nueva ausencia en destino se vuelve pendiente propio.

Actualiza cada 30 segundos visible y al foco. No descarta campos escritos en una actualizacion sin cambios; fallo de lectura oculta acciones sin verificar. Respuesta desconocida bloquea cambios y ofrece el mismo reintento. Historial en eventos y followup_resolutions; todavia no hay pantalla dedicada de historial de decisiones.

Verificacion: 50 contratos/permisos y 3 comprobaciones de bandeja/reintento/motivo/error de lectura aprobados (53 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: alta de clientes del asistente durante recorrido con aprobacion del jefe. Siguen carga inicial del asistente, equipos/promociones, GPS compartido y rendicion/PDF.

## Alta de clientes propuesta por asistente - 24/10/2026

Migracion `20261024233446_customer_proposals.sql` aplicada por MCP: 32 migraciones y 46 tablas publicas con RLS. Nueva customer_proposals guarda solicitud y decision, autor, fechas y destino. Funciones dedicadas sin escritura directa/anonima; helper driver global no se reabre. Cero solicitudes reales al verificar. No se crearon clientes ni operaciones con datos reales para comprobar.

Asistente: Abrir reparto activo aceptado > Agregar cliente durante el reparto > Proponer nuevo cliente. Nombre, direccion, localidad, telefono, mapa/posicion actual o coordenadas opcionales. GPS solo por accion, no se consulta para probar. Proponer no crea cliente activo, parada, venta ni stock. Puede consultar sus propias ultimas 20 solicitudes de ese recorrido y la decision mientras conserve acceso. Datos no se guardan en almacenamiento local.

Jefe: Repartos y camion > Clientes propuestos para aprobar. Ve hasta 20 pendientes con total; al resolver aparecen otras. Aprobar exige elegir reparto planned/active, usando origen por defecto si sigue abierto. Si origen cerro, elegir otro. Crea cliente y parada atomicos con el ID de solicitud; no altera carga ni registra entrega. Rechazar exige motivo y no crea cliente. Coincidencia exacta de nombre/direccion con cliente activo frena aprobacion; no se fusiona ni reutiliza silenciosamente. Corregir datos requiere rechazar y reenviar, aun no hay editor de propuesta.

Reintentos de alta/decision conservan ID; IDs o parametros distintos no reinterpretan una decision previa. Solicitud pendiente identica del mismo asistente/recorrido se rechaza sin duplicar. Invitar/aprobar no habilita acceso a otra empresa o otro recorrido. Cliente aprobado aparece en destino al actualizar; listas ya abiertas de clientes del jefe pueden requerir Actualizar datos. Bandeja se consulta cada 30 segundos visible/al foco; sin push del sistema ni correo.

Verificacion: 55 contratos/permisos, 2 pruebas de solicitudes y 10 de atencion/invitaciones/continuidad aprobados (67 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: carga inicial unica desde asistente, equipos/promociones y seguimiento, luego rendicion/PDF. No considerar etapa 4 ni beta completas.

## Jefe como chofer de su propio reparto - 24/10/2026

Pedido explicito del usuario: habilitar jefe que reparte solo. Migracion `20261025000137_owner_self_route.sql` aplicada por MCP (version UTC del servidor; fecha local del trabajo 24/10). Estado: 33 migraciones, 46 tablas con RLS. Nuevo helper privado operational_trip_access permite asistente con aceptacion vigente o jefe activo/licencia vigente asignado a si mismo, en recorrido no cerrado. Solo seis contratos dedicados de lectura/entrega/visita/cobro usan ese helper. No cambia accepted_trip_access, has_role driver, invitaciones, propuestas ni permisos generales. No requiere asistente/invitacion propia. Sin operaciones reales para probar.

Repartos y camion > Mi reparto como chofer > Abrir mi reparto. Preparar eligiendo nombre del titular, seleccionar clientes y confirmar carga existente; despues mapa, paradas, entrega/retorno parcial, cobros de venta/cargos anteriores y ausencias reutilizan el flujo conectado. Lista solo repartos propios; cierre o licencia no vigente retira lectura. Guarda solo IDs de reparto/parada por usuario/empresa para retomar al volver a esta seccion. No guarda clientes, stock ni GPS localmente.

Deuda dejada por el jefe queda aprobada por el con actor y fecha, sin notificacion a si mismo. Deuda del asistente conserva revision pendiente y avisos al jefe. El formulario explica la diferencia. La propuesta de cliente para aprobacion no se ofrece al propio jefe: alta administrativa existente en Clientes. El resto del panel del jefe y asignacion a asistentes se conservan.

Verificacion: 58 contratos/permisos y 12 controles de apertura/retomar/cierre/invitaciones/atencion aprobados (70 total); compilacion correcta. MCP confirma gate propio y permisos anonimos bloqueados, sin habilitar helper driver global. QA visual/manual y circuito completo publicados pendientes; consulta publica HTTP inicial responde 200, version nueva aun por verificar despues de push. Cierre/rendicion/PDF y carga inicial del asistente aun pendientes; prioridad actual es prueba del jefe trabajando solo.
