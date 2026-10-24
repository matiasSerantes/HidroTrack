# Estado de HidroTrack real — 22/10/2026

Referencia para continuar desde otra PC. Codigo conectado no equivale a despliegue publico comprobado ni prueba completa con datos reales. No contiene credenciales.

Plan de trabajo detallado: [Orden recomendado de implementacion](ORDEN_IMPLEMENTACION.md).

## Comprobado

Supabase MCP, actualizado tras avance de etapa 3: 29 migraciones instaladas, 43 tablas publicas con RLS. RLS habilitado no prueba por si solo que cada permiso cumpla la ultima regla comercial. Sin solicitudes extraordinarias reales al comprobar. Ver [etapa 1](ETAPA_1_USUARIOS.md) y [etapa 2](ETAPA_2_INVITACIONES.md).

| Modulo | Base de datos | Pantalla real |
| --- | --- | --- |
| Ingreso, perfiles y roles | Auth/perfiles/membresias instalados | Login conectado; administrador y jefe conectados |
| Perfil personal del asistente | Reutiliza perfil propio y Auth existentes | Nombre, ID copiable y cambio de clave conectados en este avance; validacion con mocks, sin cambiar claves reales |
| Clientes y ubicacion | Instalada | Alta/edicion/planilla y punto de mapa conectados; dias/habitos conectados; pedidos extraordinarios conectados |
| Catalogo, stock y dispenser | Instalada, con libro auditado | Alta con stock, movimientos, asignaciones y devoluciones conectados; cambio atomico por modelo conectado; equipos por serie y reparacion pendientes |
| Promociones | Instalada, incluye permiso y aviso al jefe | Jefe conectado; oferta del asistente pendiente de su circuito real |
| Repartos y mapa operativo | Contratos basicos instalados | Preparacion/carga del jefe conectada; chofer abre mapa/paradas/stock aceptados y atiende clientes; ausencias y demas circuito pendientes |
| Entregas, cobros y deuda | Operaciones y reglas instaladas | Entrega/retorno parcial/cobro de venta del asistente y aprobacion de deuda conectados; cobros anteriores y demas circuito pendientes |
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
