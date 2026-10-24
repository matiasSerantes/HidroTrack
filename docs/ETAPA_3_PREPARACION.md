# Etapa 3: clientes y preparacion real

Actualizacion: 24/10/2026. Avance parcial; despliegue y circuito real completo aun por validar.

## Conectado

- Planilla: fecha de alta, dias de visita y cantidades habituales.
- Camion: referencia calculada por clientes activos del recorrido, extras/faltantes y confirmacion unica existente.
- Planilla: generar visita extraordinaria con fecha, productos, cantidades y nota.
- Lista de pendientes en planilla y Repartos y camion, con filtros y paginas de 20 registros.
- Asignar pedido pendiente a reparto planned/active de la fecha solicitada. Agrega/reactiva parada si hace falta, sin duplicar una existente; rechaza paradas ya resueltas.
- Pedido extraordinario asignado reemplaza las cantidades habituales de ese cliente en esa visita. No se suma dos veces. Una cancelacion deja de aportar esa referencia.
- Cancelar conserva solicitud, eventos, parada y carga. No retira automaticamente al cliente del recorrido.

Se admite un pedido extraordinario no cancelado por cliente/fecha. Para corregirlo, cancelar y generar otro; no hay edicion destructiva del pedido. Si un camion ya esta activo, asignar un pedido no amplia su carga: jefe debe revisar existencias disponibles.

## Base y permisos

Migracion `20261024134653_extra_visits.sql` aplicada por MCP: 26 migraciones y 40 tablas con RLS tras el cambio de dispenser.

extra_visit_requests y extra_visit_events son de lectura del jefe de su empresa. Solo RPC autorizados crean/asignan/cancelan; sin escritura directa ni ejecucion anonima. Crear no genera venta, entrega o movimiento. Asignar usa el contrato existente de edicion de parada del jefe. Reintentos con IDs estables y eventos conservados.

Clientes inactivos o en futura baja no pueden recibir estos pedidos. Fecha debe ser hoy o futura; reparto debe coincidir con la fecha. Productos se validan dentro de la empresa. Helper general de acceso operativo driver permanece bloqueado.

## Verificacion

44 comprobaciones dirigidas aprobadas: contratos de vinculos/invitaciones y pedidos, aislamiento, idempotencia, asignacion sin duplicados, cancelacion sin perder parada, fecha incorrecta, formulario, carga y referencia sin duplicar habitual/extraordinario. Compilacion final registrada en notas. MCP confirma permisos y cero solicitudes reales creadas para comprobar.

Prueba general y visual/publicacion pendientes segun prioridad del usuario. Sin cambios de stock, cuentas o contrasenas reales en este avance.

## Pendiente

- La solicitud asignada indica organizacion, no atencion completada. Vincular resultado, entrega/cobro y pendientes al circuito real del chofer en etapa 4.
- Reasignacion, edicion y cierre del pedido tras atencion requieren su contrato posterior; no simularlos como terminados.
- Cambio de equipos por serie y reparacion/retiro completo. Sugerencia y costo de carga ya conectados; ver actualizacion inferior.
- Verificacion en movil/PC y entre dispositivos, ademas de la suite general final.

La demo conserva datos y operaciones simulados independientes; estos puntos describen pantallas conectadas a Supabase.

## Cambio real de dispenser por modelo - 24/10/2026

Migracion `20261024140721_dispenser_exchange.sql` aplicada por MCP. Estado comprobado: 26 migraciones y 40 tablas publicas con RLS. Desde la planilla del cliente, Cambiar dispenser registra retiro y reemplazo en una transaccion, desde deposito o camion activo autorizado. Conserva contrato, modalidad, cuota y fecha inicial del alquiler. El retirado bueno vuelve al origen; roto significa baja definitiva del inventario activo, con fecha y responsable. No representa reparacion recuperable.

Reintentos idempotentes, disponibilidad previa al retiro y fechas coherentes; fallo revierte ambos movimientos. Historial de cambios visible al jefe. Equipos individualizados por serie y reparaciones siguen pendientes. Rama operativa del asistente permanece bloqueada hasta etapa 4. Sin cambios con stock real para probar ni ajustes de cuentas/claves.

Verificacion: 25 comprobaciones dirigidas de contratos y permisos y 2 del formulario aprobadas; compilacion correcta. MCP confirma cero cambios reales de dispenser, sin escritura directa ni ejecucion anonima. Suite general, prueba visual movil/PC y despliegue publico pendientes.

## Costo y detalle historico de carga real - 24/10/2026

Migracion `20261024183740_load_cost_snapshots.sql` aplicada por MCP: 27 migraciones y 42 tablas publicas con RLS. Nuevas tablas filling_cost_settings e inventory_load_snapshots, solo lectura del jefe de su empresa; escritura mediante RPC, sin acceso anonimo. No se modificaron cuentas ni existencias reales para comprobar; ambas tablas quedaron sin registros reales al verificar.

En Catalogo, Configuracion del costo de llenado permite activar el control y seleccionar productos retornables con costo por unidad, independiente del precio de venta. Desactivado por defecto; no aplica a dispenser. En carga se anticipa el gasto parcial solo del faltante a rellenar. Al confirmar, inventory_confirm_load registra carga y detalle juntos: nombres, sugerencia calculada en servidor, cantidades cargadas, extras/faltantes, rellenados y costo vigente. Pedido extraordinario reemplaza habitual sin doble suma. Si falla, no queda relleno o carga parcial; reintentar conserva el resultado original.

Repartos muestra las ultimas diez cargas con detalle historico. Cambiar nombre, preferencias o costos despues no altera ese registro. Las cargas anteriores o hechas mediante contratos antiguos no se reconstruyen: pueden existir sin este detalle. Costo desactivado o producto sin costo no significa ganancia conocida; el total solo incluye llenado configurado y excluye otros gastos. Graficos y resultado real del reparto siguen pendientes del circuito de ventas/cobros.

Verificacion: 30 contratos/permisos, 2 controles de configuracion/historial y 4 de sugerencia/preview aprobados (36 en total); compilacion correcta. Suite general y QA visual/publicacion movil-PC pendientes. Siguiente paso: circuito operativo real del asistente con permisos por reparto aceptado, entrega/devolucion y cobro; conservar pendientes de equipos por serie y reparacion.
