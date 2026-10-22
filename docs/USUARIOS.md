# Perfiles y alta del primer jefe

## Panel del administrador de plataforma (20/10/2026)

Ver historial de accesos muestra los últimos 100 cambios de choferes, con empresa, correo del chofer, acción, fecha/hora argentina y correo del administrador. Son cambios administrativos, no un registro de inicios de sesión. En vista previa se conservan únicamente los eventos de esta sesión; restablecer demo también limpia esos eventos. La lectura real usa `admin_access_history`, restringida en servidor a administradores. Aplicar `20261020131010_admin_access_history.sql` después de `20261020131006_admin_member_access.sql`; ambas siguen pendientes de aplicación remota. Los correos se consultan en su estado actual. La pantalla distingue error/actualización pendiente de un historial vacío y permite reintentar.

El acceso real usa Ingresar a mi cuenta y verifica `is_platform_admin` antes de mostrar el panel. Una cuenta de jefe no obtiene permisos de administrador por visitar una URL. La asignación/verificación de tu cuenta administradora y la prueba con Supabase quedan pendientes de conexión; no se cambiaron roles remotos durante este avance.

El panel incluye Resumen, Usuarios y Empresas y licencias. El directorio lista las membresías devueltas por `admin_directory`: correo, empresa, rol y acceso según membresía y licencia. Permite buscar por correo/empresa y filtrar titulares/choferes y accesos habilitados/inactivos/bloqueados. No es una lista de visitantes ni de personas conectadas en vivo; una cuenta con varias empresas puede aparecer varias veces. No incluye cuentas Auth sin empresa.

Nueva sodería crea un titular y su empresa; Nuevo chofer lo vincula con una empresa. Se reutiliza la función segura `admin-users` y sus verificaciones. Editar licencia permite tipo, vencimiento, estado y límite de choferes. Suspender una licencia afecta a toda esa empresa. No se implementaron borrado de cuentas ni cambio de contraseñas.

En Usuarios, cada chofer tiene Pausar acceso/Reactivar acceso con confirmación. Cambia solo su membresía en la empresa elegida, conservando cuenta e historial; no cancela repartos ni rendiciones. El titular queda protegido. Reactivar requiere licencia vigente y cupo. La demo guarda el cambio localmente. El servidor real requiere aplicar `20261020131006_admin_member_access.sql` después de foundation/admin_portal: RPC restringida a administradores, bloqueo transaccional del cupo y registro de auditoría `admin_member_events` con RLS. La migración está preparada y probada localmente, sin aplicación remota confirmada. La web avisa si falta la actualización y no presenta la pausa como realizada.

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

## Base principal instalada el 20/10/2026

17 migraciones y 29 tablas con RLS verificadas por MCP. Inventario/roturas/asignaciones y administración actualizados; ventas, cobros, deuda, alquiler mensual, recorridos, futura baja y rendición preparados en servidor. 177 pruebas de dominio, PostgreSQL e interfaz, build y verificadores remotos correctos. Sin datos comerciales ficticios en remoto. Detalle y límites: [BASE_DE_DATOS.md](BASE_DE_DATOS.md). Concurrencia multiconexión, prueba Auth/PostgREST de nuevos flujos y revisión visual móvil/PC pendientes.

## 21/10 - Cuentas aisladas de prueba

Creadas por pedido explicito tres cuentas reales de Auth con correos ficticios: un jefe y dos asistentes, todos vinculados a empresa de pruebas nueva. Cupo dos, promociones deshabilitadas, sin privilegios de plataforma ni datos comerciales. Login y consultas REST de roles/aislamiento comprobados; no se guardan correos ni contrasenas en el repositorio. Los correos ficticios no sirven para recibir recuperacion por email. El acceso del chofer a recorridos reales aun esta pendiente; estas cuentas permiten preparar/verificar ese desarrollo sin mezclar datos del titular real.

## 21/10 - Identidad personal y acceso por asignacion

Regla confirmada: asistente independiente de cualquier jefe; ID propio para vincularlo una vez a la lista y reutilizarlo al asignar nuevas jornadas. Sin asignacion no hay acceso a clientes, recorridos, stock, dinero ni comprobantes anteriores, solo perfil basico/ID y nombres de jefes opcionales. Desvincular no borra su cuenta. Demo actualizada con nombre, foto local y clave solo simulada; interfaz real de perfil, ID publico y vinculacion autenticada pendientes. No se cambiaron las contrasenas ni se quitaron los vinculos reales de las cuentas de prueba por este ajuste.
## 21/10 - Perfil real del asistente conectado

Cuenta sin membresia de jefe activa entra ahora en pantalla personal propia, sin menu del titular ni consultas comerciales. Verifica identidad mediante Auth getUser y carga solo user_profiles propio. Permite editar nombre por UPDATE con filtro user_id y politicas existentes. ID estable copiable: HT seguido del UUID de la propia identidad, sin otorgar permisos ni ser una contrasena; la vinculacion real por ID todavia no esta activada.

Cambio de clave real solo por formulario del usuario: confirmacion doble, 12 a 128 caracteres, Auth updateUser; no tablas de claves ni persistencia en localStorage. Si Auth exige reautenticacion, se informa sin evadirla; respuestas inciertas no se presentan como exito y los campos se limpian. No se cambiaron contrasenas existentes para probar. Foto privada, vinculacion, invitaciones y recorrido real siguen pendientes.

IMPORTANTE: lectura de servidor actual aun habilita repartos por asignacion sin aceptacion; no mostrar esos recorridos hasta preparar migracion de RLS/RPC que verifique aceptacion y cierre/revocacion en todos los caminos. La pantalla personal no sustituye esa proteccion. En remoto no hay recorridos al revisar este avance; no se crean para validar UI.
# Avance 22/10/2026: etapa 1

Registro y recuperacion Auth, lista de asistentes del jefe por ID y nombres de jefes del asistente conectados. Migracion de vinculos/cupos aplicada, sin modificar limites existentes. Etapa incompleta: SMTP, permiso de espera de servidor y validacion publica pendientes. Ver [detalle vigente](ETAPA_1_USUARIOS.md), que actualiza los pendientes historicos de este archivo. No confundir pantalla basica con aislamiento de contratos antiguos por asignacion.

Actualizacion 22/10: bloqueo temporal autorizado explicitamente e instalado como 20261022130128_assistant_waiting_access.sql; 23 migraciones, 35 tablas con RLS. Referencias anteriores al SQL pendiente son historicas. SMTP a cargo del usuario, aun sin validar.
