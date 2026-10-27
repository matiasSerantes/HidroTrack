# Planificar visitas y reutilizar recorridos

## En la planilla del cliente

El primer recuadro muestra la franja de 24 horas y la fecha habitual mas proxima calculada con sus dias guardados. Se actualiza al cambiar dia/horario. La fecha es una referencia habitual: no equivale a una visita confirmada en un recorrido. Los errores de consulta no se presentan como horario libre.

## Preparar manana

Mi jornada y Repartos muestran la fecha de manana en Argentina, cantidad de clientes activos con dia habitual y si ya hay repartos abiertos para esa fecha. El boton abre Preparar reparto con esa fecha. Si ya hay repartos, se avisa antes de generar otro; no se duplica automaticamente.

En el selector se pueden seleccionar juntos los clientes del dia y agregar excepciones. El orden inicial prioriza el inicio de horario; sin franja queda al final. Subir/Bajar permite revisar el orden cuando el contrato nuevo del servidor esta disponible. No es optimizacion por distancia ni garantiza cumplir todas las franjas.

## Plantillas en la cuenta (activas)

Cargar una plantilla trae clientes y orden; revisar fecha, repartidor, clientes y orden antes de Guardar reparto. Se omiten clientes que ya no aparecen activos en la lista y se avisa; el servidor rechaza ademas clientes pendientes de recuperacion. La carga del camion se registra aparte y una sola vez para cada reparto nuevo.

Guardar como plantilla pide un nombre. Se puede guardar la seleccion en preparacion, elegir un reparto existente o hacerlo desde Finalizar mi reparto antes de confirmar el cierre. Tambien se puede guardar un reparto cerrado: el historial no se borra al dejar de mostrarse entre activos. Solo se conservan clientes activos y su orden, no resultados, deudas, ventas, pagos ni cargas.

Las plantillas son del jefe/empresa y se consultan desde su cuenta en otras PCs. No se usa localStorage como sustituto del servidor. Asistentes y otros jefes no pueden verlas. Maximo 200 por empresa; en este incremento no se implementa gestion de borrado/renombrado.

## Recordatorio de las 20:00

Implementado en pantalla: despues de las 20:00 de Argentina el recuadro recuerda los clientes de manana y ofrece preparar el recorrido. Se actualiza cada minuto mientras la pagina esta abierta.

El envio Web Push esta implementado con preferencia explicita por jefe y empresa, ademas del permiso del celular. No se activa por tener avisos de horarios. En Mi jornada o Repartos, desde celular, activar primero los recordatorios y aceptar el permiso; despues tocar **Activar aviso de las 20**. En iPhone/iPad abrir la aplicacion desde el icono agregado a pantalla de inicio. PC muestra agenda, sin pedir permiso de notificaciones.

El programador revisa cada minuto. A partir de las 20:00 de Argentina genera un solo aviso por cuenta/empresa/dispositivo para los clientes con visita habitual manana, activos y sin recuperacion pendiente. Si ya hay reparto preparado, avisa para revisarlo; si no hay, invita a armarlo. El aviso incluye cantidad, no nombres, deudas ni direcciones. Se valida pertenencia/licencia/consentimiento y se vuelve a comprobar antes de enviar. Desactivar la preferencia o retirar el permiso impide nuevos envios; un mensaje ya en transito puede llegar tarde.

No envia avisos a las 19:59 ni recupera avisos despues de las 21. Reintentos limitados con lease y deduplicacion; errores 404/410 desactivan la suscripcion caducada. El telefono necesita Internet y puede demorar/silenciar segun sistema/ahorro de bateria. El mismo dispositivo descarta mensajes vencidos, de otra cuenta y duplicados del mismo dia. Al tocar abre la empresa y fecha correctas, validadas contra la membresia propietaria; no crea un reparto automaticamente.

Cola y emisor diarios independientes de los recordatorios de franjas existentes. No se cambio el cron ni el emisor de horarios. Servicio diario habilitado en produccion tras verificar receptor y web publicados; ninguna preferencia de usuario se activa automaticamente.

## Activacion de plantillas y orden persistido

Migracion aplicada por MCP `20261027193814_route_templates.sql`: tabla route_templates con RLS de lectura solo propietario y escrituras por RPC; listado/guardado por ID idempotente; captura desde recorrido; creacion atomica con posiciones en el orden elegido. Envuelve inventory_create_trip conservando permisos, invitaciones y reglas actuales. El reintento no cambia posiciones de un viaje ya existente ni duplica por cambios posteriores de un cliente.

Aplicadas tambien `20261027194519_planning_reminders.sql` y `20261027194537_planning_reminder_scheduler.sql`. Edge Function planning-reminders v1 activa, autenticacion propia por secreto del programador ya custodiado; no se expusieron claves. Cron hidrotrack-planning-reminders separado. Estado de preferencias/cola privado; endpoints de reclamo/finalizacion solo service_role. Sin escrituras de negocio para validar.

## Verificacion

Pruebas locales de servidor cubren aislamiento de propietarios/asistentes, guardado idempotente, ausencia de movimientos de stock/caja, orden de paradas, reintento y captura desde reparto. Pruebas UI cubren fechas Argentina/cambio de mes, filtrado de clientes inactivos al cargar, reordenamiento, no simular plantillas sin contrato y reintento con mismo ID tras mala conexion. QA visual telefono/PC y prueba conectada pendientes.

27/10/2026 - Verificacion: suite completa 499/499 y build aprobados. Prueba real de emisor autenticado HTTP 200, contadores cero; sin credencial HTTP 401. Plantillas con RLS y sin INSERT directo anon/authenticated. Publicacion y activacion global verificadas; recepcion fisica requiere consentimiento y prueba en telefono.

## Estado final de este incremento (27/10/2026)

Plantillas y orden activos; servicio diario activo, cron correcto cada minuto, limitado a 20:00-21:00 de Argentina por el despachador y por la cola. 45 migraciones instaladas y 53 tablas publicas con RLS. Receptor/controles publicados en AccountWorkspace-uDfJwI5m.js y sw.js. Prueba de cola fuera de horario devuelve cero, ultima ejecucion cron succeeded. Ninguna preferencia se activo ni se enviaron mensajes reales para probar. La recepcion con telefono bloqueado y QA visual autenticada en movil/PC quedan por comprobar con el usuario.

Para deshabilitar el servicio entero en una incidencia, soporte puede poner private.planning_push_config.enabled=false mediante MCP; no cambia preferencias, datos de negocio ni los avisos de horarios. Un despliegue nuevo del esquema lo deja apagado por defecto hasta que se verifique el emisor/receptor y se habilite expresamente.
