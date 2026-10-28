# Papelera de seguridad

El jefe elimina clientes desde su planilla y recorridos desde Mis recorridos. La papelera es exclusiva del panel de superadministración: sección **Papelera** del menú principal y botón destacado **Abrir papelera**. Enlace directo: https://hidrotrack.matilegen.workers.dev/?admin=papelera . Elegir el registro, tocar **Recuperar** y confirmar. El jefe y los asistentes no pueden consultar sus copias ni recuperarlas por API.

La copia se registra en la misma transacción que la eliminación. Incluye empresa, tipo, nombre, fecha, autor y vencimiento a los 10 días exactos. Listado paginado de 50 registros; las fechas se muestran en horario argentino. Recuperar devuelve el mismo registro, sin duplicar ventas, cobros ni movimientos.

Un cliente recuperado vuelve a su estado anterior, pero no se agrega automáticamente a recorridos. Un recorrido planificado vuelve sin carga y exige nueva aceptación del asistente. Un recorrido finalizado permanece finalizado. Solo se recuperan paradas cuyos clientes sigan habilitados. Revisar fecha, chofer y clientes antes de utilizarlo. La recuperación queda auditada y admite reintentos; eliminar otra vez genera un nuevo registro de papelera.

La recuperación por interfaz y RPC vence a los 10 días exactos. La purga se ejecuta cada 10 minutos, en lotes de hasta 50 vencidos. Destruye la copia recuperable. Si no hay referencias, borra físicamente la fila; si existen movimientos o relaciones históricas, conserva una clave anónima y borra los datos identificatorios de la ficha. No elimina ni revierte ventas, cobros o movimientos de stock de repartos ya realizados. Los datos históricos de otras operaciones y respaldos no se purgan en cascada.

Un recorrido planificado no descuenta stock: la carga confirmada descuenta e inicia el reparto de forma atómica. Por eso eliminar un plan sin iniciar no necesita devolver ni inventar un movimiento. Una carga en curso impide eliminar. Un recorrido cerrado se elimina sin cambiar su rendición. El servicio de purga nace apagado hasta verificar la publicación; su estado de producción se registra en ESTADO_REAL.md.

Las reglas de recuperación de envases/equipos y de cierre de repartos siguen vigentes. No se purga una empresa ni se borran registros reales al instalar esta función. Las copias de respaldo existentes tienen su propio ciclo de conservación.
