# Planificar visitas y reutilizar recorridos

## En la planilla del cliente

El primer recuadro muestra la franja de 24 horas y la fecha habitual mas proxima calculada con sus dias guardados. Se actualiza al cambiar dia/horario. La fecha es una referencia habitual: no equivale a una visita confirmada en un recorrido. Los errores de consulta no se presentan como horario libre.

## Preparar manana

Mi jornada y Repartos muestran la fecha de manana en Argentina, cantidad de clientes activos con dia habitual y si ya hay repartos abiertos para esa fecha. El boton abre Preparar reparto con esa fecha. Si ya hay repartos, se avisa antes de generar otro; no se duplica automaticamente.

En el selector se pueden seleccionar juntos los clientes del dia y agregar excepciones. El orden inicial prioriza el inicio de horario; sin franja queda al final. Subir/Bajar permite revisar el orden cuando el contrato nuevo del servidor esta disponible. No es optimizacion por distancia ni garantiza cumplir todas las franjas.

## Plantillas en la cuenta (servidor pendiente de activar)

Cargar una plantilla trae clientes y orden; revisar fecha, repartidor, clientes y orden antes de Guardar reparto. Se omiten clientes que ya no aparecen activos en la lista y se avisa; el servidor rechaza ademas clientes pendientes de recuperacion. La carga del camion se registra aparte y una sola vez para cada reparto nuevo.

Guardar como plantilla pide un nombre. Se puede guardar la seleccion en preparacion, elegir un reparto existente o hacerlo desde Finalizar mi reparto antes de confirmar el cierre. Tambien se puede guardar un reparto cerrado: el historial no se borra al dejar de mostrarse entre activos. Solo se conservan clientes activos y su orden, no resultados, deudas, ventas, pagos ni cargas.

Las plantillas son del jefe/empresa y se consultan desde su cuenta en otras PCs. No se usa localStorage como sustituto del servidor. Asistentes y otros jefes no pueden verlas. Maximo 200 por empresa; en este incremento no se implementa gestion de borrado/renombrado.

## Recordatorio de las 20:00

Implementado en pantalla: despues de las 20:00 de Argentina el recuadro recuerda los clientes de manana y ofrece preparar el recorrido. Se actualiza cada minuto mientras la pagina esta abierta.

**Pendiente: envio Web Push de las 20:00 con la pagina cerrada.** El programador existente actualmente envia recordatorios de franjas de visitas; no se reutiliza ni se presenta como si ya emitiera avisos de preparacion del dia siguiente. Falta agregar cola diaria deduplicada por empresa/usuario/dispositivo, validar licencia y consentimiento, ampliar emisor/receptor, probarlo y activarlo mediante MCP. No hay un envio automatico nuevo ni cambios de cron en produccion durante esta tarea.

## Activacion de plantillas y orden persistido

Migracion preparada `20261027010000_route_templates.sql`: tabla route_templates con RLS de lectura solo propietario y escrituras por RPC; listado/guardado por ID idempotente; captura desde recorrido; creacion atomica con posiciones en el orden elegido. Envuelve inventory_create_trip conservando permisos, invitaciones y reglas actuales. El reintento valida el orden original y no reordena un viaje ya existente.

La migracion NO se aplico en Supabase: MCP ausente en esta sesion. La interfaz consulta disponibilidad: si no encuentra contrato, mantiene creacion anterior sin afirmar que se guarda orden personalizado; los botones de orden no se habilitan y las plantillas se muestran no disponibles. No hay fallback que copie datos privados a un navegador.

Al recuperar MCP: revisar registro de migraciones y esquema actual; aplicar migracion autorizada de este pedido; verificar RLS/permisos y pruebas aisladas sin modificar clientes reales. Luego comprobar guardado/carga de plantilla con cuenta de prueba en dos dispositivos y crear/cerrar un recorrido de prueba con orden. No cambiar licencias, secretos ni datos de negocio al activar.

## Verificacion

Pruebas locales de servidor cubren aislamiento de propietarios/asistentes, guardado idempotente, ausencia de movimientos de stock/caja, orden de paradas, reintento y captura desde reparto. Pruebas UI cubren fechas Argentina/cambio de mes, filtrado de clientes inactivos al cargar, reordenamiento, no simular plantillas sin contrato y reintento con mismo ID tras mala conexion. QA visual telefono/PC y prueba conectada pendientes.
