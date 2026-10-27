# Horarios de visita y recordatorios

## Configurar el horario

1. Entrar en **Clientes → Planilla → Visitas y pedido habitual**.
2. En **Horario en que te espera**, elegir hora y minutos en **Te espera desde** y **Te espera hasta**. El selector usa 24 horas: por ejemplo, hora 08 y minutos 30 para 08:30; hora 18 y minutos 30 para 18:30. Revisar la franja elegida antes de guardar.
3. Tocar **Guardar horario de visita**. La franja es del mismo dia y se aplica a las visitas de ese cliente; los dias habituales siguen configurandose arriba.
4. Para quitarla, elegir **Sin horario** en ambos campos y guardar. Horarios de Argentina.

Al preparar el reparto, cada cliente que tenga horario muestra su franja. Tambien aparece junto a la parada al abrir el recorrido. El orden de visitas sigue siendo el del reparto.

## Activar en el celular

1. Abrir el reparto propio o el reparto aceptado como asistente desde el telefono.
2. Tocar **Activar recordatorios en este celular** y aceptar el permiso del navegador.
3. En iPhone/iPad, primero agregar HidroTrack a la pantalla de inicio y abrir desde ese icono; despues activar los avisos. Se muestra una indicacion si no esta instalada.

El permiso se solicita solo al tocar el boton desde un dispositivo detectado como celular/tablet. En PC quedan los recordatorios de la pagina sin pedir permiso de notificaciones del sistema. Cada dispositivo se activa por separado y puede desactivarse desde el mismo recuadro.

## Cuando avisa

Con reparto activo asignado al usuario, empieza una hora antes de la franja y repite en bloques de 30 minutos. Para 16:00 a 17:00: 15:00, 15:30, 16:00, etc. No envia una rafaga de avisos atrasados; prepara el bloque vigente. No se repite cada minuto aunque el programador revise cada minuto.

Los siguientes avisos se detienen al registrar la entrega o una visita resuelta, tocar **No llegue a horario**, cerrar el reparto, revocar la invitacion o perder vigencia el acceso/licencia. No llegue detiene avisos, pero deja la visita pendiente para decidir cuando volver; no inventa entrega, cobro ni movimiento de stock. Los avisos corresponden al repartidor asignado, sea el jefe que hace su reparto o el asistente con aceptacion vigente.

Los avisos de fondo usan Web Push y un receptor instalado en el navegador, por eso pueden llegar con la pestaña cerrada. Requieren permiso, conectividad y soporte del telefono; el sistema operativo, ahorro de bateria o No molestar pueden demorarlos/silenciarlos. Una notificacion que ya salio hacia el proveedor puede estar en transito cuando se resuelve la visita. Al resolver desde la pagina del mismo telefono tambien se cierran avisos anteriores y se descartan mensajes tardios de esa parada. Al cerrar sesion se retira la suscripcion del dispositivo y se elimina su cuenta activa del receptor.

## Estado de implementacion — 26/10/2026

- Migraciones `20261026171941_visit_windows_push.sql` y `20261026171957_visit_reminder_scheduler.sql` aplicadas por MCP. 42 migraciones instaladas; 52 tablas publicas con RLS.
- Cola privada con deduplicacion por dispositivo/reparto/cliente/franja/bloque, leases, reintentos limitados y desactivacion de suscripciones caducadas. Claves de envio en secretos de Edge Functions; secreto del programador en Vault. Ninguna clave privada va en Git.
- Edge Function `visit-reminders` exige autenticacion propia de la tarea; solicitud sin credencial devuelve 401. Solo service_role puede reclamar/finalizar la cola.
- Cron `hidrotrack-visit-reminders` activo cada minuto. Invocacion real de programador a Edge devuelve HTTP 200 y las ejecuciones automaticas figuran exitosas, sin destinatarios ni mensajes reales durante la comprobacion.
- Suite completa: 469 pruebas y compilacion aprobadas. Pruebas locales cubren permisos, 15:00/15:30, no duplicacion por minuto, entrega/No llegue/revocacion/licencia, consentimiento movil y receptor tras cerrar/cambiar cuenta.
- Publicacion de recursos web verificada por HTTP el 26/10/2026 (pantalla, manifest y sw.js con MIME JavaScript). Recepcion real con telefono bloqueado requiere que el usuario active y pruebe en su dispositivo; no se pidio permiso ni se suscribio un telefono automaticamente para probar.

Fuentes: [programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Web Push en iOS](https://webkit.org/blog/13878/), [emisor Web Push](https://github.com/web-push-libs/web-push).

## Preparar por dia
En Repartos y camion, elegir Fecha del reparto. La lista muestra los clientes con ese dia habitual, primero los horarios de inicio tempranos y al final quienes no tienen franja. Marcar los clientes y Guardar reparto. Para una visita excepcional activar Mostrar tambien clientes de otros dias o sin dia asignado. Cambiar fecha borra la seleccion anterior; cambiar solo el filtro conserva seleccionados y avisa si alguno queda oculto. La lista ordenada es una ayuda de preparacion, no optimiza calles ni garantiza el orden final del recorrido.

## Aviso de las 20 para preparar manana (27/10/2026)
Desde Mi jornada o Repartos en el celular, abrir Preparar manana. Activar recordatorios y aceptar el permiso; despues tocar Activar aviso de las 20 para esa empresa. Es una preferencia independiente de los horarios. Cada dia con clientes habituales de manana recibe un aviso; si ya hay reparto, invita a revisarlo. Tocar abre fecha/empresa correctas y no crea viajes. Desactivar aviso de las 20 conserva los recordatorios de visitas. Detalles y estado: PLANIFICACION_Y_PLANTILLAS.md.
