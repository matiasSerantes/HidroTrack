# Estado de HidroTrack real — 22/10/2026

Referencia para continuar desde otra PC. Codigo conectado no equivale a despliegue publico comprobado ni prueba completa con datos reales. No contiene credenciales.

Plan de trabajo detallado: [Orden recomendado de implementacion](ORDEN_IMPLEMENTACION.md).

## Comprobado

Supabase MCP, actualizado tras avance de etapa 3: 33 migraciones instaladas, 46 tablas publicas con RLS. RLS habilitado no prueba por si solo que cada permiso cumpla la ultima regla comercial. Sin solicitudes extraordinarias reales al comprobar. Ver [etapa 1](ETAPA_1_USUARIOS.md) y [etapa 2](ETAPA_2_INVITACIONES.md).

| Modulo | Base de datos | Pantalla real |
| --- | --- | --- |
| Ingreso, perfiles y roles | Auth/perfiles/membresias instalados | Login conectado; administrador y jefe conectados |
| Perfil personal del asistente | Reutiliza perfil propio y Auth existentes | Nombre, ID copiable y cambio de clave conectados en este avance; validacion con mocks, sin cambiar claves reales |
| Clientes y ubicacion | Instalada | Alta/edicion/planilla y punto de mapa conectados; dias/habitos y pedidos extraordinarios conectados; alta propuesta por asistente con aprobacion conectada |
| Catalogo, stock y dispenser | Instalada, con libro auditado | Alta con stock, movimientos, asignaciones y devoluciones conectados; cambio atomico por modelo conectado; equipos por serie y reparacion pendientes |
| Promociones | Instalada, incluye permiso y aviso al jefe | Jefe conectado; oferta del asistente pendiente de su circuito real |
| Repartos y mapa operativo | Contratos basicos instalados | Preparacion/carga del jefe conectada; asistente aceptado o jefe asignado a si mismo abre mapa/paradas/stock, atiende y registra ausencias; jefe traslada/cierra pendientes; demas circuito pendiente |
| Entregas, cobros y deuda | Operaciones y reglas instaladas | Entrega/retorno parcial/cobros de venta y deuda anterior, aprobacion de deuda y ausencias conectados; demas circuito pendiente |
| Alquileres y futura baja | Contratos instalados | Facturacion/cobro operativo, recuperacion y aprobacion completas pendientes |
| Rendicion y PDF | Cierre/conciliacion instalados | Circuito real y PDF autenticado pendientes |

## Que falta de usuarios y permisos — prioridad inmediata

1. Registro propio y recuperacion conectados sin empresa/licencia/rol administrativo; falta SMTP y prueba real de entrega de correos.
2. Lista por ID, agregar/quitar y cupos atomicos instalados, separados por empresa. Identidad multiempresa preservada. Falta validacion publica completa.
3. Invitacion de reparto instalada: destinatario acepta/rechaza, jefe revoca, resumen de clientes solo al aceptar. Sin aceptar o al revocar/cerrar no hay resumen. Operaciones del chofer aun no habilitadas.
4. Revisar RLS/RPC de inventario, cartera, cobros, ubicacion y promociones para exigir aceptacion vigente, no solo asignacion. El helper actual inventory_trip_access aun no exige aceptacion: no habilitar rutas reales hasta corregir todos los caminos. Bloqueo temporal de rama driver aplicado tras autorizacion explicita: asistentes conservan acceso basico hasta completar etapa 2.
5. Foto con almacenamiento privado y permisos; recuperacion de cuenta y autenticador real. Cambio de clave personal ya tiene formulario Auth, con confirmacion y manejo de reautenticacion, pero no se probaron claves reales para no alterarlas.
6. Planes basico/intermedio/superior instalados con cupos 1/3/ilimitado y edicion administrativa. Licencias existentes conservadas como custom; altas administrativas conservan cupo personalizado hasta editar plan. Gestion comercial/cobro de licencias pendiente.

El ID mostrado en cuenta real usa HT seguido de la identidad UUID estable. No es credencial ni concede acceso por si mismo. Vinculacion por ID instalada; no confundirla con invitacion o aceptacion de reparto.

## Que falta de base de datos adicional

- Vinculos e invitaciones auditados/idempotentes instalados; resumen limitado autorizado. Falta revision/conexion de permisos para cada operacion del chofer en etapa 4.
- Preferencias, dias, visitas extraordinarias y cambio atomico por modelo conectados; falta completar operacion del chofer y equipos individualizados.
- Snapshot de carga recomendada/extras y costo historico de rellenados al cargar conectados; consultas de resultado mensual y otros gastos pendientes.
- Reparacion/baja de unidades danadas pendientes y contrato completo de sustitucion de equipos, sin devolver uno y asignar otro como dos operaciones independientes del navegador.
- PDF real desde cierre historico con permisos y versionado; avisos en vivo y seguimiento autorizado entre dispositivos.

Varias tablas/funciones base ya existen; estos puntos son extensiones e integracion, no una reconstruccion total. SQL bajo supabase/migrations y verificadores bajo supabase/tests son la referencia.

## Orden para llegar a beta operativa

1. Vínculo jefe-asistente e invitacion aceptada, protegidos en servidor.
2. Abrir recorrido real, carga unica, clientes/mapa, entrega/devolucion y cobro.
3. Aprobaciones, ausencia/pendientes, futura baja y cambios de dispenser.
4. Rendicion conciliada, aprobacion del jefe y PDF para ambos segun acceso vigente.
5. Costos, graficos y resto de opciones.
6. Prueba completa con las cuentas aisladas: dos asistentes, dos empresas, rechazo/revocacion, concurrencia, mala conexion y movil/PC. Revision de seguridad, backup/recuperacion y verificacion de despliegue antes de llamarlo beta operativa.

Optimizacion de orden de ruta/tiempo/distancia pospuesta por el usuario. Abrir otra app ya existe en demo y para un destino de planilla real; no equivale a recorrido optimizado ni a mapa operativo real del chofer.

En la revision inicial no se aplicaron migraciones. En el avance posterior se instalo assistant_links y se corrigieron destinos Auth. No se alteraron cantidades, contrasenas ni vinculos de usuarios para comprobarlo. Ver ETAPA_1_USUARIOS.md para el bloqueo temporal autorizado e instalado.

Actualizacion SMTP 22/10: el usuario configuro Gmail. Consulta de lectura confirma host/puerto, remitente/usuario esperados y URLs correctas. Configuracion verificada; autenticacion/envio, recepcion y recuperacion completa aun pendientes. Las menciones previas a SMTP sin configurar son historicas. Sin secretos en Git.

Evidencia posterior del usuario (22/10): correo de recuperacion recibido en Recibidos desde HidroTrack. Envio/recepcion confirmados; enlace, cambio de clave y nuevo ingreso pendientes. Plantilla actual en ingles.

Recuperacion 22/10: usuario confirma guardado de nueva clave y entrada manual posterior. Se mejora pantalla real con marca/celestes y entrada automatica solo al confirmar Auth. Prueba final del nuevo diseno publicado pendiente.

Etapa 3 parcial (22/10): planilla con dias y cantidades habituales conectadas a tablas existentes y fecha de alta visible. Sin cambio de stock ni nuevas migraciones. Carga recomendada, visitas extraordinarias y comprobacion real/manual pendientes.

Carga sugerida real (24/10): sumar preferencias de clientes activos del reparto sin futura baja; aplicar manualmente y ajustar extras/faltantes antes de la carga unica. Sin nueva migracion ni movimientos de inventario para comprobar. 23 pruebas dirigidas y build correctos. Snapshot historico de sugerido/extras y visitas extraordinarias pendientes.

Visitas extraordinarias (24/10): conectadas con pendientes, asignacion por fecha y cancelacion auditada. Sustituyen habitual en sugerencia de carga; no registran entrega ni cobro. Ver ETAPA_3_PREPARACION.md para pendientes de etapa 3 y operacion del chofer.

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

Publicacion del jefe verificada (24/10 local): URL publica responde HTTP 200 y el modulo servido AccountWorkspace-CvFJT9Sx.js incluye Abrir mi reparto despues del push e7bdea8. Se comprobaron recursos publicos, sin iniciar sesion ni crear entregas. Esto confirma publicacion del codigo; no sustituye QA visual/manual autenticada en movil/PC ni el cierre completo. Uso: Repartos y camion, preparar con nombre del propio jefe, confirmar carga unica y Abrir mi reparto.
