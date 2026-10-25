# Orden recomendado para completar HidroTrack real

Fecha: 22/10/2026. Estado: propuesta de trabajo; ninguna etapa pendiente se considera terminada por aparecer en este documento.

Referencia del punto de partida: [Estado real](ESTADO_REAL.md). La base ya tiene contratos importantes; cada etapa debe reutilizarlos y extender solo lo necesario. No hacer primero todas las tablas y dejar las pantallas para el final: cerrar cada circuito con servidor, interfaz y pruebas.

## 1. Identidad del asistente y lista de choferes

Avance 22/10: codigo y contratos principales instalados; bloqueo temporal autorizado e instalado; etapa aun abierta por SMTP y validacion. Ver [detalle y bloqueo concreto](ETAPA_1_USUARIOS.md).

- Registro propio verificado y recuperacion de cuenta. Mantener nombre, ID estable y cambio de clave ya conectados.
- Vincular/desvincular por ID desde el jefe, sin recrear cuentas; un asistente puede trabajar con varios jefes.
- Aplicar cupos en servidor: basico 1, intermedio 3, superior ilimitado. Definir representacion y transiciones sin alterar licencias existentes arbitrariamente.
- Sin reparto habilitado, mostrar solo cuenta personal y datos minimos de sus vinculos.

Cierre: dos jefes pueden vincular la misma cuenta sin mezclar informacion; altas simultaneas no superan el cupo.

## 2. Invitacion y permisos del reparto

Avance 22/10: invitacion/respuesta/revocacion y resumen de lectura limitada instalados; las operaciones del chofer siguen bloqueadas hasta etapas 3/4. Ver [detalle de etapa 2](ETAPA_2_INVITACIONES.md). Validacion completa y publicacion pendientes.

- Jefe asigna; asistente ve remitente y nombre del reparto, acepta o rechaza.
- Solo la aceptacion vigente habilita clientes, carga, cobros y ubicacion de ese reparto.
- Revisar todas las politicas y funciones relacionadas; revocar o cerrar debe retirar acceso operativo.

Cierre: pruebas de aceptar, rechazar, no responder, revocar y cerrar; otra cuenta/empresa no puede leer ni operar esos datos. Esta etapa bloquea habilitar la pantalla real de recorrido.

## 3. Clientes, inventario y preparacion

Avance 24/10: visitas extraordinarias reales con productos/fecha, pendientes y asignacion; sustituyen habitual en referencia de carga para evitar duplicados. Ver [detalle y pendientes](ETAPA_3_PREPARACION.md).

Avance 24/10: carga sugerida conectada a cantidades habituales por cliente del recorrido, extras/faltantes visibles y confirmacion unica existente. Comparacion historica sugerido/extras y resto de la etapa pendientes.

Avance 22/10 parcial: dias de visita y cantidades habituales conectados en planilla, fecha de alta visible. Compilacion comprobada; guardado manual/real y demas puntos de etapa pendientes.

- Completar dias de visita, cantidades habituales, ubicacion y solicitud de visita extraordinaria.
- Verificar stock real disponible, llenos/vacios, equipos con clientes y roturas con fecha/responsable.
- Completar reparacion/retiro y cambio atomico de dispenser, conservando el historial y las condiciones del alquiler.
- Crear recorrido con carga recomendada; permitir extras y rellenar/cargar juntos en una operacion unica.
- Guardar desde aqui cantidades y costo historico de lo rellenado durante la carga, si la opcion esta activa; los graficos pueden esperar.

Cierre: preparar y cargar un reparto una sola vez, sin duplicados ni stock negativo; las unidades quedan trazables. Datos iniciales ya cargados se conservan.

## 4. Recorrido real del chofer

- Abrir reparto aceptado y continuar donde quedo al reabrir la pagina.
- Mapa y planilla; entregar, registrar devolucion parcial y actualizar saldo de envases y stock del camion.
- Calcular total, cobrar por medio de pago y tramitar deuda con aviso/aprobacion del jefe. Si la rechaza, el importe sigue pendiente de cobro.
- Ausente: volver mas tarde u otro dia. Registrar nuevos clientes durante el recorrido.
- Manejar reintentos y mala conexion sin duplicar entregas ni cobros; mostrar claramente lo pendiente de guardar.

Cierre: recorrido completo desde un celular con entregas, devoluciones y cobros correctos, incluyendo recarga de pagina y reintento.

## 5. Excepciones y seguimiento del jefe

- Alquiler mensual desde la entrega, cobro y seguimiento.
- Futura baja bloquea nuevas entregas y avisa recuperacion pendiente; no aprobar baja definitiva hasta devolver lo prestado.
- Promociones del asistente solo con permiso del jefe y notificacion; conversion o recuperacion sin perder inventario.
- Cambios de dispenser dentro del recorrido, solicitudes/aprobaciones y agregar/quitar clientes del reparto activo.
- Notificaciones y ubicacion compartida mientras corresponde al reparto autorizado.

Cierre: el jefe puede resolver cada pendiente y ambos dispositivos reflejan el resultado sin mezclar empresas.

## 6. Finalizacion, rendicion y PDF

- Conciliar carga inicial/final, llenos, vacios, dispenser entregados/cambiados/devueltos y diferencias.
- Separar efectivo a devolver, transferencias, otros cobros y deuda; finalizar con control del jefe.
- Generar PDF para ambos desde un cierre historico estable, con acceso autorizado y sin abrir la cartera general del jefe.
- Permitir otro reparto del dia solo despues del cierre correspondiente.

Cierre: totales y existencias coinciden con movimientos; PDF reproducible aunque luego cambien precios o productos.

## 7. Panel, opciones y terminacion visual

- Graficos de ingresos, gastos y resultado, mejor dia y existencias; distinguir importes cobrados, facturados y pendientes.
- Resultado usa costos historicos registrados; indicar cuando faltan costos, sin inventar ganancia.
- Repartos activos con avance y clientes nuevos.
- Foto privada de perfil y terminacion visual del asistente; revisar autenticador real y opciones de cuenta.
- Mantener celestes, botones visibles y buen uso en PC. La usabilidad movil se verifica en cada etapa, no se posterga hasta esta.

Cierre: cifras explicables desde sus movimientos y pantallas legibles en celular/PC.

## 8. Validacion de beta y publicacion

- Prueba completa con jefe y dos asistentes, incluyendo otra empresa, permisos, rechazos y revocacion.
- Revisar concurrencia, desconexion, reintentos, backup/recuperacion y seguridad completa. Los permisos basicos son obligatorios desde las primeras etapas.
- Verificar compilacion, migraciones y despliegue; probar la web publicada en celular y PC.
- Confirmar que demo y datos reales se distinguen y no se mezclan.

Cierre: circuito real de principio a fin aprobado y limitaciones conocidas documentadas antes de llamar a la version beta operativa.

## Despues, por decision actual

Optimizacion automatica de ruta corta/tiempos/distancias. Mantener apertura en app de navegacion; no presentar la linea del mapa como ruta optimizada.

## Regla para continuar desde otra PC

Empezar por la primera etapa pendiente. Antes de cada cambio, registrar la idea; al terminar, actualizar estado, verificar, hacer commit y push. Antes de una migracion real, detallar que cambia, su impacto y la autorizacion aplicable. Este plan no modifica Supabase ni autoriza por si solo operaciones remotas.

Actualizacion 22/10: bloqueo temporal autorizado explicitamente e instalado como 20261022130128_assistant_waiting_access.sql; 23 migraciones, 35 tablas con RLS. Referencias anteriores al SQL pendiente son historicas. SMTP a cargo del usuario, aun sin validar.

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

## Cierre conciliado del reparto propio del jefe - 24/10/2026

Migracion `20261025001926_owner_trip_close.sql` aplicada por MCP: 34 migraciones y 47 tablas con RLS. Nueva owner_trip_close_snapshots conserva resumen inmutable de cierre. Funciones owner_preview_trip_close, owner_finish_self_trip y owner_self_close_history, solo jefe asignado a si mismo con licencia vigente. No abre helper global driver ni cierre del asistente. Cero cierres nuevos reales al verificar; sin tocar stock, posiciones, cuentas ni operaciones reales para probar.

Desde Abrir mi reparto > Finalizar mi reparto: muestra ventas registradas, efectivo y transferencias del recorrido (incluye cobros de deudas anteriores), conteo de llenos/unidades y vacios de regreso. Exige confirmar revision fisica. Resumen esperado se calcula en servidor; si hubo movimientos/cobros/cambios de paradas desde la consulta, pide actualizar. Caja y stock deben coincidir; diferencias se concilian en Stock antes de cerrar. No transforma faltantes en ajustes automaticos.

Cierre atomico reutiliza inventory_submit_trip, trip_closures aprobada e inventory_post close, devuelve stock al deposito y libera la siguiente carga del mismo chofer. No crea ventas, duplica cobros, manda autoavisos ni borra driver_positions. Permite recuperar estado submitted antiguo sin rendicion; si ya existe una rendicion submitted debe resolverse por el circuito previo antes de otro cierre. No reemplaza ni reescribe una rendicion existente.

Requiere resultado de todas las paradas activas (atencion, ausencia o no compro). Ausencias se conservan en bandeja global aunque origen cierre. Equipos por modelo se cuentan; equipos identificados por serie aun en camion deben volver desde Catalogo antes de cerrar. Se retira el boton antiguo de finalizar/regreso para recorridos propios, para evitar salida que no concilia caja. Circuito de cierre de asistentes sigue pendiente de integrar.

Respuesta desconocida conserva ID y conteo y bloquea la navegacion/actualizacion del recorrido hasta reintento. Error SQL no deja cierre parcial. Mis ultimos diez cierres muestra carga inicial y regreso con nombres/importes congelados. Para cargas antiguas sin snapshot de preparacion, cantidades iniciales vienen del libro y nombres se fijan al cerrar, sin afirmar nombre historico al cargar. PDF todavia pendiente.

Verificacion: 62 contratos/permisos y 6 controles de formulario/apertura/reintento/cierre aprobados (68 total), compilacion correcta. Incluye retorno al deposito, siguiente carga, pagos previos sin nueva venta, snapshot inmutable, diferencias y resumen obsoleto con rollback, preservacion de posicion y permisos. Publicacion nueva y QA visual/manual autenticada pendientes de comprobar; suite general al final segun preferencia del usuario.


## 2026-10-25 - Alta real de jefes con prueba gratuita

Registro conectado en /?registro=jefe: crear cuenta de jefe, confirmar correo y Crear mi empresa. Prueba gratuita de 30 dias desde el alta de empresa, plan basico con 1 asistente. Luego administracion puede cambiar la licencia conservando empresa y datos. No incluye cobro automatico.

Migracion 20261025044949_owner_signup.sql aplicada por MCP. Estado comprobado: 35 migraciones y 49 tablas publicas con RLS; politica auto_trial=true, trial_days=30. Nuevas owner_signup_policy y owner_registrations. Alta transaccional verificada por Auth, solo empresa propia; metadatos no conceden privilegios. Reintento reutiliza empresa sin duplicar ni renovar prueba. Licencias existentes intactas. Cero altas reales durante verificacion.

Verificacion local: 67 contratos SQL/permisos y 9 pruebas de acceso/formulario aprobados; build correcto. Publicacion pendiente de verificar tras push. Prueba manual autenticada de correo, alta y uso movil/PC pendiente; no se enviaron correos ni crearon cuentas reales para probar.

## 2026-10-25 - PDF conectado del cierre propio

Repartos y camion > Ver mis ultimos cierres > abrir cierre > Descargar PDF del cierre. Comprobante interno generado localmente desde el snapshot autorizado, previa nueva consulta RPC owner_self_close_history. Incluye carga inicial, regreso listo/vacio por producto/modelo, ventas, efectivo, transferencias declaradas, fecha/ID y nota. No confunde cobros anteriores con ventas ni presenta ganancia neta o conciliacion bancaria. Identifica empresa por ID; no inventa nombre historico no guardado. Cambios/series de dispenser no estan desglosados en este snapshot y se indica en el PDF.

Sin migraciones ni escritura remota: base conserva 35 migraciones y 49 tablas con RLS. Descarga no crea cierres, pagos ni movimientos, no envia correos, no persiste datos en localStorage. Error permite reintento; salir o cambiar empresa durante consulta cancela descarga antigua. Generador compartido con demo, que conserva marca DEMO y sus datos separados; modulo real se carga al solicitar PDF.

Verificacion: 14 pruebas dirigidas de cierre/descarga/PDF/demo aprobadas y build correcto. PDF ficticio normal de una pagina y prueba extensa de ocho paginas leidos con pypdf, renderizados y revisados visualmente; sin texto fuera de margenes. Archivos de prueba y herramientas de render fuera de Git. Publicacion pendiente tras push. Prueba manual de descarga en telefono/PC autenticados pendiente. Cierre/PDF del asistente y desglose historico de cambios de dispenser siguen pendientes.

## 2026-10-25 - Carga inicial real del asistente

Asistente acepta invitacion > Abrir reparto preparado > Iniciar reparto / Carga del camion. Consulta sugerencia por habitos o pedido extraordinario asignado, modifica cantidades y extras, elige rellenar faltantes y confirma carga fisica. Fecha actual de Buenos Aires del servidor. Una sola carga por reparto; no se edita al activar. Si jefe ya cargo, asistente ve stock y no otro formulario.

Migracion 20261025052354_assistant_initial_load.sql aplicada por MCP: 36 migraciones, 49 tablas con RLS. assistant_load_options y assistant_confirm_load requieren invitacion aceptada vigente, chofer asignado y licencia activa. No abren has_role driver ni RPC generales. Solo lista necesaria para preparar carga: nombre/unidad/modelo/existencias/sugerencia; no precios/costos ni cartera ajena. Libro de stock, rellenado necesario, estado activo y snapshot se guardan en una transaccion. Usa existencias disponibles y costos del jefe en servidor, conserva historial/sugerencia/extras/costo. No se probaron operaciones remotas con inventario real.

ID y datos identicos al reintentar; otra carga o salida sin cierre/aprobacion anterior se bloquea. Respuesta desconocida congela formulario y actualizaciones de recorrido para no perder reintento aunque servidor ya haya activado. Confirmacion muestra recorrido activo y Stock del camion. Formularios celestes, cantidades tactiles y adaptacion movil/PC; revision visual manual autenticada pendiente.

Verificacion: 71 contratos SQL/permisos y 13 controles de carga/invitacion/recorrido aprobados (84 total), compilacion correcta. Incluye stock insuficiente con rollback, costos privados, permisos y reintento ante respuesta perdida. Publicacion pendiente tras push. Cierre/aprobacion/PDF del asistente es el siguiente incremento.

## 2026-10-25 - Rendicion y aprobacion real de asistentes

Asistente: Abrir reparto activo > Terminar y rendir reparto > contar regreso, efectivo y transferencias > Enviar rendicion al jefe. Se presenta, sin devolver stock ni permitir otra salida. Jefe: Repartos y camion > Rendiciones de asistentes > revisar > aprobar y cerrar o devolver para corregir con motivo. Nueva presentacion despues de observar usa nuevo ID y conserva la anterior. Se retira el viejo boton de finalizar sin rendicion de la pantalla del jefe.

Migracion 20261025053209_assistant_trip_close.sql aplicada por MCP: 37 migraciones, 50 tablas publicas con RLS. Nueva assistant_trip_close_snapshots conserva solicitud original y resumen compartido; snapshot solo cambia al registrar decision. Preview del asistente elimina costos privados de carga. Nuevas RPC dedicadas, sin habilitar helper driver global. La RPC existente trip_review_close pasa por conciliacion de snapshots nuevos; su implementacion anterior queda privada y sin EXECUTE de authenticated para compatibilidad de registros viejos.

Requiere invitacion aceptada, reparto activo, licencia y resultados de todas las visitas. Carga, nombres, conteo y caja se verifican en servidor. Las diferencias requieren nota; se pueden presentar para revision, pero no aprobar hasta corregir. Cambios desde la presentacion obligan a devolver y presentar de nuevo. Aprobar devuelve stock una sola vez y conserva ultima posicion GPS historica; observar reabre reparto sin mover stock. Avisa al jefe dentro de la app, sin email/push externo. Cantidades y montos guardados no son ganancia neta ni conciliacion bancaria.

Respuesta desconocida conserva conteo/decision e ID y bloquea navegacion/refresco que lo descartaria. Reintento conocido del propio envio despues de cerrado/revocado devuelve solamente ID de confirmacion, sin reabrir ni leer datos. No se tocaron stock, pagos, cuentas o cierres reales para probar. Cierre del jefe propio y licencias existentes conservados.

Verificacion: 76 contratos SQL/permisos y 19 controles de formularios/invitaciones/carga/cierre aprobados (95 total); compilacion correcta. QA manual autenticada movil/PC pendiente. Publicacion pendiente tras push. Proximo incremento: PDF de este cierre para ambos y acceso historico limitado del asistente; no confundirlo con PDF propio del jefe ya publicado. Desglose historico de cambios de dispenser pendiente.

## 2026-10-25 - PDF compartido de cierre aprobado

Jefe: Repartos y camion > Rendiciones de asistentes > abrir Aprobada > Descargar PDF del jefe. Asistente: debajo de invitaciones, Mis comprobantes > Ver mis comprobantes > Descargar mi PDF. Ultimos diez cierres propios aprobados. Cierre pendiente o devuelto no genera comprobante aprobado. Sin envio automatico de mensajes ni email.

Migracion 20261025163405_shared_close_receipts.sql aplicada por MCP: 38 migraciones, 50 tablas con RLS. Nuevas consultas assistant_close_receipts y trip_close_receipt verifican usuario confirmado y actor del trabajo o jefe de esa empresa con licencia vigente. Asistente conserva comprobante de su propio trabajo aun sin vinculo/licencia/recorrido abierto, sin obtener acceso a clientes, mapas, stock ni otras personas. Proyeccion del servidor excluye ventas, transferencias, costos privados y revisiones internas; copia del jefe incluye ventas y cobros por medio.

Ambas copias identifican empresa/repartidor/reparto/fecha, carga inicial, regreso confirmado y efectivo validado, notas y aprobacion. Nombres y cantidades provienen del snapshot, sin recalcular con datos actuales. No es factura fiscal ni calculo de ganancia neta; desglose de cambios/series de dispenser pendiente. Descarga revalida por ID y rol en servidor; salir o cambiar contexto cancela respuesta antigua. Generacion local bajo demanda, sin escribir movimientos ni guardar PDF/datos de negocio en localStorage.

Correccion adicional: reintento confirmado solo con ID tras cierre/revocacion libera el formulario sin intentar mostrar un resumen incompleto. No se alteraron cierres, inventario o cuentas reales para probar.

Verificacion: 80 contratos SQL/permisos, 3 de PDF y 16 controles de acceso/descarga/cierre/invitaciones aprobados (99 total). PDFs ficticios de ambas copias y caso extenso de seis paginas leidos con pypdf, renderizados y revisados sin desbordes. Archivos y herramientas de QA fuera de Git. Compilacion final correcta; publicacion por verificar. Prueba manual autenticada movil/PC del circuito completo pendiente; siguiente: esa validacion y completar detalle de cambios de dispenser.

## 2026-10-25 - Regresiones de suite completa corregidas

Claves React de paneles hermanos de Repartos y camion ahora identifican tipo de panel y empresa; evita reconciliacion ambigua y mezcla de estado. Corregidos textos de carga/stock con acentos reemplazados por signos de pregunta. Habitos del cliente solo se consultan despues de lectura principal verificada, sin alertas secundarias antes de cargar ficha; actualizacion de disponibilidad respeta operaciones de habitos/pedidos en curso. Retry de ficha despues de desconexion conserva comprobacion antes de permitir cantidades.

Pruebas actualizadas al contrato vigente inventory_confirm_load (relleno opcional, snapshot, IDs estables) y al driver_plan custom de licencias existentes. Mocks de consultas de bandejas no simulan escrituras. Se conservaron verificaciones de empresa, cantidades, reintento identico y retiro del formulario tras confirmar. Nueva comprobacion de recuperacion de ficha y ausencia de advertencias de claves duplicadas.

Suite completa: 52 archivos, 412 pruebas aprobadas, cero fallos y cero avisos de claves duplicadas. Compilacion final correcta; publicacion por verificar. Sin migraciones ni cambios en inventario/cuentas/cierres reales: base mantiene 38 migraciones y 50 tablas con RLS. QA visual autenticada movil/PC sigue pendiente por bloqueo de Computer Use al no poder verificar la URL de Chrome; no se presenta esta suite local como prueba visual ni recorrido real completo.

## 2026-10-25 - Detalle de dispenser conectado al cierre

Proximas presentaciones/cierres guardan equipment_detail version 1 con operaciones vinculadas explicitamente al reparto: asignaciones por modelo, cambios con reemplazo y estado retirado, roturas/retiros de camion, y cargas/entregas/regresos/traslados de equipos por serie. Cambios excluyen sus dos movimientos componentes para no duplicarlos como nueva asignacion o retiro adicional. Equipo roto no suma disponibilidad. No infiere que el equipo entregado sea de fabrica nuevo ni atribuye devoluciones del deposito al camion solo por fecha/cliente.

Migracion 20261025170559_equipment_close_detail.sql aplicada por MCP: 39 migraciones, 50 tablas con RLS. Helper privado sin EXECUTE directo del usuario, quote propio/asistente incorpora el detalle y proyeccion del recibo propio lo comparte sin cliente, alquiler, responsable, costos ni GPS. Nuevos cambios despues de presentar impiden aprobar sin revisar; rendiciones anteriores sin equipment_detail mantienen sus reglas originales. No se actualizan snapshots antiguos ni saldos/contratos; etiquetas por modelo se congelan al presentar/cerrar, no se afirma reconstruir nombres al dia de un movimiento anterior.

Pantalla de rendicion/historial y PDFs propio del jefe y compartido muestran movimientos sin sumarlos de nuevo al regreso. Comprobantes anteriores conservan aviso de no contener desglose, sin inventar eventos. Se mejora paginacion comun de PDF para que encabezados finales acompanen su contenido. Copias ficticias del jefe (dos paginas) y asistente (una pagina) parseadas y renderizadas sin cortes, incluido titulo Observaciones junto a su texto.

Verificacion final: suite completa 53 archivos, 422 pruebas aprobadas. Incluye cambio bueno/roto, no duplicacion de reemplazo, serie/carga/regreso, snapshot congelado, proyeccion sin datos privados y aprobacion compatible de rendicion antigua. Compilacion final correcta; publicacion pendiente de verificar. Sin movimientos, cambios de dispenser o cierres reales para probar. QA manual autenticada movil/PC aun pendiente por bloqueo de control de Chrome.
