# Ingresar o registrarse con Google

El botón **Continuar con Google** está preparado en ingreso y registro. Una consulta pública a Supabase determina si el proveedor está habilitado. Si sigue apagado, el botón informa configuración pendiente; no envía al usuario a una página de error. Se puede tocar **Revisar disponibilidad de Google** después de configurar el proveedor, sin recompilar.

Actualización verificada el 30/10/2026: Google ya está habilitado en la configuración pública de Supabase. Una solicitud de autorización devuelve 302 hacia accounts.google.com, con Client ID presente, estado OAuth y callback correcto del proyecto. Esto valida la preparación básica; el ingreso completo y el intercambio de credenciales siguen pendientes de una prueba del usuario. No se leyeron ni guardaron secretos, ni se crearon cuentas para probar.

## Configuración de referencia en Google y Supabase

1. Abrir [Google Auth Platform](https://console.cloud.google.com/auth/overview), seleccionar o crear el proyecto de HidroTrack y completar marca/audiencia según el asistente de Google. Si queda en modo de pruebas, agregar los correos de prueba autorizados antes de probar.
2. En **Clientes**, crear un cliente OAuth de tipo **Aplicación web**.
3. Origen JavaScript autorizado: `https://hidrotrack.matilegen.workers.dev`.
4. URI de redirección autorizada: `https://tuqdutglubkmuxumjqyv.supabase.co/auth/v1/callback`. Confirmarla también en la pantalla del proveedor Google del proyecto Supabase.
5. Copiar el **Client ID** y **Client Secret** directamente a **Supabase → Authentication → Sign In / Providers → Google** y habilitarlo. El secreto permanece en Supabase: no va en variables `VITE_`, Git ni chat.
6. En **Authentication → URL Configuration**, conservar Site URL `https://hidrotrack.matilegen.workers.dev/` y autorizar los regresos de esta integración. Puede utilizarse el patrón limitado a ese origen `https://hidrotrack.matilegen.workers.dev/**`, o estas URL explícitas:
   - `https://hidrotrack.matilegen.workers.dev/?acceso=google`
   - `https://hidrotrack.matilegen.workers.dev/?acceso=google&registro=jefe`
   - `https://hidrotrack.matilegen.workers.dev/?acceso=google&admin=seguridad`
   - `https://hidrotrack.matilegen.workers.dev/?acceso=google&admin=papelera`
   - `https://hidrotrack.matilegen.workers.dev/?acceso=google&admin=uso`
7. Guardar, volver a HidroTrack y tocar **Revisar disponibilidad de Google**. Probar luego un ingreso completo y un registro de jefe en una cuenta destinada a prueba. No probar creando empresas reales sin necesidad.

## Comportamiento de cuentas

- Google sirve para iniciar sesión o crear la cuenta Auth. El rol y las empresas continúan validándose en servidor.
- Para una cuenta nueva de jefe, elegir primero **Crear cuenta de jefe** y luego Google. Al volver se completa el alta de la empresa con el flujo existente; el navegador no asigna licencias ni privilegios de administrador.
- En ingreso general/registro de asistente, una cuenta nueva conserva el acceso independiente de asistente. Los usuarios existentes mantienen las membresías que ya tengan en el servidor.
- La vinculación de identidades del mismo correo la gestiona Supabase con sus validaciones. No se fusionan cuentas comerciales desde el navegador. Un correo Google diferente puede corresponder a otra cuenta; no transfiere el acceso del superadministrador.
- Usar Google no desactiva ni reemplaza TOTP. Un superadministrador que haya confirmado su autenticador continúa necesitando AAL2 para consultar o modificar datos administrativos.

## Implementación y límites

Se usa el SDK `signInWithOAuth` con selección de cuenta y regreso al origen actual, ruta raíz y parámetros propios permitidos. No se transportan claves, tokens, nombres, empresa ni destinos arbitrarios en la URL de regreso. El SDK actual conserva su flujo de autenticación; no se cambió globalmente a PKCE para evitar alterar recuperación de contraseña en otros dispositivos. La navegación es por redirección, sin scripts externos de Google ni ventanas embebidas; no requiere abrir la CSP a esos scripts.

Pruebas locales: proveedor apagado, habilitado simulado, regreso seguro y conservación del registro de jefe, sin llamadas reales a Google ni creación de usuarios. La consulta real de configuración pública solo lee disponibilidad; no demuestra que las credenciales OAuth funcionen ni que la pantalla de consentimiento haya sido aprobada.

Fuentes: [configurar Google en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking).
