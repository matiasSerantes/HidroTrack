# Requisitos funcionales de HidroTrack

Actualizado: 2026-10-19. Fuente: pedidos transmitidos por el usuario. Este documento registra alcance solicitado; no afirma que las funciones estén implementadas. Ver estado en [notas](NOTAS.md) y `/plan.html`.

## Roles y empresa

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

- El jefe crea repartos diarios con la cantidad y selección de clientes que necesite.
- Asigna los repartos a sus asistentes para que vean el camino y realicen el recorrido. El jefe también puede atender clientes.
- El mapa muestra el recorrido armado.
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

- Evaluar que el jefe pueda ver en qué cliente está cada asistente.
- Enviar a la cuenta del jefe una notificación por venta de sus asistentes.
- Notificar solicitudes de aprobación y bajas de clientes.
- Evaluar si basta mostrar la visita actual/última confirmada o si se requiere ubicación GPS en vivo. El usuario planteó esta función como posibilidad; no se decidió rastreo continuo.
- Definir notificaciones dentro de la aplicación, push al teléfono y comportamiento sin conexión; el canal exacto no está confirmado.

Aceptación: el jefe recibe eventos de su empresa y puede distinguir visita actual, última actualización y pendientes de sincronizar; no mostrar ubicación antigua como si fuera actual ni generar notificaciones repetidas por reintentos.

## REQ-10 — Experiencia visual

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
