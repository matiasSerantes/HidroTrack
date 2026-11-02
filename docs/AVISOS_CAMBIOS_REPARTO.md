# Avisos de cambios del jefe

El asistente ve **Cambios del jefe** al abrir un recorrido aceptado. El historial indica datos del cliente, horario o paradas agregadas, retiradas o reordenadas por el jefe. Permite actualizar el recorrido y marcar los avisos visibles como leidos. Se consulta cada 30 segundos con la pagina visible y al recuperar foco, sin descargar toda la cartera.

## Activar en el celular

1. Abrir un reparto aceptado desde el telefono.
2. En **Cambios del jefe**, activar el permiso de recordatorios del dispositivo si aun no esta activo.
3. Tocar **Activar avisos de cambios del jefe**. Esta preferencia esta apagada por defecto y es independiente del permiso previo de horarios.

Se aplica a los recorridos aceptados de la cuenta en los dispositivos que tengan permiso activo. Se puede desactivar la categoria sin quitar los recordatorios de horario. Desactivar el permiso del dispositivo detiene todos los avisos de ese dispositivo.

El aviso de pantalla bloqueada es generico: no muestra nombres, domicilios, deudas ni telefonos. Tocarlo abre HidroTrack con IDs del reparto; la aplicacion vuelve a verificar su invitacion antes de consultar informacion. Cambiar de usuario o cerrar sesion evita abrir avisos de la cuenta anterior.

## Limites y permisos

- Solo se generan cambios del jefe para el chofer asignado con invitacion aceptada, membresia/licencia activas y reparto planificado o activo. No se notifica al propio jefe por sus cambios.
- Las escrituras sin cambio efectivo de datos no duplican avisos. Cambios distintos pueden generar varios avisos.
- Revocar, reasignar, cerrar, suspender licencia o marcar el aviso leido impide nuevos envios pendientes. Los avisos ya enviados pueden demorar por el sistema del telefono; por eso no llevan datos personales.
- Historial de siete dias, hasta 50 avisos por consulta, priorizando no leidos. Purga en lotes. Los eventos privados guardan IDs y tipo; el nombre visible se consulta vigente sin copiar datos personales al historial.
- Cola separada, revision cada minuto cuando hay trabajo, lease de dos minutos y hasta tres intentos. No envia avisos historicos anteriores a la activacion. No garantiza entrega inmediata sin conexion.
- Nuevas suscripciones, preferencias y clientes reales no se modifican para probar. Pruebas locales usan datos y endpoints ficticios; recepcion en telefono bloqueado y revision visual autenticada pendientes.

## Instalacion verificada

Migraciones `20261030193344_route_change_alerts` y `20261030193404_route_change_scheduler` instaladas mediante MCP; Edge `route-changes` v1 activa con autenticacion por secreto de cron, igual al emisor existente. Tablas privadas sin acceso directo de usuarios; RPC propias limitadas al destinatario, cola exclusiva de servicio. Activacion global se realiza despues de verificar la interfaz y el worker publicados. Preferencias personales siguen apagadas hasta consentimiento.
