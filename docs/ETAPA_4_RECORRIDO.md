# Etapa 4: recorrido real del asistente

## Apertura real del recorrido del asistente - 24/10/2026

Migracion `20261024184611_assistant_trip_stock.sql` aplicada por MCP. Estado: 28 migraciones y 42 tablas publicas con RLS. Extiende solo assistant_open_trip: lectura de clientes activos, posiciones, estados de parada y stock agregado del camion del reparto aceptado vigente. No devuelve deposito, otros camiones, precios/costos ni cartera general. No se habilita helper global driver ni escrituras operativas. Revocar, cerrar o suspender licencia impide consultar; lectura anonima bloqueada. Sin cambios de datos comerciales, cuentas o posiciones reales para comprobar.

Pantalla real del asistente: Abrir reparto, stock del camion, contador de entregas y selector de parada; mapa de pines y navegacion externa por destino o recorrido pendiente. GPS real solo por boton, con precision y manejo de error, sin compartirlo con el jefe en este avance. No hay deteccion automatica de llegada ni optimizacion de rutas. El mapa se carga al abrirlo.

Retoma reparto/parada guardando solo IDs por cuenta en navegador. No guarda nombres, direcciones, existencias ni coordenadas; al abrir consulta y verifica servidor. Error de lectura oculta la informacion, revocacion elimina el puntero al comprobar invitaciones. Los datos en pantalla se actualizan cada 30 segundos con pagina visible y al recuperar foco; no es una suscripcion en tiempo real ni modo offline.

Verificacion: 31 controles de contratos/permisos y 6 de invitaciones/pantalla aprobados (37), compilacion correcta. Prueba visual movil-PC pendiente: Chrome fue detectado, pero Computer Use se detuvo por no poder verificar su URL con suficiente confianza para aplicar la politica. Se retiro el archivo temporal de revision. No se verifico despliegue publico. Siguiente: entrega/devolucion parcial, cobro y deuda mediante operaciones atomicas autorizadas por reparto; carga inicial del asistente y GPS compartido siguen pendientes.

La demo conserva operaciones ficticias separadas. Abrir el recorrido real no habilita todavia la atencion simulada como si fuera una entrega real.

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
