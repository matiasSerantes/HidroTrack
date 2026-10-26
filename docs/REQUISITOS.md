# Requisitos funcionales de HidroTrack

Estado actualizado de base y límites de integración: [BASE_DE_DATOS.md](BASE_DE_DATOS.md), 20/10/2026. Deuda rechazada sigue pendiente de cobro al cliente. Futura baja bloquea nuevas entregas y queda pendiente de recuperación hasta devolver los artículos y obtener aprobación. Cuota mensual de dispenser anclada a fecha de entrega; generación explícita del jefe, sin cargos automáticos.

Actualizado: 2026-10-19. Fuente: pedidos transmitidos por el usuario. Este documento registra alcance solicitado; no afirma que las funciones estén implementadas. Ver estado en [notas](NOTAS.md) y `/plan.html`.

## Roles y empresa

- Historial administrativo de accesos: mostrar los últimos 100 cambios de choferes con empresa, persona, acción, administrador y horario argentino; acceso exclusivo del administrador. Preparado y probado localmente; lectura real pendiente de migración `20261020131010_admin_access_history.sql`.

- Gestión individual de choferes desde administración (20/10/2026): pausar/reactivar membresía por empresa con confirmación y auditoría, conservando cuenta/historial. Titulares protegidos; reactivación con licencia vigente y cupo. Preparado y probado en web/demo y PostgreSQL local; requiere migración remota antes del uso real.

- Panel del propietario de plataforma: resumen, búsqueda de usuarios por correo/empresa, filtros de rol y acceso, alta de titulares/choferes y administración de licencias. Preparado en web (20/10/2026), con vista previa en `/?demo=admin`. Verificación de la cuenta administradora real pendiente; no confundir membresías registradas con visitantes o sesiones en vivo.

- Transición gradual a la web real (19/10/2026): el acceso real es la entrada predeterminada; la demo se abre por elección explícita. Conservar simulaciones hasta comprobar su equivalente conectado y mantener separados los datos ficticios y reales. Implementado localmente el acceso explícito; retiro de funciones individuales pendiente de validación de sus reemplazos.

- **Repartidor jefe:** corresponde al titular (`owner`) de una empresa/reparto independiente. Puede trabajar en la calle y registrar sus propias visitas, además de administrar asistentes.
- **Repartidor asistente:** corresponde al chofer (`driver`) asignado a ese jefe. Trabaja en los recorridos asignados y presenta altas/propuestas para aprobación de su jefe. El alcance exacto de lo que puede crear está pendiente de definir.
- **Administrador de plataforma:** se mantiene separado del jefe de una empresa; el nuevo pedido no amplía sus permisos comerciales.
- Cada jefe configura nombre de empresa y logo, visibles arriba a la derecha. Los asistentes trabajan con la identidad de la empresa a la que pertenecen. Mantener separación de datos entre empresas.

## REQ-01 — Catálogo de venta y alquiler

El jefe carga y administra los artículos que vende o alquila, con posibilidad de agregar otros tipos:

- Sifones y cajones.
- Soda por cajón y soda suelta.
- Bidones de 12 y de 20 litros.
- Máquinas de agua frío/calor.
- Otros artículos configurables.

Registrar presentación y unidad para que un cajón y una unidad suelta no se confundan. La equivalencia entre cajón y unidades debe configurarse; el usuario no indicó una cantidad fija. Diferenciar venta, alquiler y envase retornable para que los movimientos reflejen lo ocurrido.

Aceptación: el jefe puede crear artículos y presentaciones; una operación distingue lo vendido, lo alquilado y los envases entregados/recuperados, sin codificar únicamente los ejemplos anteriores.

## REQ-02 — Autenticador

Solicitar autenticador al acceder. Interpretación propuesta, pendiente de confirmar: segundo factor con aplicación autenticadora (TOTP). Definir a quién se exige, cuándo se solicita y cómo se recupera el acceso antes de implementarlo.

Aceptación a completar tras confirmar el método: el requisito de segundo factor se aplica en el servidor y existe un procedimiento de recuperación.

## REQ-03 — Clientes, localidades y cuadra

- Al tocar una parada en el mapa, mostrar directamente los clientes de esa cuadra y permitir seleccionarlos. El asistente ve clientes activos de sus asignaciones; el jefe ve la cartera activa de su empresa. Para el jefe, el panel ofrece subir/bajar el orden de las paradas pendientes y agregar/quitar clientes de ese reparto, conservando las visitas ya resueltas.

- Al llegar al domicilio, identificar el cliente y pedir confirmación **«Está presente / No está»**. La ubicación no debe bastar para registrar una venta ni elegir automáticamente entre vecinos; confirmar el cliente correcto. En producción se solicita detección por proximidad GPS; en la demo se activa con llegada/avance simulados.
- Si está presente, mostrar envases pendientes por tipo y equipos en préstamo o alquiler antes de atender. Al entregar un bidón retornable, sumar un envase en poder del cliente; al retirar, descontarlo. El saldo permanece para la próxima visita, aunque cambie el reparto o el día.
- Si no está, permitir volver más tarde hoy, elegir otra fecha o pasar a la semana siguiente, conservando el pendiente y su fecha sin tocar ventas, envases o pagos.

- Buscar y ubicar clientes por localidad y por cliente.
- Al llegar a una dirección, mostrar los clientes de esa cuadra que el usuario tenga permiso de atender.
- Al seleccionar un cliente, mostrar qué corresponde dejar y qué retirar; registrar después las cantidades efectivamente entregadas y recuperadas.
- La ficha conserva el estado de alquileres y envases en poder del cliente.

Definir cómo identificar una cuadra: calle, altura y localidad, coordenadas o selección manual. No depender exclusivamente de GPS; contemplar direcciones incompletas y permisos de ubicación denegados.

Aceptación: desde una localidad y un cliente se abre su ficha; la vista de cuadra permite elegir clientes autorizados y revisar entregas/retiros previstos y reales.

## REQ-04 — Equipo y aprobaciones

- El jefe crea usuarios y asistentes y gestiona sus aprobaciones.
- Cada asistente queda vinculado a su jefe.
- Los asistentes pueden crear solicitudes que llegan al jefe asignado para aprobación. Definir cuáles: clientes, artículos, recorridos u otros registros; no convertir automáticamente toda venta en una solicitud.
- Mostrar solicitudes pendientes y su resultado. Propuesta técnica: conservar solicitante, decisión, responsable y fecha para trazabilidad.

Aceptación: un asistente no puede aprobar su propia solicitud ni enviarla a un jefe ajeno; el jefe puede revisar y aprobar/rechazar las solicitudes de su equipo.

## REQ-05 — Repartos del día y mapa

- **Centro de trabajo del asistente:** botón «Abrir reparto» que abre el recorrido completo con su ubicación actual, clientes y acciones principales en el mismo lugar. Desde allí debe poder hacer la mayor parte de la jornada: atención, entrega/retiro, alquiler, cobro, ficha/cuadra, ausencias/pendientes, carga, solicitudes y rendición. En la demo la ubicación es simulada.
- **Continuidad al reabrir:** si se cierra la web, recuperar el reparto y el punto de trabajo guardado, incluido el borrador de atención sin confirmar. Las operaciones confirmadas no deben duplicarse. La demo lo guarda en el navegador; para producción hay que definir recuperación de sesión, sincronización y conflictos reales.

- El jefe crea repartos diarios con la cantidad y selección de clientes que necesite.
- Asigna los repartos a sus asistentes para que vean el camino y realicen el recorrido. El jefe también puede atender clientes.
- El mapa muestra el recorrido armado.
- Demo del 19/10/2026: acceso explícito al mapa de calles desde la web, tres direcciones cercanas y ubicación actual simulada para revisar la experiencia. Permitir centrar, seleccionar clientes y simular avance; no confundir la línea entre paradas con navegación vial ni pedir GPS real para esta prueba.
- El jefe puede agregar o sacar clientes de un reparto activo. Conservar las operaciones ya registradas aunque se quite una parada futura.
- Cada visita realizada por el jefe o sus asistentes actualiza el avance y acumula ventas/alquileres del reparto y del negocio. Definir los totales y filtros precisos en la implementación.
- Si el cliente no está, ofrecer volver más tarde o dejarlo para otro día. Mantenerlo en pendientes, sin marcar una entrega inexistente.

Aceptación: un asistente ve sus asignaciones; el jefe cambia paradas pendientes y el cambio aparece en el recorrido; una ausencia conserva el cliente en pendientes con la opción elegida. Evitar duplicar una operación si dos integrantes atienden la misma parada o reintentan el envío.

## REQ-06 — Entrega, calculadora y cobro

- Al indicar cantidades, calcular lo que debe pagar el cliente. Ejemplo pedido: bajar 3 bidones muestra el importe correspondiente.
- Incluir calculadora en el flujo de atención.
- Botón para indicar si pagó y por qué medio. Mantener los medios ya previstos (efectivo/transferencia) y definir si se necesitan otros.
- Separar total de la operación, monto cobrado y saldo pendiente; mantener pagos parciales contemplados por el alcance previo.
- Registrar cada venta y alquiler y acumular sus importes. Los alquileres deben quedar asentados en la ficha del cliente.

Aceptación: las cantidades generan el total con el precio aplicable, se registra el medio y monto de cobro y el saldo queda consistente. El servidor valida los importes y un reintento no duplica cargos ni pagos.

## REQ-07 — Alquileres y baja de cliente

- El asistente solicita la baja del servicio con un motivo.
- Se muestra qué tiene alquilado el cliente y qué debe devolver.
- Registrar cada unidad devuelta y si volvió en buen estado; conservar también lo pendiente de devolución.
- Notificar al jefe para aprobar la baja.
- Con la baja aprobada, conservar el historial pero excluir al cliente del reparto.
- Solo el jefe puede ver clientes dados de baja y volver a habilitarlos.

Definir si una devolución pendiente bloquea la aprobación o permite aprobar con una deuda/devolución abierta, y qué tratamiento reciben daños o faltantes. No borrar contratos, saldos ni movimientos para completar una baja.

Aceptación: la solicitud incluye motivo, alquileres y condición de devolución por unidad; solo el jefe decide la baja; un cliente inactivo no aparece para repartir y conserva su historial para el jefe, quien puede reactivarlo.

## REQ-08 — Carga, retornables y múltiples repartos

- Al iniciar el día, declarar los bidones y demás productos que lleva el transporte.
- Durante las visitas, actualizar productos y envases vacíos en poder del transporte y del repartidor/depósito según corresponda. Definir con el usuario qué significa cada ubicación de stock.
- Al terminar un reparto, declarar qué volvió y qué no volvió y comparar contra los movimientos.
- Preguntar si desea realizar otro reparto ese mismo día; permitir varios repartos sin perder el control de cargas y devoluciones.

Aceptación: carga inicial, entregas, retiros, alquileres y regreso permiten conciliar el stock por producto/presentación y ubicación. Un segundo reparto del día parte de un stock identificable y no reinicia ni duplica los movimientos anteriores.

## REQ-09 — Seguimiento y notificaciones

- **Pedido confirmado el 19/10/2026:** el jefe tendrá un botón para abrir un mapa general con los repartos de sus asistentes y la ubicación de cada uno. Mientras un asistente tenga abierta su página de mapa, publicar su posición para replicarla en la vista del jefe.
- Mostrar nombre, reparto, avance y hora de última actualización; diferenciar posición reciente, emisión pausada, señal antigua y ausencia de datos. Al dejar de recibir posiciones, no mostrar el último punto como si fuera actual.
- La demo replica coordenadas ficticias entre roles/pestañas del mismo navegador. El GPS y la transmisión entre teléfonos y PC requieren implementación real posterior; mantener la separación entre empresas y los permisos del jefe al conectarla.

- Evaluar que el jefe pueda ver en qué cliente está cada asistente.
- Enviar a la cuenta del jefe una notificación por venta de sus asistentes.
- Notificar solicitudes de aprobación y bajas de clientes.
- Evaluar si basta mostrar la visita actual/última confirmada o si se requiere ubicación GPS en vivo. El usuario planteó esta función como posibilidad; no se decidió rastreo continuo.
- Definir notificaciones dentro de la aplicación, push al teléfono y comportamiento sin conexión; el canal exacto no está confirmado.

Aceptación: el jefe recibe eventos de su empresa y puede distinguir visita actual, última actualización y pendientes de sincronizar; no mostrar ubicación antigua como si fuera actual ni generar notificaciones repetidas por reintentos.

## REQ-10 — Experiencia visual

Preferencia confirmada el 19/10/2026: evitar una estética excesivamente pálida. Usar colores más presentes y buen contraste en navegación, acciones, métricas y estados, manteniendo texto legible y un uso consistente de la paleta en celular y PC.

La web debe verse y funcionar bien tanto en **PC como en celular**, con diseño adaptado al espacio y a la forma de interacción de cada dispositivo. El celular mantiene la prioridad; en PC se aprovechan la barra lateral, las tablas y las vistas amplias para la gestión del jefe. Validar ambos formatos antes de dar por terminada una pantalla.

Buena estética, usable desde el teléfono durante el reparto. Priorizar selección de cliente, cantidades, qué deja/retira, importe, cobro y siguiente parada. Respetar el nombre/logo de empresa en la esquina superior derecha y mantener estados claros de pendiente, aprobado, ausente y baja.

**Prioridad principal confirmada el 19/10/2026:** el celular es el dispositivo principal. El chofer necesita una interfaz simple, rápida y cuidada durante su jornada. Diseñar primero las pantallas móviles, con navegación corta, acciones principales al alcance del pulgar, controles táctiles amplios, entradas legibles y mínima carga innecesaria de red. El trabajo sin señal sigue siendo un requisito pendiente; el guardado local de la demo no representa sincronización real.

Aceptación: recorrer cliente → entrega/retiro → cobro → siguiente parada desde un teléfono sin depender de la vista de escritorio; validar legibilidad, interacción táctil, teclado, rendimiento en dispositivos reales y estados de red. La demo debe mostrar esta orientación sin afirmar que ya fue validada en celulares reales.

## Etapa de seguridad acordada

Priorizar una beta funcional antes de la revisión completa y el endurecimiento de seguridad. Planificar esa revisión como condición previa al uso con datos reales. Las protecciones básicas existentes (roles/RLS, secretos fuera del frontend y separación de la demo) se mantienen durante todo el desarrollo. La beta demo puede seguir usando simulaciones expresamente identificadas.

## Orden propuesto dentro del plan existente

| Etapa | Incorporaciones solicitadas |
| --- | --- |
| 1. Identidad, permisos y licencias | Jefe/asistentes, aprobaciones, autenticador y separación de empresas. |
| 2. Clientes, catálogo y recorridos | Localidades, cuadra, presentaciones, venta/alquiler, marca de empresa, asignaciones y cambios del reparto activo. |
| 3. Operaciones y cuentas | Qué deja/retira, calculadora, cobros, alquiler por cliente, pendientes y baja aprobada con devoluciones. |
| 4. Carga y rendición | Stock por ubicación, vacíos, regreso, diferencias y varios repartos diarios. |
| 5. Sin conexión y sincronización | Operaciones y aprobaciones pendientes, actualización del equipo y notificaciones sin duplicados. |
| 6. Piloto | Validar el circuito completo del jefe y asistentes y la experiencia móvil; evaluar seguimiento en vivo. |

El orden es una propuesta de implementación; el usuario no priorizó todavía entre estos nuevos pedidos. Las decisiones pendientes de cada sección deben resolverse al abordar esa función, sin perder el alcance registrado.

### Carga única y stock del camión (demo)

Al iniciar un reparto planificado, el asistente confirma cantidades una sola vez. No se editan ni recargan durante ese reparto, incluso al reabrir. Stock del camión permite consultar carga original, disponibilidad y vacíos actualizados con cada operación confirmada. Mostrar el importe acumulado de artículos entregados a precios históricos, separado del dinero cobrado. Otro reparto tiene carga propia; requiere cierre y aprobación del anterior según el flujo existente.

### Prioridad de implementación confirmada — 19/10/2026

Comenzar por la base real de stock. Primera migración aplicada: catálogo ampliado, libro de movimientos por empresa, asignaciones básicas, carga única, entregas/envases y regreso aprobado. Ver `STOCK.md`. La integración visual, ventas/cobros, alquileres serializados, ajustes y rendiciones con diferencias siguen pendientes; las pantallas actuales conservan los datos demo.

### Cuenta del cliente y autorización de deuda — 19/10/2026

La ficha no repite clientes de la misma cuadra: esa selección queda en el mapa. Mostrar deuda aprobada o Al día, y aparte créditos solicitados/rechazados sin presentarlos como saldo cero resuelto. Un asistente que entrega con pago insuficiente de lo vendido hoy genera solicitud y aviso al jefe; solo la aprobación suma ese faltante a la deuda. La entrega física y el cobro se registran al atender. Deuda anterior ya aprobada no requiere nueva solicitud. Regla provisional explicitada en pantalla: aplicar pago primero a hoy y excedente a deuda anterior. Como jefe, confirmar una entrega a crédito autoriza y registra directamente. Rechazar no borra venta ni faltante; el circuito posterior de cobro del rechazo sigue pendiente. Implementado en demo, sin ampliar la base real de stock a cuentas corrientes.

### Ajuste visual confirmado — 19/10/2026

Mantener paleta celeste clara en tarjetas, cuenta y stock; deuda en naranja suave. Baja aprobada en recuadro rojo suave con su fecha, incluido aviso del día en el reparto del asistente sin ofrecer atención. No confundir ausencia o deuda con baja. La fecha se registra al aprobar; bajas históricas sin fecha no deben inventarla. Preferencia vigente sobre los fondos oscuros introducidos anteriormente.

### Patrimonio físico confirmado — 19/10/2026

El jefe compra un parque propio de envases. Entregar, recuperar vacíos y rellenar solo cambia ubicación/condición; no aumenta el total. Compra y apertura inicial sí agregan unidades conocidas. Mostrar depósito lleno/vacío, camión lleno/vacío, envases en clientes y total por artículo. No afirmar si el cliente ya consumió el agua. Dispenser propios en préstamo gratuito o alquiler, separados de dispenser del cliente (no suman al patrimonio). Primera pantalla conectada del jefe implementada junto con base, carga única y regreso exacto; todavía falta validar con cuenta real e integrar ventas/cobros del chofer. Darío aportará datos luego; no crear su cuenta ni inventario con datos inventados.

### Usuarios reales — 19/10/2026

Reutilizar Supabase Auth para credenciales y perfiles públicos protegidos para nombres. Roles solo desde membresías administrativas, nunca metadatos editables. Primer jefe solicitado: alta aún pendiente por revisión automática del mecanismo, sin guardar datos personales ni contraseña en Git. Perfiles y presentación de nombre implementados. Ver USUARIOS.md.

- Actualización: primer jefe creado tras autorizar el alta administrativa temporal; perfil, empresa y licencia activos. Inicio de sesión y lectura de inventario verificados con sesión real. Alta temporal deshabilitada tras completar la operación. No se cargó stock ficticio.

La cuenta real debe conservar la estructura visual aprobada de la demo: misma paleta, navegación lateral en PC e inferior en celular. Mostrar únicamente datos reales y módulos conectados.

Catálogo visible con artículos y precios; cantidades separadas en inventario. La apertura inicial permite registrar los bidones vacíos antes de rellenarlos. Carga y detalle de llenos/vacíos del camión pertenecen a Repartos; Stock solo resume el total en camiones para conservar la distribución del patrimonio.

Carga de camión: lista de artículos del catálogo, cantidad por fila, disponibles en depósito y total. Registrar carga confirma todos los artículos juntos, una sola vez por reparto. Stock del depósito también admite listas de cantidades por movimiento, sin confundir recarga de vacíos con salida al camión. Los equipos individualizados se gestionan por su identificación en Dispenser.

Clientes reales: Abrir ficha desde el nombre o botón visible, Editar datos y Eliminar de activos conservando historial. Ficha con envases pendientes de devolución, dispenser propios/del cliente y últimos movimientos. Permitir conteo inicial anterior al sistema mediante apertura (sin duplicar depósito) y asignar dispenser ya registrado en depósito como préstamo gratuito o alquiler. Cuenta corriente real sigue pendiente de conectar; no mostrar saldo cero ficticio.

Artículos: editar nombre, unidad y precio sin recrear registros. Modelos dispenser en su sección, conservando existencias. Entradas con fecha del hecho y fecha de registro. Bajas/roturas deben indicar artículo/unidad identificada, cantidad, ubicación (depósito lleno/vacío, camión o cliente), fecha, motivo, autor y persona involucrada (jefe, asistente o cliente). Descontar solo de esa ubicación, sin negativos ni duplicados, conservar historial y no generar cargos automáticos. Rotura representa baja de disponibilidad; reparación/reposición es un movimiento distinto. Implementación remota de estas bajas pendiente de migración.

Los botones deben reconocerse sin pasar el puntero: fondo y borde celestes visibles en reposo, contraste legible, foco de teclado y área táctil de al menos 44 px. Turquesa para acciones principales; rojo suave para eliminar. Aplicar a cuenta real y demo.

Actualización de navegación de clientes: en la lista mostrar Planilla. Dentro colocar Editar datos y, solo para el jefe, Archivar cliente. No ofrecer el archivo desde la lista. Archivar conserva historial y asignaciones y retira al cliente de activos previa confirmación.

Tarjetas de catálogo/modelos: priorizar unidades activas registradas sobre el precio. Mostrar distribución en depósito, camión y clientes; precio secundario debajo. Incluir vacíos en el total de envases propios. El campo Unidad es descripción de venta, nunca una cantidad de existencias.

Dispenser: el ingreso de unidades por modelo debe alimentar directamente el selector de la planilla del cliente. Disponibles son unidades en depósito o camión activo; no las asignadas a clientes ni dadas de baja. Asignar consume una unidad disponible sin aumentar patrimonio; devolver la libera; rotura la retira y cierra su asignación. Conservar préstamo/alquiler y fecha por unidad, además de equipos previamente individualizados. No exigir doble registro.

Eliminar artículo/modelo desde Stock y tarjetas: acción visible en rojo suave con confirmación. Retirar de activos conservando historial, sin borrar físicamente. Si quedan existencias en depósito, camión o clientes, resolver previamente sus bajas/roturas/devoluciones; no esconder patrimonio al eliminar una tarjeta. Control tanto en interfaz como en base (migración pendiente). El bloqueo debe mostrar un aviso inmediato.

Reinicio administrativo solicitado por el titular: vaciar catálogo e inventario de su empresa conservando cuenta, usuarios, licencia y clientes; verificar empresa antes de ejecutar y rechazar mientras existan repartos activos o en rendición. Preparado y probado localmente, pendiente de ejecución por MCP autenticado.

Ingreso de bidones: preguntar explícitamente vacíos o llenos. Carga del camión: opción del jefe para rellenar vacíos que falten, usando primero llenos y registrando todo junto sin duplicar patrimonio. Confirmación única por reparto, conservada al reintentar. Implementado en base, web del jefe y demo; integración Auth/PostgREST y revisión visual pendientes.

Catálogo único: Agregar dispenser arriba y Agregar producto debajo, inventario de ambos tipos con Editar/Eliminar y al final Retirar producto o dispenser. Eliminar una carga equivocada registra bajas del depósito y archiva, con confirmación y sin borrar historial. No eliminar asignaciones ni unidades de camiones/clientes.


## 20/10/2026 - Equipo y cuenta independiente del asistente

- Cuenta personal del asistente, reutilizable entre varios jefes; sin licencia propia. El jefe agrega una cuenta existente y puede quitar solo su vinculo. No borrar cuenta global, historial ni vinculos con otras empresas.
- Agregar asistente o empleado desde el equipo del jefe. Sin recorrido asignado, unica pantalla En espera de recorrido, sin datos comerciales del jefe ni navegacion a sus modulos. Con recorrido, solo datos autorizados de ese recorrido y empresa. Al terminar o revocarse, volver a espera.
- Licencia basica: 1 asistente; intermedia: 3; superior: ilimitados. Cupos independientes por empresa. Propuesta: contar vinculos habilitados, no solo quienes estan trabajando; bloquear bajas de plan por debajo del equipo actual y quitar asistentes con recorrido abierto hasta resolverlo.
- Implementar registro verificado, vinculacion con consentimiento y revocacion auditada en servidor antes de activar datos reales. No exponer listado global de correos ni permitir acceso por pertenencia sin asignacion. Demo no crea cuentas Auth, no cobra licencias ni cambia planes reales.


## 20/10/2026 - Llenado y ganancia estimada

Opcion desactivada por defecto en configuracion del jefe. Al habilitarla, el producto retornable de venta permite activar costo de llenado e ingresar monto unitario. Precio de venta y costo de llenado independientes. Congelar costo y cantidades aplicados al confirmar carga unica; no duplicar gasto en reintento, no cambiar historia al editar precio o desactivar configuracion. Mostrar al jefe costo inicial negativo, vendido y resultado estimado vendido menos llenado de la carga; cobrado por separado. No presentar como ganancia neta contable ni como costo de envases vacios que no se rellenaron. Demostracion local antes de integracion real.

Confirmado por el usuario: descontar solamente los bidones que se rellenan al cargar. Los ya llenos del deposito no suman costo de esta carga. Mantener visible el resultado historico aunque luego se desactive la opcion.


## 2026-10-20 - Planilla del cliente, visita extra y cambio de dispenser

Pedido: alta con direccion escrita mas pin de mapa o posicion actual; ficha con coordenadas exactas, fecha de alta, pedido habitual y dias semanales. Desde ficha generar visita adicional por pedido antes de la semanal sin cambiar rutina. Devolucion parcial conserva envase no devuelto para proxima visita. Cambio de dispenser: entregar reemplazo desde camion, registrar equipo retirado y nuevo asignado. Estado: demo en implementacion; integrar funcionalidades existentes sin cargar datos remotos. GPS real solo solicitado por accion del usuario, errores visibles; demo permite ubicacion simulada. Cambio sin cuota nueva automatica, conserva modalidad/importe; registrar destino/estado del retirado. No tocar equipos propios del cliente ni admitir reemplazo sin stock.


## 2026-10-20 - Carga sugerida y extras del recorrido

Pedido: al generar recorrido mostrar bidones/productos y dispenser necesarios para clientes asignados. Antes de confirmar carga, permitir sumar extras para clientes nuevos o pedidos fuera de rutina. Una sola confirmacion registra previsto mas extra; no autoriza recargar despues de salir. No inferir cantidades por texto ambiguo ni contar equipos ya en poder del cliente como nuevos requeridos. Demo: preferencias estructuradas por cliente, pedido adicional reemplaza habitual en esa parada, necesidades de dispenser expresas por recorrido. Mantener la carga confirmada y costo historico; despues de confirmar solo cambios por entrega/devolucion y cierre. Estado: demo en implementacion; servidor actual ya permite cantidades iniciales libres, sugerencias requieren integrar preferencias reales.


## 2026-10-20 - Tablero con graficos, repartos activos y PDF de cierre

Pedido: graficos ganancia/gasto mensual, mejor dia de semana y ganancia diaria, bidones llenos/vacios/en clientes; tarjetas de repartos activos debajo de Tu reparto bajo control con avance 0/15 y clientes nuevos. Al finalizar por jefe, comprobante PDF para jefe y asistente con carga inicial/final, efectivo a rendir, ventas/cobros efectivo/transferencia, llenos/vacios que regresan y dispenser nuevos/cambiados/retirados. Estado: demo en implementacion; no modificar base remota ni enviar documentos externos. PDF disponible en ambas vistas con variantes de detalle, historial congelado y cierre sujeto a rendicion/stock conciliados. Ganancia estimada solo con costos historicos registrados; no inventar gastos ni beneficio neto. Progreso cuenta visitas con entrega por separado de paradas resueltas/ausencias. Cliente nuevo: alta durante el dia del reparto y agregado a sus paradas, contando identidades unicas.


20/10: ficha de asignacion debe distinguir modelo del catalogo de unidades fisicas. Si no hay disponibles, explicar motivo y ofrecer registro de existencias no contadas con fecha y cantidad; luego asignar. Nunca sumar equipos automaticamente por mostrar el selector ni por refrescar. Equipos ya con clientes, en camiones no autorizados o retirados no se vuelven disponibles por este cambio.


20/10: usuario confirma disponibilidad automatica desde stock. Modelo mas cantidad inicial deben guardarse juntos; no obligar a segunda carga desde cliente. Campo de cantidad separado de unidad de venta, dispenser nuevo usa unidad fija. Preservar movimientos y asignaciones previas. Basico de canilla se presta gratis y corresponde uno por cliente; frio/calor es de alquiler. Validacion de unicidad por cliente pendiente de regla de servidor, sin reinterpretar precios como cuotas.
# Promociones en prueba (20/10/2026)

- Interfaz real del jefe conectada: permiso individual sobre asistentes vinculados, bandeja interna de avisos, alta con salida de depósito, decisión/conversión, devoluciones buenas/dañadas e historial. Reintento de respuesta incierta conserva ID; no repetir como alta nueva. Inventario muestra promociones y daños. Pantalla de asistente real, seguimiento y notificación en vivo pendientes; el acceso real actual del chofer todavía no es operativo.

- Permiso confirmado: únicamente el jefe habilita/revoca por asistente la capacidad de ofrecer promociones; por defecto deshabilitada. Cada promoción entregada por asistente habilitado notifica al jefe. En demo necesita recorrido activo, usa stock de ese camión y ve solo sus promociones. La conversión y recuperación quedan a cargo del jefe. Desvincular revoca el permiso y conserva historial. Producción requiere permiso en vínculo empresa-asistente, no en cuenta global (puede trabajar con varios jefes).

- Separar personas en prueba de clientes activos. Registrar contacto, dirección, condiciones/precio pactados, fecha de entrega, próxima visita y bienes en su poder.
- Estados: en prueba, pendiente de recuperación, convertida en cliente y cerrada. Aceptar crea una sola ficha de cliente y transfiere tenencias sin descontar nuevamente inventario; conserva historial.
- Rechazar bloquea nuevas entregas. Recuperar parcialmente mantiene pendiente; cerrar solo con cero bienes por recuperar. Los envases buenos vuelven vacíos, los equipos buenos disponibles y los dañados quedan fuera del disponible, conservando trazabilidad.
- Demo del jefe disponible en Promociones. Salida directa desde depósito; cuotas de equipos al continuar explícitas (cero = préstamo gratuito). Las condiciones de precio son referencia, sin cobros ni deuda automática.
- Pendiente de producción: tablas de prospectos/promociones, eventos y movimientos atómicos, RLS por empresa, asignación de visita al asistente, carga del camión y rendición, aprobación comercial y tratamiento contable del precio promocional. No implementar automáticamente descuentos/gratuidad/plazo fijo sin definición. No confundir esta demo con autorización de cambios remotos.

Estado servidor de promociones (20/10): migracion 20261020203608 instalada y verificada con autorizacion explicita, permiso por vinculo, auditoria, avisos y movimientos transaccionales. La lista de pendientes anterior se reduce a interfaz real, visitas de seguimiento, rendicion/PDF y tratamiento contable de precios promocionales. La demo sigue local.
## 21/10/2026 - Navegacion en app externa

- Mapa integral de demo: Abrir navegacion permite Google Maps/Waze para parada seleccionada y Google Maps para todas las pendientes de hoy, en orden del reparto. Incluye volver mas tarde; excluye visitados, sin venta y reprogramados a otro dia.
- Recorridos largos divididos en tramos de hasta cuatro destinos (tres intermedios), ajustando ademas longitud maxima del enlace. No omitir personas sin ubicacion: bloquear exportacion completa y explicar que dato falta. Direccion escrita como alternativa a coordenadas validas; punto exacto preferido.
- Waze: navegacion precisa cuando hay coordenadas; sin punto, buscar direccion y que el usuario confirme el resultado. En PC o sin app puede abrir web; no prometer lanzamiento de app en todos los celulares.
- Origen a cargo de app externa con ubicacion del telefono; no enviar posicion simulada como real. Demo muestra aviso de destinos ficticios. Solo compartir destino/direccion al tocar enlace; sin nombres/cuentas/importes adicionales en URL, sin API key ni permisos GPS nuevos en HidroTrack.
- Salir a otra app no registra visita, cobro ni entrega; volver a HidroTrack y continuar. Componente reutilizado en planilla real para destino individual. Recorridos reales del asistente siguen pendientes y no se presentan como conectados por esta mejora.
- Referencias oficiales: https://developers.google.com/maps/documentation/urls/get-started y https://developers.google.com/waze/deeplinks (consultadas 21/10/2026). Pruebas de enlaces/limites no sustituyen prueba de apertura real en Android/iPhone.
## 21/10 - Regla principal: asistente independiente e ID personal

La cuenta del asistente pertenece a la persona, no al jefe. ID personal estable para compartir, vinculacion una sola vez a la lista de choferes y asignaciones sucesivas sin repetir alta. Puede tener varios jefes con permisos separados. No eliminar ni duplicar identidad por desvinculacion.

Sin recorrido asignado: solo identidad/perfil basico, ID y nombres de jefes opcionales. No clientes, rutas, stock, importes ni comprobantes de recorridos anteriores. Esta regla reemplaza la excepcion previa de PDF en espera. Con asignacion vigente: solo datos/acciones definidos para esa empresa y recorrido. Ocultar UI no basta; revisar RPC/RLS antes del uso real.

Opciones propias: nombre, foto y cambio de contrasena. Demo actualizada con ID copiable, enlace por ID, perfil/foto local y cambio de clave expresamente simulado sin guardar secretos. En real: ID publico aleatorio estable distinto de credencial, busqueda exacta sin directorio global, consentimiento/revocacion, cupos por empresa, Storage privado y politicas de foto, actualizacion de perfil propio y Auth para cambio de clave con verificacion de sesion. No almacenar claves en tablas publicas, metadatos o localStorage. No se modificaron cuentas reales ni esquema por esta idea.
## 21/10 - Invitacion antes de habilitar reparto

El asistente recibe: nombre del jefe/empresa y nombre del reparto, con Aceptar o Rechazar. No mostrar lista de clientes, ruta, stock ni importes antes de aceptar. Sin respuesta o rechazo mantiene espera; al aceptar habilitar solo esa asignacion. Otro reparto ya aceptado no debe impedir recibir nuevas invitaciones. Notificar respuesta al jefe y conservar auditoria sin registrar entrega/carga automaticamente.

Demo: nuevos repartos para asistentes crean invitacion pendiente; ejemplos historicos se consideran ya aceptados para preservar simulacion existente. Pendientes/rechazados excluidos de navegacion y restauracion; aceptar selecciona el reparto y rechazo conserva datos para el jefe. Servidor real pendiente: estado de invitacion/aceptacion y RPC propia del destinatario, versionado, revocacion y verificacion en todas las politicas/RPC comerciales. Crear cuentas o vincularlas no equivale a aceptar reparto. No modificar empresas reales por esta aclaracion.
## 21/10 - Avance de perfil real, mapa optimizado pospuesto

Optimizacion de calles/orden queda para despues por indicacion del usuario. Cuenta real de asistente: pantalla de datos propios, ID copiable basado en identidad estable, nombre conectado a user_profiles y contrasena mediante Auth; sin consultas de cartera/ruta/stock. Sin vinculo conserva acceso personal, no se autoconcede rol o licencia. Foto y alta/vinculo por ID reales pendientes. Invitaciones de demo no autorizan todavia datos de servidor: antes de conectarlas, cambiar permisos de lectura/accion para exigir aceptacion vigente y revocar tras cierre.

## 2026-10-22 - Recuperacion de acceso

Pantalla real con marca de gotas de HidroTrack, tarjeta celeste responsive y boton Guardar y entrar a mi cuenta. Solo tras confirmacion Auth e identidad coincidente entra automaticamente al panel y limpia auth=recovery de la URL; sin paso manual adicional. Si falla, permanece en recuperacion y permite reintentar. Sin cambios de claves reales para probar. Plantilla del correo aun en ingles: esta mejora corresponde a la pagina web.

## Etapa 3 parcial - 22/10

Planilla real: fecha de alta de solo lectura, dias habituales por seleccion inmediata y cantidad habitual por producto guardada individualmente. Cero elimina esa preferencia; no altera envases, stock ni ventas. Datos de preparacion, no pedido o entrega confirmado. Guardado manual real pendiente de validar.

## Carga sugerida real - 24/10

La carga sugiere suma de pedidos habituales solo para clientes activos de paradas activas y sin futura baja. No resta envases a devolver. Aplicar referencia es explicito y reemplaza cantidades; luego permite extras o reducciones. Cambiar reparto reinicia cantidades no confirmadas. No inventar pedidos para clientes sin preferencia; advertir faltantes. Carga unica y stock se validan al confirmar por contratos existentes. Falta snapshot historico de referencia/extras.

## Visita extraordinaria real - 24/10

Jefe registra fecha/productos/cantidades desde planilla; queda pendiente de reparto. Asignacion a reparto planned/active de la misma fecha agrega/reactiva cliente sin duplicar. Cliente inactivo/futura baja bloqueado. Pedido sustituye habitual en sugerencia para esa visita, no se suma por duplicado. Cancelar conserva historial, parada y carga. Un pedido no cancelado por cliente/fecha; entrega y cobro siguen en etapa 4.

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

## 2026-10-25 - Detalle de dispenser conectado al cierre

Proximas presentaciones/cierres guardan equipment_detail version 1 con operaciones vinculadas explicitamente al reparto: asignaciones por modelo, cambios con reemplazo y estado retirado, roturas/retiros de camion, y cargas/entregas/regresos/traslados de equipos por serie. Cambios excluyen sus dos movimientos componentes para no duplicarlos como nueva asignacion o retiro adicional. Equipo roto no suma disponibilidad. No infiere que el equipo entregado sea de fabrica nuevo ni atribuye devoluciones del deposito al camion solo por fecha/cliente.

Migracion 20261025170559_equipment_close_detail.sql aplicada por MCP: 39 migraciones, 50 tablas con RLS. Helper privado sin EXECUTE directo del usuario, quote propio/asistente incorpora el detalle y proyeccion del recibo propio lo comparte sin cliente, alquiler, responsable, costos ni GPS. Nuevos cambios despues de presentar impiden aprobar sin revisar; rendiciones anteriores sin equipment_detail mantienen sus reglas originales. No se actualizan snapshots antiguos ni saldos/contratos; etiquetas por modelo se congelan al presentar/cerrar, no se afirma reconstruir nombres al dia de un movimiento anterior.

Pantalla de rendicion/historial y PDFs propio del jefe y compartido muestran movimientos sin sumarlos de nuevo al regreso. Comprobantes anteriores conservan aviso de no contener desglose, sin inventar eventos. Se mejora paginacion comun de PDF para que encabezados finales acompanen su contenido. Copias ficticias del jefe (dos paginas) y asistente (una pagina) parseadas y renderizadas sin cortes, incluido titulo Observaciones junto a su texto.

Verificacion final: suite completa 53 archivos, 422 pruebas aprobadas. Incluye cambio bueno/roto, no duplicacion de reemplazo, serie/carga/regreso, snapshot congelado, proyeccion sin datos privados y aprobacion compatible de rendicion antigua. Compilacion final correcta; publicacion pendiente de verificar. Sin movimientos, cambios de dispenser o cierres reales para probar. QA manual autenticada movil/PC aun pendiente por bloqueo de control de Chrome.


2026-10-25: Planilla real del jefe incorpora Cuenta corriente, Cargar deuda anterior (monto, fecha y referencia antes de movimientos), saldo y cargos/pagos acumulados. Usa apertura unica existente, no genera entrega ni cambia stock. Mejora integrada en funcion real; demo conserva sus saldos ficticios. No incluye todavia formulario de cobro en esta planilla.

2026-10-25 - Asignacion inicial de bidones existentes implementada: planilla elige descontar vacios (predeterminado) o llenos del deposito, con fecha; alternativa explicita no contados suma patrimonio. RPC inventory_assign_existing_containers conserva total propio, valida saldo y rol jefe, serializa operaciones y reintenta UUID sin duplicar; asignacion inicial unica por cliente/articulo. Registros historicos aditivos permanecen intactos. Catalogo muestra disponibles y distribucion por ubicacion. Migracion 20261026004710_customer_existing_containers aplicada por MCP, sin alterar existencias reales. 75 pruebas relacionadas y build correctos, incluyendo 600 a 598+2, reintento y rollback por saldo insuficiente. Publicacion pendiente de verificar. Ajuste de los dos bidones cargados previamente pendiente de identificar empresa y origen con usuario.


2026-10-25 - Pedido desde audio: planilla monetaria estilo libreta, deudas con fecha y saldo; cobros individuales con importe, fecha y medio (efectivo/transferencia), mas registro de cobro parcial o total. Actualmente existe apertura y resumen acumulado; historial individual y carga de cobro desde planilla quedan pendientes.

## 2026-10-25 - Libreta de cobros implementada en planilla real
Cuenta corriente incorpora Historial de pagos individuales con monto, fecha del hecho, efectivo/transferencia, referencia y cargo al que se aplica. Formulario Registrar pago elige cargo pendiente, admite pago parcial o total, fecha entre cargo y hoy y referencia opcional. Si cubre varios cargos se registra la parte de cada uno; no hay reparto automatico entre deudas. El cobro fuera del reparto usa p_trip=null y no altera caja/stock de camion.
Usa commerce_record_payment existente: autorizacion de jefe, saldo validado y bloqueo transaccional del servidor; UUID y valores conservados ante respuesta incierta. Error confirmado refresca saldos sin borrar el mensaje. Relectura tras guardar muestra saldo y pagos; error de consulta impide presentar saldo cero como confirmado. Historial paginado filtra payments por tenant y sales!inner.customer_id con FK compuesta, sin leer pagos de otros clientes. No modifica esquema ni registra pagos reales para probar.
Verificacion: 83 pruebas relacionadas aprobadas (incluye PostgreSQL); nuevo pase de interfaz tras ajuste de errores/fechas y build final correctos. MCP confirma relacion compuesta entre pagos y ventas. QA manual autenticada movil/PC pendiente. Publicacion pendiente de verificar. El pedido del audio deja de estar pendiente salvo validacion en celular y posibles mejoras posteriores.

## 2026-10-25 - Busqueda, saldo a la vista y repartos finalizados
Lista real de clientes permite buscar por nombre/direccion/telefono, ignora acentos y mayusculas, admite palabras en distinto orden, muestra cantidad de resultados, limpiar busqueda y aviso sin coincidencias. Clientes y saldos se consultan por paginas para evitar truncamiento por limite de API. Columna saldo muestra importe pendiente en naranja suave o sin deuda; falla de lectura no se interpreta como cero. Saldos refrescan cada 30 segundos o al recuperar foco y al volver desde planilla. No se consulta de nuevo al escribir cada letra.
Cuenta corriente pasa al inicio de la planilla para responder cuanto debe sin buscar entre equipos. Repartos finalizados y PDF se destaca arriba de Mi reparto como chofer, dentro de Repartos y camion, con explicacion de que quedan guardados y limite de diez propios. No se borra ni reasigna un reparto al cerrarlo; historiales de asistentes siguen separados.
Licencia de la cuenta actual de titular solicitada identificada por membresia y empresa, actualizada por MCP a permanente activa sin vencimiento y plan asistentes ilimitados, con auditoria automatica y relectura confirmada. No se modifico la cuenta antigua ni se cambiaron clientes/saldos/repartos. No incluir identificadores ni datos personales en Git.
Validacion: suite completa 439/439 y build aprobados. QA visual autenticada movil/PC pendiente. Publicacion aun pendiente de verificar; se diagnostica despliegue que sigue sirviendo version anterior. Este incremento incluye la libreta de pagos pusheada previamente.


2026-10-26 - Aclaracion del usuario: deuda mediante cargos y pagos que sumen/reduzcan saldo, opcion eliminar (anulacion trazable pendiente de diseno), no editar deuda directamente. Poder registrar deuda anterior completa con fecha aun con movimientos, clientes sin deuda y fecha real de inicio de servicio al cargar informacion antigua. Implementacion pendiente; prioridad de este turno fue correccion autorizada de stock historico. PDF validado por usuario.

## 2026-10-26 - Busqueda de direccion y punto de puerta implementados
Selector compartido de alta/edicion del jefe, propuesta del asistente y demo agrega Buscar direccion en el mapa. Campo de consulta opcional: vacio toma address/locality del formulario; permite completar localidad/provincia. Busca solo por accion expresa (o Enter), no por cada letra, via Photon con filtro Argentina y maximo cinco resultados; valida geometria, rango, pais y duplicados. Resultado no se selecciona solo ni modifica direccion escrita; elegirlo abre mapa, carga coordenadas y permite ajustar la puerta con toque. Punto se persiste al guardar cliente mediante campos existentes, sin migracion.
GPS actual abre mapa y muestra precision aproximada si navegador la informa. Errores, falta de resultados o permiso denegado conservan punto previo; timeout y aborto al desmontar evitan respuestas tardias. Controles y guardado/navegacion del jefe y propuesta quedan bloqueados mientras consultan, sin enviar formularios al buscar. Mapas no aceptan clicks cuando estan deshabilitados.
Verificacion: suite completa 455/455 y build correctos. Prueba HTTP con direccion publica ficticia/de demostracion confirma respuesta y CORS; no se enviaron domicilios reales de clientes ni se guardaron clientes para probar. QA visual autenticada en telefono/PC y precision real de domicilios pendientes. Publicacion pendiente de verificar.
Proveedor publico Photon admite uso razonable sin garantia de disponibilidad; conservar marcado manual y GPS como alternativa. Fuentes oficiales https://github.com/komoot/photon y https://github.com/komoot/photon/blob/master/docs/api-v1.md . La interfaz informa envio de direccion al servicio solo al buscar y muestra atribucion Photon/OpenStreetMap.
