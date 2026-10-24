# Estado de HidroTrack real — 22/10/2026

Referencia para continuar desde otra PC. Codigo conectado no equivale a despliegue publico comprobado ni prueba completa con datos reales. No contiene credenciales.

Plan de trabajo detallado: [Orden recomendado de implementacion](ORDEN_IMPLEMENTACION.md).

## Comprobado

Supabase MCP, actualizado tras avance de etapa 3: 25 migraciones instaladas, 39 tablas publicas con RLS. RLS habilitado no prueba por si solo que cada permiso cumpla la ultima regla comercial. Sin solicitudes extraordinarias reales al comprobar. Ver [etapa 1](ETAPA_1_USUARIOS.md) y [etapa 2](ETAPA_2_INVITACIONES.md).

| Modulo | Base de datos | Pantalla real |
| --- | --- | --- |
| Ingreso, perfiles y roles | Auth/perfiles/membresias instalados | Login conectado; administrador y jefe conectados |
| Perfil personal del asistente | Reutiliza perfil propio y Auth existentes | Nombre, ID copiable y cambio de clave conectados en este avance; validacion con mocks, sin cambiar claves reales |
| Clientes y ubicacion | Instalada | Alta/edicion/planilla y punto de mapa conectados; dias/habitos conectados; pedidos extraordinarios conectados |
| Catalogo, stock y dispenser | Instalada, con libro auditado | Alta con stock, movimientos, asignaciones y devoluciones conectados; cambio atomico de equipos/reparacion completo pendiente |
| Promociones | Instalada, incluye permiso y aviso al jefe | Jefe conectado; oferta del asistente pendiente de su circuito real |
| Repartos y mapa operativo | Contratos basicos instalados | Preparacion/carga del jefe parcial; pantalla completa del chofer pendiente |
| Entregas, cobros y deuda | Operaciones y reglas instaladas | Flujo operativo y aprobaciones del jefe pendientes de conectar |
| Alquileres y futura baja | Contratos instalados | Facturacion/cobro operativo, recuperacion y aprobacion completas pendientes |
| Rendicion y PDF | Cierre/conciliacion instalados | Circuito real y PDF autenticado pendientes |

## Que falta de usuarios y permisos — prioridad inmediata

1. Registro propio y recuperacion conectados sin empresa/licencia/rol administrativo; falta SMTP y prueba real de entrega de correos.
2. Lista por ID, agregar/quitar y cupos atomicos instalados, separados por empresa. Identidad multiempresa preservada. Falta validacion publica completa.
3. Invitacion de reparto instalada: destinatario acepta/rechaza, jefe revoca, resumen de clientes solo al aceptar. Sin aceptar o al revocar/cerrar no hay resumen. Operaciones del chofer aun no habilitadas.
4. Revisar RLS/RPC de inventario, cartera, cobros, ubicacion y promociones para exigir aceptacion vigente, no solo asignacion. El helper actual inventory_trip_access aun no exige aceptacion: no habilitar rutas reales hasta corregir todos los caminos. Bloqueo temporal de rama driver aplicado tras autorizacion explicita: asistentes conservan acceso basico hasta completar etapa 2.
5. Foto con almacenamiento privado y permisos; recuperacion de cuenta y autenticador real. Cambio de clave personal ya tiene formulario Auth, con confirmacion y manejo de reautenticacion, pero no se probaron claves reales para no alterarlas.
6. Planes basico/intermedio/superior instalados con cupos 1/3/ilimitado y edicion administrativa. Licencias existentes conservadas como custom; altas administrativas conservan cupo personalizado hasta editar plan. Gestion comercial/cobro de licencias pendiente.

El ID mostrado en cuenta real usa HT seguido de la identidad UUID estable. No es credencial ni concede acceso por si mismo. Vinculacion por ID instalada; no confundirla con invitacion o aceptacion de reparto.

## Que falta de base de datos adicional

- Vinculos e invitaciones auditados/idempotentes instalados; resumen limitado autorizado. Falta revision/conexion de permisos para cada operacion del chofer en etapa 4.
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

En la revision inicial no se aplicaron migraciones. En el avance posterior se instalo assistant_links y se corrigieron destinos Auth. No se alteraron cantidades, contrasenas ni vinculos de usuarios para comprobarlo. Ver ETAPA_1_USUARIOS.md para el bloqueo temporal autorizado e instalado.

Actualizacion SMTP 22/10: el usuario configuro Gmail. Consulta de lectura confirma host/puerto, remitente/usuario esperados y URLs correctas. Configuracion verificada; autenticacion/envio, recepcion y recuperacion completa aun pendientes. Las menciones previas a SMTP sin configurar son historicas. Sin secretos en Git.

Evidencia posterior del usuario (22/10): correo de recuperacion recibido en Recibidos desde HidroTrack. Envio/recepcion confirmados; enlace, cambio de clave y nuevo ingreso pendientes. Plantilla actual en ingles.

Recuperacion 22/10: usuario confirma guardado de nueva clave y entrada manual posterior. Se mejora pantalla real con marca/celestes y entrada automatica solo al confirmar Auth. Prueba final del nuevo diseno publicado pendiente.

Etapa 3 parcial (22/10): planilla con dias y cantidades habituales conectadas a tablas existentes y fecha de alta visible. Sin cambio de stock ni nuevas migraciones. Carga recomendada, visitas extraordinarias y comprobacion real/manual pendientes.

Carga sugerida real (24/10): sumar preferencias de clientes activos del reparto sin futura baja; aplicar manualmente y ajustar extras/faltantes antes de la carga unica. Sin nueva migracion ni movimientos de inventario para comprobar. 23 pruebas dirigidas y build correctos. Snapshot historico de sugerido/extras y visitas extraordinarias pendientes.

Visitas extraordinarias (24/10): conectadas con pendientes, asignacion por fecha y cancelacion auditada. Sustituyen habitual en sugerencia de carga; no registran entrega ni cobro. Ver ETAPA_3_PREPARACION.md para pendientes de etapa 3 y operacion del chofer.
