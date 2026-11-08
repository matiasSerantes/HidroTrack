# Pedidos durante la carga de datos

Prioridad: uso real y carga de información. Comprobaciones dirigidas a cada cambio; revisión integral de beta aplazada por el usuario.

- Hasta tres teléfonos por cliente, con botón para agregar/quitar números.
- Descripción de acceso: departamento, timbre, casa de adelante, etc.; visible al atender.
- Conservar la altura escrita cuando la búsqueda devuelve solo la calle, sin presentar el punto como puerta verificada.
- Visitas confirmadas: frecuencia semanal por defecto. Algunos clientes se visitan semana por medio en el mismo día (por ejemplo, un lunes sí y el siguiente no). No son intervalos de 15 días exactos. Configuración por cliente implementada; estado de publicación en NOTAS.md.
- Agregar deuda repetidamente aunque existan cargos. Referencia opcional de producto/promo y fecha histórica; captura de hora/autor de registro.
- Registrar un pago sobre la cuenta completa, reducir cargos pendientes y señalar cuando queda saldada, sin modificar stock.
- Corregir cantidades del catálogo mediante movimientos; separar cantidad de unidad/modalidad. Conservar asignaciones e historial.
- Mostrar deuda total pendiente de la empresa.
- Agenda de visitas extraordinarias de hoy/mañana y recordatorio al celular con permiso; incluir hora y cliente al preparar reparto.
- Horario desde una hora y hasta fin del día, sin exigir hora de cierre.
- Mapa para seleccionar/ordenar clientes al crear el reparto.
- Repartos: listado simple, pantalla de nuevo reparto, detalle de un único reparto y Volver.
- Reasignar chofer antes de iniciar; respetar aceptación del nuevo asistente y revocar acceso anterior.
- Retiro de reparto de prueba confirmado por el usuario y realizado mediante papelera recuperable. Sin modificar clientes ni inventario. No se eliminan otros repartos por inferencia.

Estados y publicaciones verificadas se registran en NOTAS.md. No marcar el lote entero terminado por haber publicado solo una parte.

Bloques implementados: contactos/indicaciones, altura escrita, cargos sucesivos y pago a cuenta, total de deuda, correccion de total propio, horario sin cierre y frecuencia semana por medio. Pendientes de este lote: agenda extraordinaria con hora/avisos, mapa de planificacion, simplificacion de repartos y cambio de chofer.
