# Doble factor del superadministrador

## Activar desde tu cuenta

1. Ingresar a HidroTrack con el correo y contraseña de superadministrador.
2. Abrir **Seguridad** en el menú, o https://hidrotrack.matilegen.workers.dev/?admin=seguridad .
3. Tocar **Activar doble factor**.
4. Escanear el QR con una aplicación autenticadora compatible con TOTP. Si se está usando el mismo teléfono, tocar **Ingresar clave manualmente** y agregarla en la aplicación.
5. Escribir los seis números del autenticador y tocar **Confirmar y activar**.

La protección de la cuenta se activa solo cuando Supabase confirma un código correcto. Instalar el código de la aplicación no registra un teléfono ni completa la activación. El agente no genera ni ve el QR de la cuenta real. No compartir QR, clave ni códigos por chat; conservar el autenticador con un respaldo seguro.

## Al volver a ingresar

Después de la contraseña, si la sesión aún no verificó el segundo factor, aparece la pantalla del código. Una sesión que ya está verificada puede continuar sin repetirlo en cada recarga. Un error de conexión no permite entrar por defecto. Actualizar el estado permite revisar una confirmación cuya respuesta se perdió.

Si un alta quedó sin completar y se perdió el QR, la sección permite **Descartar alta incompleta** y comenzar de nuevo. No borrar un autenticador que ya fue activado por confundirlo con un alta pendiente.

## Desactivar o perder el teléfono

Para desactivar desde Seguridad hay que ingresar un código actual, confirmar la decisión y superar una nueva verificación antes de quitar ese autenticador. Supabase también exige AAL2 para eliminar un factor verificado. Si es el último, la cuenta vuelve al ingreso con contraseña; la interfaz actualiza la sesión.

Recuperar la contraseña por correo **no elimina el doble factor**. Si se pierde el teléfono y no existe respaldo del autenticador, la recuperación requiere asistencia del propietario del proyecto desde Supabase Auth, verificando previamente la identidad. No se agregó ningún endpoint público de recuperación, contraseña maestra ni bypass por correo. No se generaron códigos de recuperación como parte de esta entrega.

## Alcance técnico

- Solo superadministración en esta etapa; no cambia permisos de negocio ni exige MFA a jefes/asistentes.
- `is_platform_admin` identifica el rol de la propia sesión incluso a AAL1, para poder mostrar el desafío. No es autorización para leer datos administrativos.
- `private.is_admin` exige JWT `aal2` cuando ese usuario tiene un TOTP verificado en Auth. Esa guardia protege las RPC y políticas RLS de administración, papelera, uso por cuenta, licencias e historial.
- `admin_mfa_state` devuelve únicamente `enabled` y `allowed` del administrador actual. Acceso anónimo revocado. No expone factores, secretos ni códigos.
- Edge `admin-users` conserva validación de identidad con Auth y agrega la comprobación de permisos de la sesión original mediante el RPC anterior, antes de crear usuarios. Conserva su autenticación propia y la configuración previa `verify_jwt=false`; nunca se confía en el `aal` enviado en el cuerpo de la solicitud.
- El QR se presenta como imagen SVG `data:` de la respuesta de Auth, sin insertar HTML ni usar un generador externo. Clave y códigos solo en estado de memoria del componente, no en Git, archivos, URLs, registros ni almacenamiento propio. Supabase conserva la sesión de autenticación mediante su SDK como antes.
- Demo de administración: menú Seguridad con simulación explícita, sin registrar autenticadores ni generar QR reales.

## Verificación

Pruebas con datos ficticios: TOTP pendiente no bloquea; verificado más AAL1 bloquea APIs y cambios de licencias; AAL2 permite al rol correcto; un jefe no obtiene privilegios por tener AAL2. Pruebas de alta, código incorrecto, error de estado, respuesta perdida y desactivación con código nuevo. La verificación criptográfica y los límites de intentos corresponden a Supabase Auth, no a un código local de prueba.

No se activó ni desactivó ningún factor real para QA. El primer escaneo y código real del usuario y la comprobación en teléfono/PC quedan a cargo del usuario. El estado remoto consultado al instalar se documenta sin secretos en ESTADO_REAL.md.

Fuentes: [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [exigir MFA en el servidor](https://supabase.com/docs/guides/auth/auth-mfa), [retirar un factor verificado](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).
