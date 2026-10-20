# HidroTrack

Repositorio: https://github.com/matiasSerantes/HidroTrack.git

## Demo completa para revisar el programa

Con `npm run dev`, abrir `http://127.0.0.1:5173/?demo=1`, elegir jefe o asistente y usar el código ficticio **123456**. También se puede entrar desde «Explorar demostración». Ver [guía y recorrido de prueba](docs/DEMO.md).

La nueva demo integra artículos/venta/alquiler, clientes y cuadra, recorridos asignables, atención y cobros, envases/stock, solicitudes/bajas, rendiciones, equipo, reportes y nombre/logo de empresa. Todos los datos se guardan en este navegador; el autenticador, mapa y seguimiento son simulaciones. No modifica Supabase. El acceso conectado anterior se conserva fuera de la demo.

Esta sección describe la demo integral agregada el 19/10/2026. Las secciones de alcance e integración siguientes describen la base previa y el trabajo de producción todavía pendiente.

## Plan de acción

Abrir `public/plan.html` directamente en el navegador o visitar `/plan.html` al ejecutar Vite. Incluye estado verificado, próximas entregas, seis etapas, criterios de aceptación, dependencias y decisiones pendientes. Los estados son un registro manual del desarrollo, no una consulta en vivo a Supabase.

## Cloudflare Pages

Conectar el repositorio con al menos un commit en `main`. Configuración: rama de producción `main`, directorio raíz del repositorio, comando de compilación `npm run build`, salida `dist`, Node.js 24 (`.node-version`). Sin Supabase configurado funciona el modo demo. Para habilitar el acceso real, configurar las variables públicas de `.env.example` en Cloudflare y volver a desplegar.

Base inicial para gestionar repartos independientes. React, TypeScript y Vite. Referencia visual conservada en `control_soderia_prototipo.html`; requisitos originales en `CODEX_CONTROL_SODERIA.md`.

## Ejecutar

### Trabajo local recuperado (19/10/2026)

La demo integral actual continúa en `/?demo=1`. La demo anterior, con mapas, recorridos diarios y equipos de clientes guardados en el navegador, se conserva en `/?demo=legacy`; sus datos son independientes de la demo integral. Las secciones siguientes sobre esa demo describen este acceso anterior. El inicio de sesión real recupera la detección de superadministrador y conserva el panel actual del titular. No se ejecutaron migraciones ni despliegues durante esta integración.

### Panel del cliente: ventas, bidones y equipos

En **Clientes → Ver ficha** el panel tiene cuatro secciones: Resumen, Historial de ventas, Envases y equipos, y Dirección y mapa. El resumen muestra deuda calculada, cantidad de ventas, bidones físicos y bases que tiene el cliente. Los elementos aún no cargados se muestran como “Sin cargar”. María tiene ejemplos de tres bidones y dos bases; Ana tiene cuatro bidones, una base y un dispenser. Son cantidades ficticias.

En Envases y equipos se registra cada elemento con descripción (por ejemplo, Bidón retornable 20 L), tipo, propietario (del reparto en préstamo o del cliente) y cantidad inicial. Después se agregan movimientos de entrega o retiro con fecha y observación. La cantidad actual es inicial más entregados menos retirados. Se impiden cantidades fraccionarias, negativas y retiros superiores a lo registrado. Editar o archivar al cliente conserva sus equipos y movimientos. Todo queda en el navegador, sin sincronización con Supabase.

Los bidones se cuentan como envases físicos sin distinguir llenos de vacíos. Los movimientos de equipos no generan ventas ni deuda. Las ventas actuales de la demo siguen siendo de sifones de soda y no modifican automáticamente el inventario de bidones, bases o dispensers. La integración de productos de agua, canjes y equipos con la venta queda pendiente.

### Recorrido del día y camino por calles

En **Recorridos** se elige una fecha (hoy por defecto, hora argentina) y se cargan los clientes activos cuyos días habituales coinciden. Las entregas y pendientes se calculan por jornada, y se puede volver a entregar al mismo cliente otro día. Las entregas antiguas sin fecha se consideran de hoy por compatibilidad con la demo anterior. El historial del cliente conserva todas las jornadas; el panel y cierre muestran solo los movimientos de hoy.

**Empezar desde mi ubicación** solicita una posición al dispositivo; **Marcar camino por calles** consulta OSRM y dibuja la geometría devuelta, con distancia y tiempo estimados de manejo. Sin posición inicial, comienza en el primer cliente con coordenadas. Cambiar fecha, orden, clientes, filtro de pendientes o inicio invalida el camino para que pueda recalcularse. No se optimiza automáticamente el orden y no se simula una recta como si fuera un camino por calles. La consulta externa solo transmite coordenadas; depende de conexión y del servidor público de demostración, con un límite local de 80 puntos. Ante fallos se conserva la lista y se informa el error.

Un cliente siempre conserva su identidad aunque comparta dirección, cuadra o coordenadas con otros. Para coordenadas coincidentes, el mapa muestra un marcador con la cantidad y un selector de clientes; cada uno mantiene su pedido y estado de entrega. Se incluyeron ejemplos de varios clientes en Rivadavia los miércoles y sábados. Los puntos aún no guardados quedan visibles en la lista y fuera del camino.

Referencia de la consulta de rutas: [documentación HTTP de OSRM](https://project-osrm.org/docs/v26.5.0/http). El tiempo estimado no incluye la atención al cliente ni tráfico en vivo. La ubicación inicial es una lectura a pedido, no seguimiento continuo.

### Prioridad actual: dueño y repartidor, sin ayudantes

La demo abre **Mi reparto · Dueño y repartidor** por defecto. La navegación principal se centra en clientes, recorrido/mapa, entregas y cierre. Se retiraron de ese flujo las asignaciones a empleados y la sección Personal. La administración del sistema sigue disponible como vista secundaria.

El recorrido incluye un mapa interactivo con Leaflet y cartografía OpenStreetMap, marcadores numerados, filtros por día habitual y pendientes, selección de clientes y enlaces de navegación. Las coordenadas iniciales son ficticias en Buenos Aires y no fueron geocodificadas desde las direcciones de ejemplo. Las fichas permiten guardar localidad, barrio, coordenadas, un punto tocando el mapa o la ubicación actual del dispositivo a pedido del usuario. Se conserva la posibilidad de dejar la ubicación pendiente. No hay cálculo de ruta por calles, optimización ni conversión automática de direcciones a coordenadas. La cartografía necesita conexión; las fichas y coordenadas quedan en el navegador. Los datos demo no se sincronizan con Supabase. Las nuevas entregas incluyen fecha/hora e historial de envases recuperados.

Referencias del mapa: [Leaflet](https://leafletjs.com/examples/quick-start/) y [política de cartografía OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/). Se muestran atribuciones en el mapa y se cargan los mapas visibles sin descargas anticipadas para uso offline.

Para recorrer la vista previa completa, abrí `http://127.0.0.1:5173/?demo` (o agregá `?demo` a la URL que informe Vite). Incluye ingreso simulado para superadministrador, titular y chofer, y recuperación de contraseña simulada. Los campos de ejemplo vienen completos; contraseña: `HidroDemo123!`. También se accede desde **Explorar demostración** en el inicio. Los perfiles titular y chofer comparten por ahora el recorrido de demostración comercial; no representan permisos reales de chofer.

El panel demo de superadmin incluye tres soderías ficticias, altas de soderías/titulares y choferes, búsqueda y edición de licencias. Guarda los datos solo en este navegador y permite restablecerlos. No guarda contraseñas, no crea cuentas reales y no llama a Supabase. Los usuarios nuevos son ejemplos del directorio; no se pueden usar para iniciar sesión. La recuperación no envía correos.

Con Node.js 24 LTS o superior:

```powershell
npm ci
npm run dev
```

Abrir la dirección que informa Vite. `npm test` ejecuta las pruebas y `npm run build` verifica TypeScript y genera `dist/` para Cloudflare Pages.

En esta computadora también se puede ejecutar `powershell -ExecutionPolicy Bypass -File .\iniciar.ps1`: usa Node portable de `.tools/`, sin instalación global. Las dependencias quedaron fijadas y el lockfile está incluido.

## Alcance actual

### Gestión de clientes en la demo

En **Titular → Clientes** se puede crear y editar una ficha con nombre, dirección, teléfono, días de visita, cantidad habitual, observaciones y asignación al titular o al chofer demo. La lista busca por nombre/dirección/teléfono y filtra por día y estado. La ficha muestra entregas, saldo pendiente calculado y envases netos de las operaciones demo; no incluye saldos ni envases anteriores al uso de la demo.

Archivar conserva la ficha y las entregas, y retira al cliente del recorrido. Reactivar lo agrega al final. En el perfil chofer, la lista y el recorrido solo muestran clientes asignados al chofer demo; no se permite crear, editar o archivar clientes. Esta asignación es una simulación de interfaz y todavía no se guarda en Supabase ni representa seguridad de servidor. Las fichas pertenecen a una única sodería ficticia compartida por ambos perfiles demo. Los días son habituales; todavía no generan recorridos automáticamente por fecha.

- Acceso de demostración explícito, independiente de Supabase.
- Clientes, días habituales, búsqueda, orden manual de visitas y apertura de búsqueda externa de direcciones.
- Entregas demo con precio fijo, envases recuperados, pagos parciales, efectivo, transferencia y saldo pendiente. Importes en centavos enteros; no se pueden reabrir entregas.
- Persistencia local únicamente para datos ficticios. No representa sincronización offline de producción.
- Resumen calculado de jornada; no simula envío ni aprobación de un cierre real.
- Acceso con contraseña de Supabase y recuperación de sesión. Panel conectado del titular con consulta de membresía/licencia, listado, búsqueda, alta y archivo de clientes; archivo lógico mediante `active=false`. Choferes y cuentas sin titular asignado reciben un estado explícito. Suspensión o vencimiento impiden cargar clientes desde la interfaz; RLS sigue siendo la autoridad en el servidor.
- Esta integración está probada con un cliente Supabase simulado, pero falta validarla contra Auth/PostgREST y la base remota. El panel requiere migración aplicada, usuario, membresía owner y licencia válidos, además de URL y clave pública en el entorno.
- Migración inicial con titulares, membresías, licencias, auditoría automática de cambios de licencia, clientes, productos, programación y preferencias. Roles derivados de tablas protegidas, RLS y claves compuestas entre tablas comerciales.

## Supabase

Estado vigente al 20/10/2026: [base instalada y contratos de integración](docs/BASE_DE_DATOS.md). Son 19 migraciones y 31 tablas con RLS; los nombres locales coinciden con el historial remoto. Las referencias históricas siguientes a cinco migraciones o funciones pendientes describen etapas anteriores. No repetir el reinicio ni las migraciones aplicadas. La base de recorridos/ventas/caja está instalada; su conexión completa a la web sigue pendiente.

Copiar `.env.example` a `.env` y completar la URL y clave pública de un proyecto propio. Nunca usar `service_role` en Vite. Las migraciones de `supabase/migrations` coinciden con el historial remoto: foundation, admin_portal, inventory, owned_inventory y user_profiles. En un proyecto nuevo se aplican en orden; no volver a ejecutar foundation sobre HidroTrack. La base de stock se aplicó mediante MCP el 19/10/2026. Ver [modelo y funciones de stock](docs/STOCK.md). El acceso real del jefe incluye Stock y surtidores; requiere membresía owner y licencia. La demostración mantiene datos locales.

Crear usuarios con Supabase Auth. El alta inicial de tenant, membresía owner, licencia y superadministrador se realiza desde un servidor o consola confiable, en una transacción. No hay autoasignación de roles. Elegir explícitamente el límite de choferes; no tiene valor por defecto. Los administradores pueden leer metadatos de titulares y administrar licencias, pero no acceden automáticamente a información comercial. Una licencia suspendida o vencida bloquea acceso comercial sin gracia implícita. La política definitiva de gracia sigue pendiente.

## Próximo trabajo

Validar el panel conectado contra el proyecto Supabase, completar administración segura de altas y límites de choferes, sumar productos, rutas/asignaciones y MapLibre. La base transaccional de stock ya está aplicada. Catálogo, ingreso, recarga, carga y regreso ya tienen pantalla real del jefe. Provisionar una cuenta y validar el flujo con Auth/PostgREST; después conectar ventas del chofer. Completar ventas/pagos, diferencias de rendición e IndexedDB. Ninguna operación comercial de producción debe basarse en la lógica de la demo.

### Panel de superadministración (17/10/2026)

El acceso conectado detecta el rol de superadministrador y muestra un panel con listado y búsqueda de soderías, usuarios asociados, alta de sodería con titular, alta de choferes y edición de licencias (tipo, estado, vencimiento y límite). La base aplica el límite de choferes y registra al administrador en la auditoría de licencias. El resto de las cuentas conserva el panel del titular o el estado de chofer pendiente de implementación.

Las migraciones `foundation` y `admin_portal` están aplicadas al proyecto Supabase conectado. La Edge Function `admin-users` está desplegada: valida el token con Auth y verifica `platform_admins` antes de crear usuarios. La clave de servidor se utiliza exclusivamente dentro de Supabase. La función comprueba la autorización por sí misma (`verify_jwt=false` en el gateway, para admitir las claves de firma actuales). Las RPC de directorio verifican el administrador; la RPC de asignación está reservada a `service_role`. Si falla la asignación, se intenta eliminar el usuario recién creado y se informa si la recuperación quedó incompleta.

Las altas usan una contraseña inicial de al menos 12 caracteres y confirman el correo administrativamente; no envían invitaciones. La interfaz muestra ese procedimiento al administrador. No hay aún recuperación de contraseña ni cambios de membresías desde este panel. La nueva interfaz requiere desplegar nuevamente el frontend en Cloudflare con ambas variables públicas configuradas.

Validación: 26 pruebas locales (dominio, interfaz, migraciones/permisos y función de altas), TypeScript y build de producción. En remoto se verificó que las altas sin sesión o con token inválido devuelven 401. El flujo completo de alta con una sesión de navegador del superadmin queda pendiente de prueba manual; no se crearon cuentas ficticias en la base remota. El asesor de Supabase informa que la protección de contraseñas filtradas está desactivada: [configuración de protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Las advertencias sobre funciones `SECURITY DEFINER` corresponden a las dos RPC públicas con verificación interna de acceso; la tabla de administradores permanece cerrada al cliente intencionalmente.



`npm test` ejecuta las pruebas de dominio y también la migración y los escenarios SQL en PostgreSQL embebido (PGlite). El entorno de prueba crea un contrato mínimo de `auth.users`, `auth.uid()` y roles; no sustituye la integración con Supabase Auth/PostgREST. Las cinco migraciones pasan la validación local; la base de stock y sus permisos también se inspeccionaron en el proyecto remoto. El primer jefe ya está provisionado; se verificó el inicio de sesión y la lectura de su inventario vacío.

La prueba `supabase/tests/isolation.sql` prepara fixtures y los revierte. Para ejecutarla manualmente usar únicamente Supabase local descartable: `psql "$DATABASE_URL" -f supabase/tests/isolation.sql`. Verifica lectura/escritura entre titulares, autoasignación de membresías, chofer sin asignaciones, privacidad comercial frente al superadmin, suspensión, expiración, relaciones compuestas, acceso anónimo y auditoría de licencias. Los flujos administrativos futuros necesitarán sus propias pruebas.

## Notas y estado verificado

Los [requisitos funcionales](docs/REQUISITOS.md) reúnen los pedidos de artículos, alquileres, equipo, recorridos, cobros, stock y aprobaciones, con criterios de aceptación y decisiones pendientes.

Consultar [notas de trabajo](docs/NOTAS.md) y [revisión remota de Supabase del 19/10/2026](docs/REVISION_SUPABASE_2026-10-19.md). La inspección remota ya se realizó; las referencias anteriores a validación pendiente siguen aplicando a las pruebas completas de Auth/PostgREST y de la aplicación. Los acuerdos de continuidad están en AGENTS.md.

Para preparar la carga de Darío, ver [datos y plantillas de inventario inicial](docs/DATOS_INICIALES.md). No incluir datos reales de clientes, correos ni inventarios privados en commits.

La base de [perfiles de usuarios](docs/USUARIOS.md) está aplicada. El primer jefe ya fue provisionado y se verificó su inicio de sesión y lectura del inventario real. Las existencias siguen vacías para el conteo inicial; las credenciales y datos de la cuenta no están en Git.
