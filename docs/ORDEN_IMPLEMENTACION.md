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
