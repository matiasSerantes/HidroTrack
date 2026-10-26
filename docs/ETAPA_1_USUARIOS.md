# Etapa 1: usuarios y lista de asistentes

Fecha: 22/10/2026. Estado: implementacion parcial; no habilitar operacion real del asistente hasta completar la etapa 2.

## Codigo y base instalados

- Registro personal por Supabase Auth, nombre y confirmacion por correo. No crea empresa, licencia ni rol desde metadatos.
- Recuperacion por correo y formulario de nueva clave para sesion autenticada; no se guardan contrasenas en tablas ni archivos.
- Mis asistentes en el menu del jefe: agregar por ID HT-UUID, quitar de la lista y volver a agregar. No pide ni cambia la clave del asistente.
- Una identidad puede vincularse a varias empresas. Quitar conserva cuenta, movimientos e historial; bloqueado con repartos no cerrados.
- RPC con permiso de jefe, ID exacto, cuenta confirmada, auditoria e idempotencia por solicitud. No existe buscador publico de correos/cuentas.
- Mis jefes para el asistente devuelve solo nombres de empresa/jefe; no clientes, cartera ni stock.
- Planes de servidor: basic=1, intermediate=3, unlimited sin limite artificial. Seleccionables al editar licencia desde administracion. Las altas administrativas existentes siguen creando un cupo personalizado, que luego puede cambiarse de plan.
- Cupo protegido con bloqueo de licencia y trigger en todas las escrituras. Bajar a un plan insuficiente se rechaza. Las licencias previas conservaron sus limites como custom.
- Migracion aplicada por MCP: `20261022123826_assistant_links.sql`. Estado remoto: 23 migraciones y 35 tablas con RLS. No se crearon ni quitaron vinculos de usuarios para la comprobacion remota.

## Configuracion Auth corregida

URL publica: https://hidrotrack.matilegen.workers.dev/

Destinos permitidos de confirmacion/recuperacion agregados conservando otros destinos existentes. Recuperacion vuelve a `/?auth=recovery`. Confirmacion de correo permanece obligatoria; no se desactivo para evitar configurar el envio.

**Pendiente SMTP:** el proyecto no tiene SMTP propio configurado. El proveedor predeterminado restringe envios a direcciones del equipo; no considerar registro/recuperacion publica listos hasta configurar el proveedor y probar la recepcion. [Documentacion oficial](https://supabase.com/docs/guides/auth/auth-smtp).

No se enviaron mensajes ni se modificaron claves de cuentas existentes durante este avance. Despliegue publico y prueba visual movil/PC no comprobados en esta entrega.

## Bloqueo temporal aplicado con autorizacion

Tras el rechazo inicial de revision automatica, el usuario autorizo explicitamente el cambio global explicado. Aplicado por MCP como `20261022130128_assistant_waiting_access.sql`; SQL trasladado de pending a migrations con la version remota real.

Deshabilita temporalmente SOLO la rama driver de private.has_role. Conserva rama owner con licencia vigente y mecanismos independientes de administrador. El asistente mantiene perfil y nombres de jefes; no puede operar inventario, ventas, promociones, posiciones o recorridos por contratos antiguos. No modifica cuentas, stock ni licencias.

Etapa 2 debe reemplazar esta restriccion temporal por permisos sobre reparto aceptado y revisar todos los caminos; no basta con volver a habilitar la rama driver. Las integraciones operativas de asistentes permanecen deshabilitadas hasta entonces.

## Verificacion y proximo paso

Compilacion correcta. Comprobaciones dirigidas: 26 pruebas aprobadas de acceso/perfil/espacio y contratos; 7 pruebas de contratos aprobadas en la entrega anterior. Tras incorporar la migracion instalada, 7 comprobaciones dirigidas aprobadas otra vez. Verificacion remota de solo lectura: jefe conserva acceso, identidad driver comprobada, acceso operativo driver denegado, perfil propio y lista basica disponibles. Suite completa, concurrencia real, entrega de correos y circuito extremo a extremo pospuestos; no se presentan como verificados.

Pendientes para cerrar etapa 1: configurar envio Auth y validar publicacion. Luego continuar etapa 2: invitaciones, aceptacion y permisos por recorrido. Foto/terminacion visual se mantienen para la etapa 7 segun el plan.

Actualizacion SMTP 22/10: el usuario configuro Gmail. Consulta de lectura confirma host/puerto, remitente/usuario esperados y URLs correctas. Configuracion verificada; autenticacion/envio, recepcion y recuperacion completa aun pendientes. Las menciones previas a SMTP sin configurar son historicas. Sin secretos en Git.


## 2026-10-25 - Alta real de jefes con prueba gratuita

Registro conectado en /?registro=jefe: crear cuenta de jefe, confirmar correo y Crear mi empresa. Prueba gratuita de 30 dias desde el alta de empresa, plan basico con 1 asistente. Luego administracion puede cambiar la licencia conservando empresa y datos. No incluye cobro automatico.

Migracion 20261025044949_owner_signup.sql aplicada por MCP. Estado comprobado: 35 migraciones y 49 tablas publicas con RLS; politica auto_trial=true, trial_days=30. Nuevas owner_signup_policy y owner_registrations. Alta transaccional verificada por Auth, solo empresa propia; metadatos no conceden privilegios. Reintento reutiliza empresa sin duplicar ni renovar prueba. Licencias existentes intactas. Cero altas reales durante verificacion.

Verificacion local: 67 contratos SQL/permisos y 9 pruebas de acceso/formulario aprobados; build correcto. Publicacion pendiente de verificar tras push. Prueba manual autenticada de correo, alta y uso movil/PC pendiente; no se enviaron correos ni crearon cuentas reales para probar.

Publicacion verificada el 25/10/2026: HTTP 200, formulario Crear cuenta de jefe y RPC owner_create_workspace presentes en recursos publicos (AccountWorkspace-Cl6JIRc9.js), tras push e59bae0. Enlace compartible: https://hidrotrack.matilegen.workers.dev/?registro=jefe. No se inicio sesion ni se enviaron correos para comprobar; prueba manual autenticada pendiente.

## 2026-10-26 - Registro con validacion visible
Se completa cambio local pendiente de AccountAccess: error especifico junto al campo, foco en primer dato invalido, contador de longitud, coincidencia de claves, mostrar/ocultar ambas y bloqueo de doble envio. Error conserva nombre/empresa/correo y limpia claves. Registro sin sesion deja pantalla separada con correo, pasos y acciones para ingresar/recuperar/corregir; identidad oculta por duplicado no afirma creacion nueva. Respuesta vacia no da exito falso. Recuperacion existente conserva entrada automatica al confirmar guardado.
Consulta de solo lectura a /auth/v1/settings confirma email habilitado, registro habilitado y mailer_autoconfirm=false. Hoy requiere confirmar correo para usar cuenta; no existe aprobacion humana para la prueba gratuita. No se desactiva confirmacion ni se confunde autoconfirmar con verificar correo. Regla de acceso provisional de 24 horas sigue pendiente de diseno/implementacion de servidor y configuracion Auth; no se presenta como lista.
Pruebas dirigidas 16/16, suite completa 446/446 y build correctos. Sin crear cuentas ni enviar correos reales para probar. Publicacion pendiente de verificar. Cubre causa del reporte de validacion generica del registro.

Publicacion del registro verificada el 26/10/2026 tras 602610c: HTTP 200, index-DE7AkqCg.js contiene access-complete y access-password-toggle. No se crean cuentas ni envian correos para verificar. QA manual pendiente. Gracia de 24 horas aun no habilitada.

## 2026-10-26 - Gracia 24 horas preparada, pendiente de autorizacion especifica
Rama feature/email-verification-grace: migracion, pantalla de aviso/reenvio, bloqueo temporal de API/tablas, prueba firmada de correo y reversion previa a activar. Suite completa 456/456 y build correctos. Incluye 79 API SECURITY DEFINER y politicas restrictivas para 50 tablas publicas. No hay backfill de cuentas existentes ni cambios de stock, deudas, licencias o recorridos.
Revision automatica rechazo apply_migration por alcance amplio, dificultad de revertir y posible bloqueo de operaciones; no se ejecuto ni se reintento por otra via. MCP confirma migracion ausente y email_access_status inexistente. Posteriormente se completo suite y se agrego/probo copia exacta de funciones y rollback seguro previo a activar, que se niega tras activacion/usuarios provisionales. Estos controles no se presentaron como autorizacion para cambiar produccion.
Estado de produccion: confirmacion previa de correo sigue activa; main permanece en af0af2d. Preparacion en rama separada para no romper ingreso al llamar un RPC aun no instalado. Plan concreto y alcance en docs/ACTIVACION_CORREO_24H.md. Se requiere autorizacion especifica para aplicar migracion de ese alcance y luego publicar/activar; no solicitar token al usuario ni subir credenciales. Entrega/recepcion de correo y circuito entre dispositivos aun pendientes de QA manual consentida.
