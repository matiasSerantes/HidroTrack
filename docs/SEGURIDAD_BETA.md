# Primera capa de seguridad — 28/10/2026

El alcance es reducir riesgos concretos sin cerrar sesiones ni cambiar datos comerciales. No es una certificación ni una auditoría exhaustiva.

## Aplicado

- Todas las tablas públicas consultadas tienen RLS. `anon` no tiene privilegios de tablas ni de ejecución de funciones en `public`. Los roles y la empresa se validan en servidor, no mediante el selector de demo.
- Se revocó únicamente `DELETE` directo para clientes y productos a `authenticated`. La interfaz sigue usando las funciones protegidas de eliminación/archivo; altas y ediciones mantienen sus políticas. La papelera del superadministrador y su purga interna conservan su funcionamiento.
- `public/_headers` aplica CSP: scripts únicamente del sitio, sin `eval` ni scripts inline; marcos y objetos bloqueados; conexiones limitadas al proyecto Supabase, Photon y OSRM; GPS propio y service worker permitidos. Se mantiene CSS inline porque React/Leaflet lo necesitan. Imágenes HTTPS, data y blob siguen permitidas para mapas, fotos y logos; no es una política de imágenes limitada a un único proveedor.
- Protección contra incrustación en páginas ajenas (`frame-ancestors`/`X-Frame-Options`), interpretación incorrecta de MIME (`nosniff`), preferencia HTTPS y permisos de cámara/micrófono/pagos/USB desactivados. GPS continúa solicitando permiso normal. No se activa COEP porque podría impedir imágenes externas del mapa.
- `Referrer-Policy: strict-origin` evita enviar rutas y parámetros a otros sitios, conservando el origen necesario para las solicitudes de mapas. No cambia los destinos elegidos explícitamente al abrir Waze/Google Maps.
- HTML de inicio sin caché persistente y service worker revalidable. Assets con nombre versionado mantienen caché para rendimiento. El service worker continúa sin cachear datos privados.
- La compilación valida la pareja URL/clave pública de Supabase. Rechaza claves `secret` o JWT con rol administrativo y configuración parcial, sin imprimir el valor. Permite `publishable` o JWT de rol `anon`, y la demo sin configuración. La clave pública puede aparecer en el navegador: la protección real sigue siendo RLS y los controles del servidor.
- El script del plan público se movió a `plan.js` para respetar CSP sin permitir scripts inline. La apariencia de móvil/escritorio no se modificó.

## Validación y límites

Se prueban la clasificación de claves sin revelar valores, restricciones CSP compatibles con integraciones existentes, rechazo de borrado físico y conservación del camino de papelera. La suite SQL usa datos ficticios y verifica aislamiento por empresa y permisos. `npm audit` de producción y completo informó cero vulnerabilidades publicadas en las versiones instaladas al revisar; eso no prueba ausencia de vulnerabilidades desconocidas.

La URL pública y sus cabeceras se comprueban después del despliegue. La navegación autenticada en teléfonos/PC y la recepción física de push requieren validación manual; no presentarlas como comprobadas por una prueba de cabeceras.

## Pendiente de una siguiente capa

- Doble factor real, empezando por superadministración. No se ha habilitado ni exigido MFA en esta entrega.
- CAPTCHA y protección adicional contra abuso en registro/recuperación. Los límites del servidor Auth no se modificaron; un temporizador del navegador no reemplaza rate limiting del servidor.
- Protección contra contraseñas filtradas: el asesor informa que está deshabilitada. Requiere revisar el plan/configuración Auth; no se cambió ni se presentó como activa. No se leyó SMTP ni se cambiaron contraseñas existentes.
- Revisar periódicamente las funciones `SECURITY DEFINER`. Son APIs intencionales con guardias; no revocar todas automáticamente porque rompería la operación. El aviso de `pg_net` en `public` se conserva pendiente de una migración específica y probada, sin afectar recordatorios.
- Completar respaldo real y ensayo de restauración; la réplica en una VM quedó expresamente pospuesta por el usuario.

## Mantenimiento

Si se cambia el proyecto Supabase o un servicio externo, actualizar la lista CSP junto con la integración. No resolver una incompatibilidad permitiendo scripts de cualquier origen ni habilitando `unsafe-eval`. Ante un problema, revisar la directiva concreta. Las cabeceras de `_headers` cubren archivos estáticos; una futura respuesta generada por código Worker deberá añadir sus propias cabeceras.

Fuentes de implementación: [Cloudflare: cabeceras de archivos estáticos](https://developers.cloudflare.com/workers/static-assets/headers/), [Supabase: seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security).
