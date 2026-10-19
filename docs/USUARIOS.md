# Perfiles y alta del primer jefe

Migración aplicada por MCP: `20261019163826_user_profiles`. Hay 16 tablas públicas con RLS. Supabase Auth conserva correo, contraseña y sesión; no existe una tabla pública de contraseñas.

`user_profiles` contiene user_id, full_name y fechas. Se crea automáticamente al dar de alta una cuenta de Auth, copiando únicamente el nombre de presentación. También se prepararon perfiles para las cuentas de Auth ya existentes. Un usuario puede leer/editar su nombre y un jefe con licencia vigente puede consultar nombres de miembros activos de su empresa. Nadie se convierte en jefe por editar su perfil o sus metadatos: roles/membresías y administradores siguen en tablas protegidas.

La pantalla conectada muestra el nombre del jefe; el selector de repartidor usa los nombres disponibles. El alta de perfiles no crea empresas ni usuarios nuevos por sí sola.

## Estado del alta pedida

Se comprobó que la cuenta solicitada no existe y que no hay empresas provisionadas. Los datos personales y la contraseña suministrados en la sesión no se guardaron en Git. El usuario de jefe, su empresa y su licencia siguen pendientes: no afirmar que ya puede iniciar sesión.

Existe un backend admin-users que requiere sesión de superadministrador. No se dispone de esa sesión en esta conversación y no se cambiaron sus restricciones. La revisión automática rechazó desplegar un mecanismo temporal alternativo con privilegios de servicio, incluso una variante con JWT habilitado, porque requiere autorización explícita adicional. No se desplegó ninguna de esas variantes ni se modificó Auth para eludirlas.

Se preparó un alta puntual revisable: función temporal con JWT habilitado, token aleatorio adicional, vencimiento a los diez minutos y restricción al único correo solicitado; usa Auth Admin para crear/confirmar el usuario, asigna owner con una empresa inicial vacía y licencia activa sin asistentes, y se deshabilita al terminar. Antes de ejecutarla hace falta autorización explícita del usuario. No imprime ni devuelve contraseñas, tokens de sesión o claves de servicio. Si falla la asignación después de crear Auth, intenta retirar la cuenta nueva y revisar el resultado antes de reintentar.

La clave pedida no se añadió al código, a las migraciones ni a documentación. Las cuentas se crean mediante Auth Admin; no insertando manualmente contraseñas en auth.users.

Verificación: 70 pruebas, incluidas creación de perfiles, aislamiento, permisos de columnas y ausencia de autoasignación de rol. Compilación correcta. Todavía falta crear el jefe y probar inicio de sesión y acceso real al stock.
