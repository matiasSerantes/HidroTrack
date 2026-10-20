# Perfiles y alta del primer jefe

## Panel del administrador de plataforma (20/10/2026)

El acceso real usa Ingresar a mi cuenta y verifica `is_platform_admin` antes de mostrar el panel. Una cuenta de jefe no obtiene permisos de administrador por visitar una URL. La asignación/verificación de tu cuenta administradora y la prueba con Supabase quedan pendientes de conexión; no se cambiaron roles remotos durante este avance.

El panel incluye Resumen, Usuarios y Empresas y licencias. El directorio lista las membresías devueltas por `admin_directory`: correo, empresa, rol y acceso según membresía y licencia. Permite buscar por correo/empresa y filtrar titulares/choferes y accesos habilitados/inactivos/bloqueados. No es una lista de visitantes ni de personas conectadas en vivo; una cuenta con varias empresas puede aparecer varias veces. No incluye cuentas Auth sin empresa.

Nueva sodería crea un titular y su empresa; Nuevo chofer lo vincula con una empresa. Se reutiliza la función segura `admin-users` y sus verificaciones. Editar licencia permite tipo, vencimiento, estado y límite de choferes. Suspender una licencia afecta a toda esa empresa. No se implementaron borrado de cuentas, cambio de contraseñas ni activación/desactivación individual de membresías.

Vista previa: `/?demo=admin`, con datos ficticios y persistencia local. Tiene el mismo panel sin llamadas al servidor. El acceso público a esta vista no permite administrar cuentas reales. En celular se presentan filas como tarjetas; en PC hay barra lateral y tablas. Pruebas locales y build correctos; revisión visual en navegador y verificación con cuenta administradora real pendientes.

Migración aplicada por MCP: `20261019163826_user_profiles`. Hay 16 tablas públicas con RLS. Supabase Auth conserva correo, contraseña y sesión; no existe una tabla pública de contraseñas.

`user_profiles` contiene user_id, full_name y fechas. Se crea automáticamente al dar de alta una cuenta de Auth, copiando únicamente el nombre de presentación. También se prepararon perfiles para las cuentas de Auth ya existentes. Un usuario puede leer/editar su nombre y un jefe con licencia vigente puede consultar nombres de miembros activos de su empresa. Nadie se convierte en jefe por editar su perfil o sus metadatos: roles/membresías y administradores siguen en tablas protegidas.

La pantalla conectada muestra el nombre del jefe; el selector de repartidor usa los nombres disponibles. El alta de perfiles no crea empresas ni usuarios nuevos por sí sola.

## Primer jefe habilitado

El usuario autorizó expresamente el mecanismo de alta temporal. Se creó la cuenta solicitada mediante Auth Admin, con correo confirmado, perfil de nombre, membresía owner activa, empresa inicial Reparto principal y licencia permanente activa sin asistentes habilitados (driver_limit=0). No se asignó rol de superadministrador.

Verificación real: inicio de sesión por contraseña, nombre de perfil correcto, membresía/licencia y consultas REST autenticadas de productos, inventario y dispenser. Se cerró solo la sesión usada para esa comprobación. El inventario queda vacío para que el titular cargue sus cantidades reales.

La función temporal usó JWT más un token aleatorio, restricción al único correo solicitado y vencimiento. Después del alta se reemplazó por una respuesta HTTP 410 sin código administrativo; se verificó que ya no permita altas. No se modificó el backend admin-users existente. Contraseña, correo, nombre e identificadores del titular no se guardan en el repositorio.

Entrar por Ingresar a mi cuenta, con las credenciales suministradas por el usuario, y abrir Stock y dispenser. El autenticador 123456 de la demostración no es este acceso. Reparto principal es un nombre inicial, pendiente de reemplazar por la marca comercial que indique el titular.

Verificación local: 70 pruebas y compilación correctas. Falta revisión visual en teléfono/PC y completar las pantallas de ventas/cobros del chofer. No se cargaron productos, clientes ni operaciones de ejemplo en la empresa real.
