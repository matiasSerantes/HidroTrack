# Acceso provisional por 24 horas — preparado, sin activar

26/10/2026. Rama `feature/email-verification-grace`. Produccion sigue con confirmacion previa de correo. La migracion fue rechazada por revision automatica antes de ejecutarse; MCP confirma que no esta instalada y que el nuevo RPC no existe. No se cambio configuracion Auth.

## Comportamiento preparado

- Una nueva cuenta email obtiene una sesion y un plazo fijo de 24 horas desde su creacion.
- La pantalla solicita un enlace por Supabase Auth, muestra el tiempo restante y permite reenviarlo. No crea otra cuenta al pedir el enlace.
- Al vencer el plazo se bloquean las operaciones y lecturas del programa desde la base, aunque alguien conserve una sesion o intente usar la API directamente.
- Abrir el enlace valida el correo actual mediante informacion de autenticacion firmada por Supabase. Saber la clave o editar metadatos no cuenta como verificacion.
- Validar tarde recupera la misma cuenta y empresa, sin borrar clientes, stock o movimientos y sin renovar la licencia/prueba gratuita.
- Cambiar correo no renueva el plazo. Las cuentas existentes al activar no reciben esta restriccion nueva.

## Alcance que necesita autorizacion especifica

La migracion `supabase/migrations/20261026100000_email_verification_grace.sql` prepara tres tablas privadas: politica de activacion, seguimiento de correo y copia exacta de definiciones para reversion previa. Agrega un trigger sobre nuevas cuentas/cambios de correo, dos helpers privados de acceso y el RPC `email_access_status` para consultar/confirmar el estado propio.

Agrega un control de acceso antes del cuerpo original de las **79 funciones publicas SECURITY DEFINER** ejecutables por usuarios autenticados y una politica restrictiva en las **50 tablas publicas con RLS**. Las firmas y reglas de negocio se conservan. Se cubren lecturas, escrituras y funciones que normalmente evitan RLS por ejecutar con privilegios del servidor. No elimina registros, no mueve stock, no cambia deudas y no cambia licencias.

El riesgo es una interrupcion de operaciones si una funcion o politica se integrara incorrectamente. Por ese alcance, la revision automatica rechazo aplicar la migracion bajo la autorizacion general de la funcionalidad. No se intento aplicarla por otra via.

## Orden de activacion, solo despues de autorizacion

1. Aplicar la migracion por MCP con politica desactivada; verificar copia de definiciones, firmas, cantidad de controles y ausencia de usuarios rastreados. Hasta aca no se habilita acceso provisional ni cambia la configuracion Auth.
2. Integrar y publicar la rama; verificar los recursos de la pantalla y acceso de cuentas existentes.
3. Activar la politica privada para registrar unicamente nuevas cuentas email. No hacer backfill de usuarios existentes.
4. Ajustar solo `mailer_autoconfirm` en Auth para emitir sesion al registrarse. Esto deja de ser prueba de que la persona verifico el buzon: la verificacion real se controla por separado en HidroTrack. Mantener SMTP, contraseñas, URLs y otras opciones existentes.
5. Consultar configuracion publica e integridad de controles. Prueba manual con una cuenta ficticia consentida: alta, envio/recepcion del enlace y recuperacion de acceso. No usar cuentas reales de negocio para simular vencimientos.

## Reversion

Antes de activar y sin cuentas rastreadas, `supabase/tests/email_grace_rollback_before_activation.sql` restaura exactamente las definiciones originales guardadas y retira solo los controles nuevos. Se probo localmente. El script se niega a ejecutarse si la politica se activo o si hubo cuentas provisionales.

Despues de activar, no revertir a ciegas ni quitar la proteccion a cuentas pendientes: conservar seguimiento/verificacion y preparar un plan especifico, incluyendo restaurar la confirmacion previa para nuevas altas y revisar las cuentas afectadas. No borrar cuentas ni datos como solucion.

## Verificacion y limites

Suite completa **456/456** y compilacion aprobadas el 26/10/2026.

Pruebas SQL cubren plazo, bloqueo directo/RPC, recuperacion por OTP frente a clave/metadatos, correo diferente, misma empresa/licencia, no renovacion al cambiar email, cobertura de todos los RPC/tablas y reversion exacta antes de activar. Interfaz cubre estado provisional/vencido/verificado, reenvio al correo del servidor y fallo cerrado al no poder consultar.

Sin cuentas nuevas ni correos reales durante pruebas. Recepcion de correo y flujo nativo entre dispositivos siguen pendientes de validacion manual. Antes de nuevas migraciones que creen tablas/RPC, agregar el mismo control; una prueba de contrato detecta omisiones.

Fuentes oficiales consultadas: [sesiones por enlace/OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [claims JWT y metodos de autenticacion](https://supabase.com/docs/guides/auth/jwt-fields).
