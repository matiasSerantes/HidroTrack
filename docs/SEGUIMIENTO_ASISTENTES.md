# Ubicacion compartida durante el reparto

## Asistente

1. Aceptar e iniciar el reparto y abrir **Ver mapa del reparto**.
2. Tocar **Compartir ubicacion con mi jefe** y permitir GPS.
3. Esperar la confirmacion de envio. El jefe vera el punto aproximado y la parada que tenes seleccionada; eso no acredita que estes en la puerta ni registra una entrega.
4. Tocar **Dejar de compartir ubicacion** para detener. Ocultar/cerrar el mapa tambien lo detiene; al volver hay que activarlo de nuevo.

No se inicia por abrir la web ni por aceptar la invitacion. Solo se habilita para el asistente de un reparto activo aceptado, con membresia y licencia vigentes. Lecturas imprecisas (mas de 100 metros), vencidas o fuera de orden no reemplazan el punto valido. El envio se limita en cliente y servidor; se solicita lectura reciente aproximadamente cada 30 segundos y se limita el flujo a una escritura cada 15 segundos desde el telefono.

## Jefe

Abrir **Mapa de asistentes** desde el menu. Muestra los recorridos activos aceptados de su empresa, avance de atenciones y ubicaciones voluntariamente compartidas. Se consulta cada 15 segundos con la pantalla visible. La indicacion de parada es la seleccion del chofer, no una deteccion de presencia.

Si no hay punto reciente, aparece **Sin ubicacion reciente** y no se dibuja una coordenada vieja. Se muestra precision y antiguedad. Una respuesta de red demorada tampoco renueva artificialmente la fecha de un punto.

## Vigencia y seguridad

- Un unico punto por asistente/empresa en `driver_positions`, reutilizando la tabla existente. Sin historial de trayectos ni coordenadas en localStorage.
- Sesion explicita para compartir; detenerla invalida sus mensajes tardios. Una sesion vieja no puede detener la nueva de otro mapa.
- Revocar, reasignar, cerrar, desactivar membresia o cambiar vigencia de licencia invalida las sesiones. Aceptar de nuevo exige otra activacion explicita.
- El punto deja de ser visible al pasar unos 90 segundos sin lectura nueva. Si el telefono cierra sin conexion, el retiro inmediato puede no llegar al servidor; la vigencia limita la visualizacion.
- Purga cada minuto: elimina puntos vencidos de mas de cinco minutos o sin autorizacion; no conserva un recorrido historico. No es seguimiento de fondo con telefono bloqueado.
- Solo el jefe de esa empresa puede consultar el mapa. El asistente publica exclusivamente su propio punto para su reparto. Escritura directa/anonima bloqueada y RLS de lectura condicionada a sesion, permiso y vigencia.

## Estado y validacion

Migracion `20261102124543_live_trip_sharing` aplicada mediante MCP. Cero posiciones y sesiones activas al verificar la instalacion, sin activar GPS ni alterar cuentas/stock para QA. Pruebas locales de permisos, vigencia, orden, revocacion/reaceptacion, cierre de pantalla y respuestas tardias: 123 SQL y seis UI correctas. Mapa/GPS simulados; prueba fisica en telefonos y revision visual autenticada movil/PC pendientes. La demo conserva su simulacion de asistentes separada de la ubicacion real.
