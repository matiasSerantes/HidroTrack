# Ideas de la referencia en video

Fecha de revisión: 2026-10-19. Referencia aportada por el usuario: `WhatsApp Video 2026-10-17 at 3.23.12 PM.mp4`. Duración aproximada: 2 min 17 s. La aplicación se presenta como Hydro Gestión.

Se revisaron fotogramas distribuidos cada cinco segundos a lo largo del video y fotogramas adicionales de los flujos de atención, cobro y resumen mensual. Análisis visual de pantallas y textos; no se transcribió ni analizó el audio. Los tiempos son aproximados. El video incluye demostraciones con datos de ejemplo; una animación no demuestra cómo funciona su backend ni el GPS real.

Estas son observaciones y propuestas para HidroTrack. **No son requisitos nuevos aprobados ni funciones implementadas.** Los pedidos confirmados por el usuario siguen en [REQUISITOS.md](REQUISITOS.md). No se incorporan el video, capturas, datos de personas ni credenciales al repositorio.

## Lo observado y su posible adaptación

| Tramo | Lo que muestra la referencia | Idea para HidroTrack |
| --- | --- | --- |
| 00:10 | Acceso con empresa, usuario y contraseña. | Identidad de empresa clara tras entrar; mantener el autenticador solicitado y definir si realmente hace falta un código de empresa en el acceso. |
| 00:15–00:20 | Carga del camión por artículo; indica que las ventas descuentan stock. También ofrece omitir el control ese día. | Abrir la jornada con cantidades por presentación, confirmar carga y mostrar stock disponible durante las visitas. La posibilidad de omitir el control requiere una decisión propia. |
| 00:25–00:27 | Ruta con paradas numeradas, dirección destacada, cliente, deuda y etiqueta de alquiler. Acciones de mapa, mensaje, historial e insertar después. | Tarjetas de parada con contexto suficiente para atender sin abrir varias pantallas; acciones secundarias agrupadas y orden editable por el jefe. |
| 00:30–00:38 | Ficha con precio, envases en poder del cliente, stock del camión y columnas de cantidad y devolución. | Una sola pantalla de atención con cantidades entregadas y retiradas junto a su contexto de stock. Distinguir retornables de unidades en alquiler. |
| 00:38–00:47 | Desglosa venta de hoy, saldo anterior, total a cobrar, pago completo/parcial, efectivo/transferencia y pendiente. Guarda la visita. | Conservar separados venta nueva, cobro de deuda anterior y saldo final. Hacer visible el resultado antes de confirmar. |
| 00:50–01:03 | Estados de visitado, pendiente y ausente; botones «No estaba» y «No compró». | Estados explícitos con texto e icono además de color. Separar ausencia de visita sin compra; sumar las opciones pedidas de volver después u otro día. |
| 00:55–00:58 | Alquiler de equipo semanal y referencias a productos bonificados asociados al alquiler. | Evaluar cargos recurrentes y beneficios de contrato. Su periodicidad y bonificaciones son reglas por definir; no adoptar las cantidades o tarifas del ejemplo. |
| 01:10–01:25 | Inicio/fin de jornada para compartir ubicación; mapa del administrador y tarjetas con progreso, última actualización, velocidad y resumen del día. | Primero mostrar visita actual/última confirmada y avance del asistente. Evaluar GPS como función separada con inicio/fin explícitos y estado de actualización. |
| 01:35–01:40 | Administrador filtra por día, fecha y repartidor, reordena y reasigna paradas. | Panel del jefe por fecha/asistente con pendientes y cambios de recorrido activo, conservando el historial de atención. |
| 01:45 | Cierre: ventas, cobros del día, cobros de saldos anteriores, efectivo, transferencia y fiado pendiente. | Rendición que distinga venta de cobro y concilie los movimientos; combinar con stock esperado/declarado y aprobación del jefe ya previstos. |
| 01:47–01:48 | Resumen mensual por repartidor y ranking de ventas. | Ofrecer comparaciones de venta, cobro y deuda por período. El ranking es una idea opcional; no sustituye la conciliación. |
| 01:50 | Historial de cliente buscable por nombre o dirección. | Acceso al historial desde ruta y cartera, incluyendo ventas, cobros, envases, alquileres y bajas. |
| 01:55 | Alta/desactivación de usuarios y cambio de clave. La pantalla llega a mostrar claves de ejemplo. | Gestión de asistentes con invitación o recuperación de acceso; no mostrar ni almacenar contraseñas recuperables en el panel del jefe. |
| 02:00 | Artículos/precios y alquileres semanales/mensuales; indica que los cambios de precio no alteran ventas pasadas. | Precio histórico por operación y vigencia de cambios; catálogo configurable con presentaciones y modalidades de alquiler. |
| 02:03–02:05 | Empresa, ciudad/zona y mensajes de WhatsApp editables con campos de cliente, saldo y comprobante. | Proponer plantillas de mensaje y comprobante con vista previa; diferenciar abrir WhatsApp de enviar automáticamente. No se autorizó ningún envío. |
| 02:08–02:10 | Exportación de copia y restauración desde archivo; advierte reemplazo de datos e inclusión de claves. | Considerar exportación autorizada sin credenciales y recuperación controlada. Mantener separados exportación comercial y backup/restauración técnica; no ofrecer reemplazo total con un toque. |

## Propuesta de flujo del asistente

1. Entrar y completar el autenticador cuando corresponda.
2. Ver empresa, reparto asignado y fecha; confirmar carga del transporte.
3. Abrir ruta o mapa con progreso y pendientes.
4. Seleccionar cliente; ofrecer la vista de cuadra pedida, respetando asignaciones.
5. Revisar cantidades previstas, envases y alquileres; cargar lo que deja y retira.
6. Ver total del día más saldo anterior; registrar monto y medio de pago.
7. Confirmar visita y volver al recorrido. Para ausencia, elegir más tarde u otro día; para visita sin compra, registrar ese resultado sin inventar una venta.
8. Conciliar regreso de productos, vacíos y equipos; enviar rendición y decidir si comienza otro reparto del día.

Este flujo combina observaciones del video con requisitos ya pedidos. Las solicitudes de alta/baja y las devoluciones de alquiler mantienen su circuito de aprobación del jefe; no se desprende del video cómo implementarlo.

## Propuesta de pantallas del jefe

- **Hoy:** asistentes, recorridos, progreso, pendientes y solicitudes por resolver.
- **Repartos:** creación, asignación, mapa y edición de paradas pendientes.
- **Clientes:** localidad, búsqueda, historial, alquileres y bajas aprobadas visibles solo al jefe.
- **Artículos y alquileres:** presentaciones, precios, contratos y unidades entregadas/recuperadas.
- **Rendiciones:** carga/regreso, diferencias, cobros y aprobación.
- **Equipo y empresa:** asistentes, solicitudes, nombre y logo arriba a la derecha.
- **Informes:** ventas, cobros y deuda por período/asistente; seguimiento GPS solo si se confirma.

La distinción es importante: el «administrador» comercial del video se corresponde con el **jefe de una empresa** en HidroTrack, no con el administrador global de la plataforma.

## Ideas visuales concretas

- Dirección y siguiente acción como elementos principales durante el reparto; empresa y rol siempre identificables.
- Tarjetas numeradas con estados legibles. Reservar un color de acción principal y usar etiquetas, texto e iconos para pendientes, ausentes y completados.
- Totales y confirmación fáciles de encontrar en el teléfono; evitar filas demasiado densas y acciones de borrado junto al botón habitual de atención.
- Cabecera con identidad propia de HidroTrack y nombre/logo del negocio en la ubicación solicitada. Tomar ideas del flujo sin reutilizar marca, ilustraciones o datos de la referencia.
- Al guardar, indicar confirmado, pendiente de sincronizar o error. Mostrar última actualización del seguimiento; no presentar datos antiguos como ubicación actual.

## Qué aporta frente al alcance ya registrado

Coincide con los pedidos de carga, ruta, entregas/retiros, cobro, alquiler, asignación del equipo y seguimiento. Aporta como **ideas nuevas para evaluar**: «No compró» separado de ausencia, botón de insertar parada después de otra, plantillas de mensaje/comprobante, resumen mensual, reglas de alquiler recurrente y productos bonificados. El ranking, las métricas de velocidad y la opción de omitir stock son opcionales; no quedaron aprobados.

No se pudo verificar en las pantallas revisadas el circuito completo de aprobación de solicitudes/bajas, devolución por unidad y estado, autenticador, detección de cuadra o rendición de varios repartos en el mismo día. Esos requisitos propios de HidroTrack se mantienen.

## Próximo paso propuesto

Diseñar primero la pantalla de atención al cliente y su regreso al recorrido, con jefe/asistente y una operación de ejemplo completa: qué deja, qué retira, alquiler, deuda previa, cobro y pendiente. Permite validar el flujo central antes de implementar todas las pantallas del equipo.
