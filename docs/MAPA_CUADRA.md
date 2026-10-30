# Clientes de la cuadra y proximidad GPS

Para el jefe que realiza su reparto y el asistente con recorrido aceptado:

1. Abrir el reparto y tocar **Ver mapa del reparto**.
2. Elegir una parada en el mapa o en el selector.
3. Tocar **Ver clientes de esta cuadra**. Aparecen nombres, alturas y estado de las paradas del mismo reparto.
4. Tocar **Ver parada de [nombre]** para seleccionar a ese cliente y atenderlo desde la parada.

La lista utiliza calle y centena de altura, por ejemplo 8741 y 8771. Compara localidades; si falta ese dato, exige coordenadas separadas por hasta 250 metros para agrupar. Una direccion sin formato calle/altura no se adivina. Puede faltar algun vecino si su direccion o ubicacion no estan completas. No incluye clientes ajenos al recorrido del asistente.

## Consultar llegada

En el mapa, tocar **Ver mi ubicacion actual** y permitir GPS. Una muestra reciente con precision de 50 metros o mejor permite mostrar **Estas cerca de estas paradas** cuando hay clientes pendientes a 60 metros o menos. Puede haber varios: el chofer confirma la casa y selecciona uno. Tambien incluye ausentes marcados para volver mas tarde hoy; omite atendidos, quienes no compraron y visitas pospuestas para otro dia.

La sugerencia vence a los 30 segundos y se descarta al ocultar el mapa/pagina. Volver a consultar para actualizarla. No se solicita GPS al abrir la pantalla, no se sigue ubicacion en segundo plano, no se envia al jefe y no se registra una visita, entrega o cobro por detectar proximidad. El seguimiento continuo y los avisos al jefe son pendientes separados.

## Verificacion

Pruebas locales con ubicaciones y clientes ficticios: agrupacion, orden, localidades diferentes, GPS impreciso/vencido, seleccion explicita, bloqueo durante operaciones y perdida de visibilidad. Mapa Leaflet y GPS simulados en las pruebas de pantalla; recepcion/precision real en un telefono y revision visual movil/PC requieren prueba del usuario.
