# Estado de HidroTrack real — 22/10/2026

Referencia para continuar desde otra PC. Codigo conectado no equivale a despliegue publico comprobado ni prueba completa con datos reales. No contiene credenciales.

Plan de trabajo detallado: [Orden recomendado de implementacion](ORDEN_IMPLEMENTACION.md).

## Comprobado

Supabase MCP: 21 migraciones instaladas, 34 tablas publicas con RLS. RLS habilitado no prueba por si solo que cada permiso cumpla la ultima regla comercial. Base actual sin recorridos reales; no se generaron operaciones para esta revision.

| Modulo | Base de datos | Pantalla real |
| --- | --- | --- |
| Ingreso, perfiles y roles | Auth/perfiles/membresias instalados | Login conectado; administrador y jefe conectados |
| Perfil personal del asistente | Reutiliza perfil propio y Auth existentes | Nombre, ID copiable y cambio de clave conectados en este avance; validacion con mocks, sin cambiar claves reales |
| Clientes y ubicacion | Instalada | Alta/edicion/planilla y punto de mapa conectados; dias/habitos y pedidos extraordinarios pendientes |
| Catalogo, stock y dispenser | Instalada, con libro auditado | Alta con stock, movimientos, asignaciones y devoluciones conectados; cambio atomico de equipos/reparacion completo pendiente |
| Promociones | Instalada, incluye permiso y aviso al jefe | Jefe conectado; oferta del asistente pendiente de su circuito real |
| Repartos y mapa operativo | Contratos basicos instalados | Preparacion/carga del jefe parcial; pantalla completa del chofer pendiente |
| Entregas, cobros y deuda | Operaciones y reglas instaladas | Flujo operativo y aprobaciones del jefe pendientes de conectar |
| Alquileres y futura baja | Contratos instalados | Facturacion/cobro operativo, recuperacion y aprobacion completas pendientes |
| Rendicion y PDF | Cierre/conciliacion instalados | Circuito real y PDF autenticado pendientes |

## Que falta de usuarios y permisos — prioridad inmediata

1. Registro propio verificado de asistente, sin crear empresa/licencia ni conceder rol administrativo.
2. Jefe agrega por ID a lista persistente; agregar/quitar y cupo atomicos, auditados y separados por empresa. Una identidad puede trabajar con varios jefes; nunca recrearla al cambiar de equipo.
3. Invitacion de reparto con remitente y nombre, Aceptar/Rechazar por su destinatario. Solo aceptar habilita datos. No responder/rechazar mantiene perfil basico. Revocar/cerrar quita acceso. Contrato de invitaciones aun no instalado.
4. Revisar RLS/RPC de inventario, cartera, cobros, ubicacion y promociones para exigir aceptacion vigente, no solo asignacion. El helper actual inventory_trip_access aun no exige aceptacion: no habilitar rutas reales hasta corregir todos los caminos.
5. Foto con almacenamiento privado y permisos; recuperacion de cuenta y autenticador real. Cambio de clave personal ya tiene formulario Auth, con confirmacion y manejo de reautenticacion, pero no se probaron claves reales para no alterarlas.
6. Planes basico/intermedio/superior e ilimitados: demo definida; servidor actual cuenta limite entero. Falta migracion de representacion, alta/cambio de plan y gestion comercial. No cambiar licencias existentes arbitrariamente.

El ID mostrado en cuenta real usa HT seguido de la identidad UUID estable. No es credencial ni concede acceso. La busqueda/vinculacion por ID del jefe aun no esta habilitada.

## Que falta de base de datos adicional

- Contratos anteriores de vinculos e invitaciones con auditoria e idempotencia y revision completa de permisos.
- Preferencias/cantidades habituales y dias tienen tablas base, pero falta guardar/editar desde la web con contrato validado. Extender para pedidos de visita extraordinaria, asignacion por fecha y cambios atomicos de dispenser.
- Snapshot de carga recomendada y extras, costo historico SOLO de unidades rellenadas al cargar, y consultas de resultado mensual sin inventar ganancia cuando faltan costos.
- Reparacion/baja de unidades danadas pendientes y contrato completo de sustitucion de equipos, sin devolver uno y asignar otro como dos operaciones independientes del navegador.
- PDF real desde cierre historico con permisos y versionado; avisos en vivo y seguimiento autorizado entre dispositivos.

Varias tablas/funciones base ya existen; estos puntos son extensiones e integracion, no una reconstruccion total. SQL bajo supabase/migrations y verificadores bajo supabase/tests son la referencia.

## Orden para llegar a beta operativa

1. Vínculo jefe-asistente e invitacion aceptada, protegidos en servidor.
2. Abrir recorrido real, carga unica, clientes/mapa, entrega/devolucion y cobro.
3. Aprobaciones, ausencia/pendientes, futura baja y cambios de dispenser.
4. Rendicion conciliada, aprobacion del jefe y PDF para ambos segun acceso vigente.
5. Costos, graficos y resto de opciones.
6. Prueba completa con las cuentas aisladas: dos asistentes, dos empresas, rechazo/revocacion, concurrencia, mala conexion y movil/PC. Revision de seguridad, backup/recuperacion y verificacion de despliegue antes de llamarlo beta operativa.

Optimizacion de orden de ruta/tiempo/distancia pospuesta por el usuario. Abrir otra app ya existe en demo y para un destino de planilla real; no equivale a recorrido optimizado ni a mapa operativo real del chofer.

No se aplicaron migraciones nuevas ni se alteraron cantidades, contrasenas o vinculos reales durante este avance.
