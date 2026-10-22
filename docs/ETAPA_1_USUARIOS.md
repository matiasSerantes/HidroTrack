# Etapa 1: usuarios y lista de asistentes

Fecha: 22/10/2026. Estado: implementacion parcial; no habilitar operacion real del asistente hasta completar el bloqueo de permisos y la etapa 2.

## Codigo y base instalados

- Registro personal por Supabase Auth, nombre y confirmacion por correo. No crea empresa, licencia ni rol desde metadatos.
- Recuperacion por correo y formulario de nueva clave para sesion autenticada; no se guardan contrasenas en tablas ni archivos.
- Mis asistentes en el menu del jefe: agregar por ID HT-UUID, quitar de la lista y volver a agregar. No pide ni cambia la clave del asistente.
- Una identidad puede vincularse a varias empresas. Quitar conserva cuenta, movimientos e historial; bloqueado con repartos no cerrados.
- RPC con permiso de jefe, ID exacto, cuenta confirmada, auditoria e idempotencia por solicitud. No existe buscador publico de correos/cuentas.
- Mis jefes para el asistente devuelve solo nombres de empresa/jefe; no clientes, cartera ni stock.
- Planes de servidor: basic=1, intermediate=3, unlimited sin limite artificial. Seleccionables al editar licencia desde administracion. Las altas administrativas existentes siguen creando un cupo personalizado, que luego puede cambiarse de plan.
- Cupo protegido con bloqueo de licencia y trigger en todas las escrituras. Bajar a un plan insuficiente se rechaza. Las licencias previas conservaron sus limites como custom.
- Migracion aplicada por MCP: `20261022123826_assistant_links.sql`. Estado remoto: 22 migraciones y 35 tablas con RLS. No se crearon ni quitaron vinculos de usuarios para la comprobacion remota.

## Configuracion Auth corregida

URL publica: https://hidrotrack.matilegen.workers.dev/

Destinos permitidos de confirmacion/recuperacion agregados conservando otros destinos existentes. Recuperacion vuelve a `/?auth=recovery`. Confirmacion de correo permanece obligatoria; no se desactivo para evitar configurar el envio.

**Pendiente SMTP:** el proyecto no tiene SMTP propio configurado. El proveedor predeterminado restringe envios a direcciones del equipo; no considerar registro/recuperacion publica listos hasta configurar el proveedor y probar la recepcion. [Documentacion oficial](https://supabase.com/docs/guides/auth/auth-smtp).

No se enviaron mensajes ni se modificaron claves de cuentas existentes durante este avance. Despliegue publico y prueba visual movil/PC no comprobados en esta entrega.

## Bloqueo pendiente de autorizacion

La revision automatica rechazo aplicar `supabase/pending/assistant_waiting_access.sql`: reemplaza globalmente `private.has_role`, usada por varios permisos, y podria bloquear/alterar accesos. La autorizacion de etapa 1 no fue considerada suficiente para ese cambio amplio sin auditar consumidores. No se aplico ni se ejecuto por otro camino.

Propuesta concreta: deshabilitar temporalmente SOLO la rama de rol driver en ese helper; mantener la rama owner con licencia vigente y los mecanismos independientes de administrador. El asistente conserva su perfil y los nombres de jefes via RPC, pero no opera stock, ventas, promociones, posiciones o recorridos mediante contratos antiguos. No cambia cuentas, cantidades, roles guardados ni licencias. En etapa 2 se reemplazara este bloqueo por acceso limitado al reparto aceptado, revisando todos los caminos.

Impacto/riesgo: cualquier integracion que use esa rama driver dejaria de funcionar hasta etapa 2. Inspeccion remota actual: cero repartos abiertos; 38 funciones y 16 politicas consumen directamente el helper, ademas de consumidores indirectos. Esta cuenta de dependencias no equivale a prueba exhaustiva de todos los circuitos.

Mientras este pendiente, los contratos antiguos siguen autorizando ciertos datos por asignacion sin aceptacion. Vincular por si solo no asigna un reparto, pero no debe probarse con cartera real ni presentarse como aislamiento terminado.

El SQL se conserva fuera de migrations para impedir su aplicacion accidental por una herramienta de sincronizacion. Requiere aprobacion explicita antes de aplicarlo, o una revision mas acotada de permisos en la etapa 2.

## Verificacion y proximo paso

Compilacion correcta. Comprobaciones dirigidas: 26 pruebas aprobadas de acceso/perfil/espacio y contratos; tras separar el SQL pendiente, 7 pruebas de contratos aprobadas. Una de las siete prueba SOLO la propuesta local no instalada. Suite completa, concurrencia real, entrega de correos y circuito extremo a extremo pospuestos; no se presentan como verificados.

Pendientes para cerrar etapa 1: decidir/aprobar proteccion de acceso, configurar envio Auth y validar publicacion. Luego continuar etapa 2: invitaciones, aceptacion y permisos por recorrido. Foto/terminacion visual se mantienen para la etapa 7 segun el plan.
