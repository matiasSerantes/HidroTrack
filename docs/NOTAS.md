# Notas de trabajo de HidroTrack

## Acuerdos vigentes

- 2026-10-19, aclaración del usuario: la web también debe verse y funcionar bien desde PC. Mantener una experiencia adaptada y cuidada en ambos dispositivos, con prioridad de diseño, rapidez y simplicidad para el celular. La demo ya tiene disposición amplia/barra lateral en PC y navegación inferior en móvil; ambas necesitan revisión visual real.

- **Prioridad principal confirmada el 2026-10-19:** el uso habitual será desde celulares durante los repartos. Diseñar primero para móvil, con respuesta ágil, pasos cortos para los choferes y estética cuidada. Evaluar cada pantalla por su utilidad en la calle; no limitarse a achicar una vista de escritorio.
- **Orden de trabajo de seguridad:** avanzar primero hasta una beta funcional y realizar allí la revisión completa y el endurecimiento de seguridad, antes de habilitarla con datos reales. Mantener mientras tanto las protecciones básicas existentes y la separación demo/producción. Este acuerdo no habilita desactivar RLS, exponer secretos ni usar la demo como autenticación real.

- 2026-10-19: procedimiento ampliado y guardado en `AGENTS.md`: primero registrar cada idea en Git; después representarla en la demo visual HTML o mejorar la función existente y su demo; actualizar estado/plan; verificar, hacer commit y push al finalizar cada edición. Estas instrucciones y el contexto deben viajar en el repositorio para trabajar desde otra PC o sesión con acceso al mismo proyecto.
- Al cierre del proyecto indicado por el usuario, retirar las notas temporales de desarrollo y referencias del árbol versionado/entrega, corregir sus enlaces y mantener documentación final de uso/mantenimiento. Hasta ese cierre, conservarlas en Git. No se pidió borrar ni reescribir el historial de commits; los commits antiguos seguirán conteniendo las versiones anteriores.

- 2026-10-19: el usuario pidió mantener notas de ideas y trabajo realizado, y hacer commits y push de los avances terminados.
- Registrar propuestas como ideas hasta que se decida implementarlas. No guardar secretos ni datos personales en este documento.

## 2026-10-19 — Revisión remota de Supabase

Se logró acceder al proyecto mediante el MCP de Supabase usando su autenticación OAuth existente. Se consultaron tablas, migraciones, asesores de seguridad/rendimiento, políticas RLS, funciones, restricciones, índices, triggers y conteos agregados. No se modificó la base.

Resultados:

- Nueve tablas públicas, todas con RLS activado.
- Un administrador registrado. Sin repartos, membresías, licencias, clientes, productos, horarios, preferencias ni eventos de licencia.
- Dos migraciones remotas: `foundation` y `admin_portal`. El repositorio solo contiene la migración inicial y su identificador difiere del remoto.
- Protección de contraseñas filtradas desactivada, cuatro claves foráneas sin índice de cobertura y dos políticas RLS con evaluación de identidad por fila.
- Las funciones públicas administrativas inspeccionadas verifican permisos; los avisos automáticos de SECURITY DEFINER no demuestran por sí solos una exposición.
- Acceso comercial de choferes pendiente por diseño de esta etapa.

Ver [informe completo](REVISION_SUPABASE_2026-10-19.md). No se probaron flujos reales de Auth/PostgREST ni escrituras con distintos usuarios; la inspección no equivale a validar la aplicación de punta a punta.

## Ideas y próximos pasos propuestos

### Tocar parada: clientes de la cuadra y gestión del jefe — pedido del 2026-10-19

Implementado en demo: al tocar una parada en el mapa se muestra el panel «Clientes de esta cuadra», por cuadra/localidad y con visibilidad según rol. El jefe puede subir/bajar el orden y agregar/quitar clientes pendientes desde ese panel. Las visitas resueltas se conservan. Paula Ferrer tiene una dirección cercana de ejemplo y comienza fuera del reparto para probar su incorporación. También se abre este panel al tocar una parada en el mapa general del jefe. Se interpreta «subir o bajar reparto de esa parada» como orden de visita y alta/baja en el reparto; ambos controles quedaron visibles.

### Mapa del jefe con ubicación de asistentes — pedido del 2026-10-19

Implementado en demo: botón «Ver asistentes en el mapa» en la jornada y repartos del jefe, y apartado «Mapa del equipo». Muestra todos sus asistentes activos, repartos abiertos, clientes, avances y última posición simulada emitida desde el mapa del asistente. Actualiza por evento entre vistas/pestañas del mismo navegador y mantiene señal periódica mientras la página está visible. Indica hora, pausa, falta de actualización o ausencia de ubicación. La réplica entre teléfonos/PC reales mediante GPS y servidor queda pendiente; esta entrega no modifica Supabase ni solicita ubicación real.

### Llegada, presencia y envases para devolver — pedido del 2026-10-19

Implementado en demo: cada bidón entregado suma un envase en poder del cliente y los devueltos se descuentan; el saldo se muestra en la próxima visita y durante la carga de cantidades. Al simular llegada se identifica el domicilio y se pregunta presencia. Presente: mostrar envases y equipos prestados/alquilados antes de atender; ausente: volver más tarde, elegir fecha o próxima semana, sin crear venta ni modificar stock. Incluido equipo en préstamo sin cargo como ejemplo para Martín Acosta. La fecha queda en pendientes, pero no crea automáticamente un nuevo reparto. Para producción queda solicitada detección por proximidad GPS con confirmación del cliente, todavía sin implementar.

### Abrir reparto y retomar la jornada — pedido del 2026-10-19

Implementado en demo: botón principal «Abrir reparto» y pantalla «Mi reparto» con mapa completo y ubicación simulada. Permite atender, registrar venta/alquiler/cobro, ver ficha y cuadra, marcar pendientes, revisar carga, solicitar altas/bajas y rendir. Al cerrar y volver recupera perfil demo, reparto, pantalla, selección/posición del mapa y borrador de atención. No representa autenticación ni sincronización de producción; la recuperación funciona en el mismo navegador si conserva su almacenamiento. Salir explícitamente quita el regreso automático, y reiniciar limpia borradores y posiciones demo.

### Mapa visible y ubicación simulada — pedido del 2026-10-19

El usuario no encuentra cómo abrir el mapa desde la web. Implementado: botón «Abrir mapa y ubicación demo», mapa de calles dentro de la web (Leaflet/OpenStreetMap), tres direcciones cercanas sobre Av. de Mayo en Monserrat, CABA, marcadores numerados y punto azul de ubicación actual ficticia. Incluye centrar, ver todo el recorrido, simular avance y abrir ficha. No solicita GPS real ni modifica Supabase. Los puntos son aproximados, no direcciones geocodificadas; la línea une el orden de paradas, sin calcular navegación vial. La migración de los ejemplos guardados conserva las operaciones.

### Ajuste de color solicitado el 2026-10-19

El usuario considera la demo demasiado clara y con poco color. Pedido confirmado: reforzar la paleta y el contraste, conservando la prioridad móvil y la buena presentación en PC. Aplicado en la demo: navegación y bienvenida en petróleo, acciones turquesa y colores diferenciados para estados, métricas y alquileres; textos secundarios más oscuros. Es un ajuste visual; no cambia operaciones ni permisos.

### Demo completa solicitada el 2026-10-19

El usuario pidió una demostración integral con datos ficticios para revisar el programa por partes y después implementar cada módulo. Se construyó una nueva demo con jefe/asistente, autenticador simulado, recorridos y plano, clientes/cuadra, atención multiartículo, ventas y alquileres, stock/vacíos, equipo, aprobaciones/bajas, rendiciones, reportes y marca de empresa. Guía y límites en [DEMO.md](DEMO.md).

Las operaciones están conectadas dentro del estado local: visita → stock/envases/cuenta/avance/aviso; solicitud → aprobación/publicación; rendición → revisión/depósito/otro reparto. No se modificó Supabase. Las reglas provisorias de alquiler, bajas y cierres están señaladas en la demo y no se consideran decisiones definitivas.

Próximo paso: el usuario recorre la demo y elegimos la primera parte para ajustar. Falta la revisión visual manual en navegador y la validación de producción de cada flujo.

### Referencia en video revisada el 2026-10-19

Se analizaron visualmente fotogramas distribuidos por el video de una app similar (2:17 aproximadamente), con revisión adicional de atención, cobro y resumen mensual. Observaciones, tiempos y propuestas en [ideas de la referencia](REFERENCIA_VIDEO_2026-10-19.md). No se analizó el audio ni se incorporaron capturas, video, credenciales o datos personales al repositorio.

Ideas destacadas: atención con columnas de entrega/devolución, stock y envases visibles, desglose de venta/deuda/cobro, estados «No estaba» y «No compró», insertar parada después de otra, alquiler recurrente, plantillas de comprobante/mensajes y resumen mensual. Se mantienen como propuestas, sin convertir tarifas, bonificaciones o GPS del ejemplo en decisiones confirmadas. Próximo paso sugerido: diseñar el flujo de atención y regreso a la ruta.

### Pedidos recibidos el 2026-10-19

Se registró el detalle en [requisitos funcionales](REQUISITOS.md): artículos de venta/alquiler (sifones, cajones, soda suelta, bidones de 12/20 litros, máquinas frío/calor y otros), autenticador, búsqueda por localidad/cliente y vista de cuadra, jefe/asistentes con aprobaciones, recorridos diarios asignables y editables en marcha, calculadora/cobros, alquileres por cliente, baja con motivo/devoluciones/estado y aprobación, stock del transporte y vacíos, múltiples repartos por día, ausentes pendientes, identidad de empresa y seguimiento/notificaciones al jefe.

Son requisitos solicitados, todavía sin implementar. Quedan por precisar: método de autenticador, alcance de las creaciones del asistente, tarifas de alquiler, devoluciones pendientes/daños al aprobar bajas, ubicaciones de stock, definición de cuadra, seguimiento por visita o GPS y canales de notificación. El orden de implementación sugerido está en el documento.

- Reconciliar el historial remoto y local y versionar la migración administrativa antes de nuevos cambios de esquema.
- Preparar y revisar una migración con los cuatro índices faltantes y la optimización de las dos políticas.
- Evaluar la protección contra contraseñas filtradas según el plan de Supabase.
- Provisionar un reparto de prueba y validar acceso, licencia y clientes con cuentas de roles distintos, dentro del alcance acordado para esa tarea.
- Continuar productos y rutas/asignaciones según el plan existente en `public/plan.html`.

Estas propuestas no fueron implementadas durante la revisión.

## Registro de avances

- 2026-10-19: agregado panel de cuadra en los mapas y controles del jefe para orden/agregar/quitar, preservando visitas y clientes. Validación: 42 pruebas, con toque de marcador, cambios desde el mapa, permisos del asistente e historial protegido; compilación correcta. Ordenar o quitar paradas no debe mover artificialmente la posición demo del asistente.

- 2026-10-19: agregado mapa general del jefe y publicación local de posiciones demo con hora/estado; distingue asistentes sin señal y posiciones pausadas/antiguas. Validación: 39 pruebas y compilación correctas, incluida réplica al jefe tras avanzar a Lucía y actualización mediante evento de otra pestaña. La cartografía y apariencia en navegador/dispositivos reales siguen pendientes de revisión visual.

- 2026-10-19: agregado flujo de llegada/presencia, reprogramación fechada y vista de envases/equipos con saldo para la próxima visita. Verificación: 36 pruebas y build correctos, incluidos entrega de un bidón sin devolución y posterior recuperación, préstamo sin cargo, llegada y ausencia con próxima semana. La ubicación continúa simulada y la revisión visual en dispositivos reales sigue pendiente.

- 2026-10-19: integrado «Abrir reparto» como centro de trabajo del asistente y recuperación local al reabrir. Verificado mediante 33 pruebas y build; las pruebas cierran/reabren con un borrador de pago parcial, recuperan el mapa y comprueban que confirmar no duplica ventas. Se validan usuario activo, asignación y parada pendiente al recuperar. Revisión visual real sigue pendiente.

- 2026-10-19: agregado mapa de calles bajo carga diferida, ubicación demo y tres clientes cercanos; actualización de copias locales sin reset. Validación: 29 pruebas aprobadas, incluida apertura del mapa/avance/ficha y conservación de ventas en la migración; build de producción correcto. No se verificó la descarga de cartografía ni la apariencia en un navegador real conectado.

- 2026-10-19: reforzada la paleta de la demo en `DemoPalette.css`, conservando distribución y controles de PC/celular. Cambio visual verificado mediante compilación de producción y revisión de diferencias; no se agregaron pruebas que repliquen estilos. Revisión visual en navegador pendiente.

- 2026-10-19: aclarada y reflejada en instrucciones, requisitos, guía y plan la compatibilidad visual/funcional de PC y celular, con prioridad móvil. Cambio documental; verificado con `git diff --check`.

- 2026-10-19: priorizado el uso móvil como criterio principal en instrucciones, requisitos y plan. Incorporada a la demo una barra inferior con Hoy, Mi ruta/Repartos, Clientes y Mi carga; ampliados controles táctiles y campos en celular y retirado el pedido externo de fuentes. La revisión completa de seguridad se agenda para la beta. Rendimiento, teclado y estética en dispositivos reales siguen pendientes de validar.

- 2026-10-19: persistido el procedimiento de ideas → demo/función existente → actualización de estado → validación/commit/push, con continuidad entre equipos y limpieza de notas al cierre del proyecto. Cambio documental verificado con `git diff --check`.

- 2026-10-19: implementada la demo integral y documentada la guía de prueba. Validación: 27 pruebas aprobadas y build de producción correcto; incluye pruebas de coherencia de operaciones, aprobación de solicitudes y navegación de módulos/roles. No se pudo verificar visualmente en navegador: no había ninguno conectado a las herramientas. Se conserva el acceso conectado anterior fuera de la demo.

- 2026-10-19: documentado el análisis visual de la referencia en video con marcas de tiempo, propuestas para jefe/asistente y límites de lo observado. Validación documental y `git diff --check`; no se modificó la aplicación ni Supabase.

- 2026-10-19: incorporados los nuevos pedidos con identificadores y criterios de aceptación; actualizado el plan visible con el alcance recibido y el estado remoto ya verificado. Validación documental, correspondencia de requisitos y `git diff --check`. No se implementaron funciones nuevas ni se modificó Supabase en esta actualización.

- 2026-10-19: incorporados los acuerdos persistentes en `AGENTS.md`, esta bitácora y el informe de Supabase. Validación: revisión documental y `git diff --check`; no se cambió código de ejecución ni se corrieron pruebas de aplicación para esta actualización documental.

## 2026-10-19 · Carga única por reparto y stock del camión

Pedido: al iniciar, el asistente declara y confirma la carga una sola vez. No puede editarla ni volver a cargar hasta cerrar y solicitar el siguiente reparto. Stock del camión muestra existencias y vacíos actualizados con cada entrega, más importe acumulado de artículos entregados (precio histórico, separado del cobrado y cuotas de alquiler anteriores). Estado: implementado en demo; se conserva la aprobación de rendición existente antes de iniciar otro. Las demos ya activas conservan su carga confirmada.

- Validación de carga/camión: 44 pruebas y compilación; prueba de inicio, entrega, importe y recuperación; dominio verifica bloqueo de carga repetida, siguiente reparto y conservación de carga original. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Inicio de base real de stock

Prioridad pedida: comenzar por la base de datos de stock. Alcance: reutilizar productos existentes, existencias separadas por empresa/depósito/reparto y condición lleno/vacío, movimientos auditables y carga única. Preparar migración y pruebas antes de aplicar por MCP. Reconciliar primero migraciones administrativas existentes; no cargar datos demo en Supabase. Estado: aplicado por MCP como `20261019160747_inventory`; frontend pendiente de conexión.

- Resultado stock: cuatro tablas, tres vistas y tres RPC; carga única, entrega/devolución, precio histórico, cierre exacto por jefe e idempotencia. Recuperadas foundation y admin_portal desde el historial remoto, con sus identificadores correctos. 51 pruebas (9 PostgreSQL), build y comprobación remota correctos; 13 tablas con RLS, cero operaciones demo. Contratos y límites en `docs/STOCK.md`. Siguiente: catálogo/ingreso de depósito reales y cuentas de prueba; no confundir la pantalla demo con stock conectado.

## 2026-10-19 · Ficha de cuenta y deuda autorizada por jefe

Pedido: retirar clientes de la misma cuadra de la ficha (conservarlos en el mapa); destacar si debe o está al día. Una entrega del asistente con importe nuevo sin pagar solicita autorización al jefe; solo al aprobar se suma esa nueva deuda al saldo aprobado. Registrar entrega, stock y cobro en el momento para no ocultar movimientos físicos. La deuda anterior no necesita otra aprobación. Decisión de implementación provisional: el pago se aplica primero a la venta actual y su excedente al saldo anterior; mostrarlo al cobrar. Rechazar no borra la entrega ni el faltante: queda separado como pendiente de cobro no autorizado. Estado: implementado en demo; sin cambios a la base real de stock ni contabilidad de producción.

- Resultado: ficha sin lista de cuadra, cuenta destacada con deuda aprobada/al día/pendiente. Pago parcial crea una solicitud con importe y entrega vinculada; el jefe accede desde notificaciones y aprueba una sola vez, sin repetir venta, cobro ni stock. Rechazo conserva el importe pendiente de cobro sin autorizarlo. Verificado con 58 pruebas y build, incluyendo recuperación y aprobación después de otro cobro. Pendientes: circuito de cobro de crédito rechazado, integración contable real y revisión visual en dispositivos.

## 2026-10-19 · Paleta celeste y bajas en rojo

Corrección pedida: mantener celestes claros, eliminar fondos oscuros en tarjetas y cuenta. Deuda en naranja suave y baja aprobada en recuadro rojo con el día. Detectado choque con la clase global `.pending` del acceso anterior, que oscurecía todas las paradas pendientes. Conservar selección por cuadra en el mapa. Implementar fecha de baja y aviso del día en su reparto sin convertirlo en parada para atender. Estado: implementado en demo.

- Resultado de paleta/bajas: aislado el fondo de paradas pendientes respecto de `.pending` global; tarjetas/cuenta/stock en celestes y deuda en naranja suave. Baja guarda fecha/motivo/repartos y se muestra en rojo el día operativo, sin permitir atender al cliente dado de baja. El jefe conserva acceso al archivo; el asistente solo recibe el aviso de baja de su reparto de ese día. 59 pruebas y build correctos; revisión visual real pendiente. Preferencia actualizada en AGENTS.md para futuras sesiones.

## 2026-10-19 · Patrimonio físico de bidones y surtidores

Aclaración del jefe: compra un parque de bidones que circula entre depósito, camión y clientes; los vacíos se rellenan y no se compran de nuevo en cada ciclo. Mostrar total propio y distribución: depósito lleno/vacío, camión lleno/vacío y envases en clientes (sin suponer si el cliente ya consumió el agua). Surtidores: propios en préstamo gratis, propios en alquiler y del cliente; estos últimos no suman al patrimonio del jefe. Prioridad: completar carga inicial/gestión del jefe para después ingresar datos de Darío Serantes. Implementar recarga vacío→lleno con conservación, apertura de envases en clientes, registro de surtidores y pantalla conectada del jefe; no inventar datos ni crear cuentas de Darío sin sus datos. Estado: implementado en base y pantalla del jefe; cuenta real pendiente de provisionar.

- Resultado patrimonio: aplicada `20261019162655_owned_inventory` por MCP; 15 tablas públicas con RLS, sin empresas, surtidores ni operaciones demo insertadas. Pantalla real Stock y surtidores: catálogo, compra/apertura llenos o vacíos, apertura en cliente, recarga, preparación/carga única/regreso de camión y alta/ubicación de surtidores propios o del cliente con historial. Demo: parque de envases y recarga conservando total. 69 pruebas y build correctos; integración con Auth/PostgREST real, revisión visual y concurrencia multiconexión pendientes. Para Darío faltan empresa/correo/provisión y su inventario; plantillas vacías en docs/plantillas, sin datos reales en Git.

- Compilación comprobada también con variables públicas ficticias para incluir el acceso conectado. Se separó por carga diferida el panel real y la demo; la compilación configurada dejó de generar un bloque inicial superior a 500 kB. Esto no sustituye mediciones de rendimiento en un teléfono real.

## 2026-10-19 · Primer jefe y perfiles de usuarios

Pedido autorizado: preparar base de perfiles y provisionar el primer jefe con los datos de acceso indicados por el usuario, para cargar inventario real. Reutilizar Supabase Auth y membresías; no duplicar contraseñas en tablas públicas. Verificar si la cuenta existe antes de crearla. Nombre/correo/contraseña y IDs de la cuenta no se guardan en Git; registrar solo resultados agregados. Estado: perfiles aplicados; alta del jefe bloqueada por revisión automática pendiente de autorización explícita del mecanismo.

- Resultado usuarios: aplicada `20261019163826_user_profiles`; perfiles con RLS, nombre en panel y selector, 16 tablas públicas. 70 pruebas y build correctos. Cuenta solicitada inexistente, sin crear usuario/empresa/licencia todavía. La revisión automática rechazó el alta temporal por requerir autorización específica, incluso con JWT y token limitado; no se desplegó. Se conservó admin-users y no se alteró Auth. Ver docs/USUARIOS.md. Credenciales/datos personales fuera de Git.

- 2026-10-19: el usuario autorizó explícitamente el alta administrativa temporal con JWT, token, restricción de correo y desactivación posterior. Continuar el alta del primer jefe y verificar sesión/acceso antes de darla por terminada. Sin credenciales ni datos personales en Git.

- Alta del primer jefe completada después de la autorización explícita: Auth Admin, perfil, owner, empresa inicial y licencia activa solo para jefe. Verificados login y lecturas REST con JWT real; stock y surtidores vacíos. Función temporal sustituida por HTTP 410 y token local retirado. Se cerró la sesión de comprobación. No se guardan datos personales/credenciales en Git. Siguiente: ingresar desde la web con la cuenta real y cargar catálogo/conteo inicial.

## 2026-10-19 · Igualar acceso real a la estética de la demo

Corrección pedida: conservar diseño aprobado al trabajar con cuenta real. Integrar clientes e inventario conectados en la estructura visual de la demo: barra lateral en PC, encabezado de empresa y navegación inferior/móvil. Usar las mismas hojas de diseño/paleta, sin copiar datos ficticios ni presentar módulos pendientes como reales. Navegación a artículos, camión/repartos y surtidores sobre las secciones ya conectadas. Mantener bloqueo de navegación durante escrituras inciertas. Estado: en implementación.

- Resultado: estructura compartida implementada, 72 pruebas y build aprobados; push 8930b89. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Catálogo visible y stock inicial vacío

Pedido: destacar catálogo de artículos, separar camión/repartos del inventario y facilitar el conteo inicial de bidones vacíos. El precio y la unidad del catálogo no representan existencias. Stock mostrará depósito llenos/vacíos, en clientes y total en camiones sin desglosarlo; el detalle de carga irá en Repartos. Catálogo tendrá listado propio y acción destacada para agregar artículos. No interpretar números ingresados como unidad/precio como cantidades ni alterar datos reales automáticamente. Estado: en implementación.

- Implementado en la cuenta real: Catálogo visible en menú con tarjetas, precio y existencias diferenciadas; Stock, Repartos y Surtidores muestran sus propias secciones. Apertura de vacíos predeterminada y guía de carga inicial. Sin modificaciones remotas ni cambios de cantidades existentes. 74 pruebas aprobadas, incluida carga inicial de 600 vacíos y separación de secciones; build correcto. Navegador de automatización sin superficies disponibles, revisión visual pendiente. La demo conserva su catálogo separado y las operaciones ficticias.

## 2026-10-19 · Carga con lista y confirmación conjunta

Pedido: mostrar artículos y cantidades en una lista (bidones de distintas capacidades, surtidores del catálogo y otros), confirmar con Registrar carga y conservar una sola carga por reparto. Aplicar también la lista al formulario de inventario/recarga señalado, diferenciando stock del depósito y carga del camión. Reutilizar las RPC que admiten varios artículos en una transacción y conservar el ID en reintentos inciertos. Equipos individualizados de Surtidores conservan su gestión por identificación; no duplicarlos como artículos automáticamente. Estado: en implementación.

- Implementado: lista con cantidades y total, disponibles de depósito, confirmación conjunta y formulario de camión retirado tras confirmar su carga. Aperturas/recargas del depósito también aceptan varios artículos con un solo registro. Demo conserva su lista y usa los mismos títulos Carga de camión / Registrar carga. Sin cambios de esquema ni carga de datos remotos. 76 pruebas y build aprobados; comprobadas varias presentaciones en una RPC, lista vacía, carga única y reintento con ID conservado. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Nombre Dispenser y reclasificación

Pedido: reemplazar Surtidores por Dispenser en la aplicación y mover a esa sección los equipos cargados como artículos de Stock. Revisar registros reales antes de reclasificar; conservar cantidades, ubicaciones e historial, sin duplicar patrimonio ni borrar movimientos. Estado: en revisión; primero cambio de textos y comprobación de acceso remoto.

- Nombre cambiado a Dispenser en menú, formularios, métricas, demo y documentación de uso. 76 pruebas y build aprobados. Traslado real pendiente: esta sesión no dispone de herramientas MCP Supabase; la búsqueda de conexión confirmó integración disponible pero no instalada/conectada. Se solicitó conexión, sin acceso a registros ni modificaciones remotas. Al conectar, continuar el traslado ya autorizado: revisar artículos candidatos y movimientos antes de decidir conversión por cantidad/modelo a equipos, conservando patrimonio e historial. No marcarlo como terminado con el cambio de texto.

## 2026-10-19 · Ficha y edición de clientes reales

Pedido: botones Editar, Eliminar y Abrir ficha en clientes; registrar bidones que ya posee el cliente y equipos asociados desde su planilla. Implementar con consultas por empresa/cliente y RPC existentes, conservar inventario e historial. Eliminar retirará al cliente de activos conservando sus registros, avisándolo antes de confirmar. Apertura de envases solo para el conteo anterior al uso del sistema (no sustituye una entrega ni traslada stock ya contado). No simular deuda si todavía no hay cuenta corriente conectada. Estado: en implementación.

- Implementado: lista con acciones visibles y formato de tarjetas móvil; edición de nombre/dirección/teléfono, eliminación de activos con confirmación y ficha por cliente. Ficha consulta envases, dispenser y movimientos, registra apertura inicial de varios artículos y asigna equipo existente del depósito como préstamo o alquiler. Incluye propiedad del cliente y bloqueo de navegación/reintento con ID conservado ante resultado incierto. Demo permite editar datos desde la ficha conservando envases/deuda/equipos. 83 pruebas y build aprobados. Sin cambios remotos de esquema/datos; revisión visual en dispositivos y comprobación con sesión real pendientes. El traslado previo de dispenser desde Stock continúa pendiente de conexión MCP.

## 2026-10-19 · Edición de artículos, fechas y roturas

Pedido: separar los modelos dispenser del catálogo común, permitir editar/agregar/retirar existencias y registrar roturas con fecha, ubicación y persona a quien le ocurrió (jefe, asistente o cliente). Conservar autor que registra, persona involucrada e historial como conceptos distintos; no implica cobrar automáticamente a nadie. No convertir unidades/precios en cantidades: los números escritos en Unidad no son stock. Preparar migración y pruebas locales para movimientos auditados, fechas de hecho y registro. Esta sesión sigue sin MCP Supabase disponible: no afirmar aplicación remota ni traslado de cantidades. Estado: en implementación.

- Frontend implementado: modelos dispenser separados visualmente conservando ID/libro, edición de nombre/unidad/precio, ingreso de unidades por modelo en Dispenser, fechas de carga y formulario de bajas/roturas con cantidad, ubicación, cliente/reparto y persona involucrada. Equipos identificados se dan de baja sin borrar su historial y dejan de estar disponibles para asignar. La separación usa nombre en la base anterior y familia persistente al aplicar la migración; no crea equipos ni interpreta Unidad como cantidad.
- Migración local preparada: `20261020130955_inventory_incidents.sql` agrega familia, fecha del hecho, persona y origen en movimientos, RPC fechada y bajas transaccionales, y rotura de equipos con auditoría. Solo jefe, roles/empresas validados, stock insuficiente rechazado, ID estable en reintentos; no cobros automáticos. **Pendiente de aplicar remotamente por MCP**: no hay herramientas Supabase conectadas en esta sesión. El frontend detecta columnas nuevas; conserva entradas anteriores y deshabilita bajas/roturas/fechas editables con aviso hasta actualizar la base, sin simular guardados.
- Demo integrada en Carga y rendición: roturas/bajas de artículos con fecha, ubicación, persona e historial local. Validación: 95 pruebas (35 dominio, 17 PostgreSQL, 43 interfaz), build correcto. Pruebas de cliente/camión/depósito, reintentos, saldo insuficiente, aislamiento y equipos retirados. Revisión visual en dispositivos e integración remota de nuevas RPC pendientes. Siguiente paso: conectar Supabase y aplicar/verificar esta migración; no repetir autorización ya dada para esta función.

## 2026-10-19 · Botones visibles sin pasar el puntero

Pedido: los botones secundarios se confunden con el fondo (ejemplo Archivar). Deben tener fondo celeste y borde visible en reposo, buen contraste, foco de teclado y estados distinguibles en celular y PC. Mantener turquesa en acciones principales y rojo suave en eliminar. Aplicar base común a las acciones reales y reforzar botones secundarios de la demo. Estado: en implementación.

- Implementado en CSS compartido y acceso real: fondo celeste, borde azul y texto definidos desde reposo; foco visible, controles deshabilitados distinguibles, turquesa principal y rojo suave al eliminar. Incluye botones antes sin clase (actualizar, cancelar, preparar reparto y otros). Build y diff correctos; cambio solo visual, sin pruebas nuevas de lógica. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Planilla como acceso principal del cliente

Pedido: reemplazar el acceso de archivar en la lista por Planilla. Mover Archivar cliente al interior de la planilla, exclusivo del jefe. También conservar Editar datos dentro para simplificar la lista. Mantener confirmación, historial y bloqueo ante escrituras pendientes. Estado: en implementación.

- Implementado: lista con Planilla como acción principal; Editar datos y Archivar cliente dentro de la planilla real. Archivo con confirmación, historial conservado y bloqueo mientras hay una escritura incierta. El acceso real sigue restringido al jefe por rol y RLS existentes. Demo muestra Planilla y reserva Archivar cliente al jefe; asistentes conservan Solicitar baja. Pruebas de edición/archivo actualizadas al flujo y comprobación del bloqueo. Build y 95 pruebas aprobados; revisión visual en dispositivos pendiente.

## 2026-10-19 · Unidades antes que precio en catálogo

Pedido: destacar unidades activas de cada artículo/modelo y dejar precio debajo. Mostrar existencias reales registradas y distribución depósito/camión/clientes, sin interpretar el campo Unidad como cantidad. Aplicar a tarjetas reales y demo. Estado: en implementación.

- Implementado: unidades activas en grande; distribución en depósito (llenos y vacíos), camión (llenos y vacíos) y clientes; precio secundario al pie. En cuenta real se usa total propio del libro y no el campo Unidad. Demo presenta su inventario ficticio y equipos propios colocados, excluyendo propiedad del cliente. Compilación y 95 pruebas correctas; no se modificaron cantidades ni base remota. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Retomar cierre de base de inventario

Usuario pide continuar con base de datos. Prioridad: completar/verificar migración pendiente de fechas, roturas y bajas antes de avanzar a ventas/cuentas corrientes. Comprobado servidor Supabase configurado y enabled en CLI local, pero sin herramientas MCP disponibles en esta sesión; integración de esta aplicación figura no instalada. No volver a pedir autorización del trabajo ya dado. Preparar verificación posterior de esquema, permisos y saldos; no marcar aplicada remotamente hasta ejecutarla por MCP y verificar.

- Agregada verificación de solo lectura `supabase/tests/inventory_incidents_verify.sql`: funciones, permisos anónimos/autenticados, RLS, protección de escrituras directas y saldos por depósito/camión/cliente. Pasa en PostgreSQL local; 96 pruebas totales. No se aplicó la migración remota.
- El primer intento de login MCP desde el entorno restringido no detectó autorización. Al reintentar con red habilitada se inició correctamente el flujo OAuth de Supabase, pendiente de completarse en navegador. No guardar enlaces de autorización ni tokens en Git. Tras completar, comprobar herramientas disponibles y aplicar/verificar la migración pendiente antes de dar el inventario real por cerrado.

- OAuth completado correctamente y confirmado por CLI con red habilitada: servidor Supabase enabled, Auth OAuth. No repetir login ni pedir nuevos permisos. El cliente MCP de esta conversación aún falla al inicializar con Auth required (resources y templates), por lo que no se aplicó la migración. Hace falta reiniciar/reconectar el cliente MCP de la aplicación para que utilice la autorización guardada; después retomar la migración y verificación de solo lectura ya preparadas. Guía oficial consultada: https://learn.chatgpt.com/docs/extend/mcp?surface=cli . No eliminar servidor ni credenciales.

## 2026-10-19 · Dispenser por modelo disponible para asignar

Corrección: el ingreso de stock por modelo debe alimentar el selector del cliente, sin exigir registrar otra vez cada equipo. Unificar disponibilidad con el libro: asignar traslada una unidad desde depósito/camión al cliente, devolver la libera y una rotura la retira. Conservar equipos ya individualizados sin duplicarlos. Registrar asignaciones por unidad y préstamo/alquiler, historial e IDs de reintento. MCP de esta sesión sigue fallando Auth required pese al OAuth guardado; preparar migración y flujo verificables sin afirmar aplicación remota. Estado: en implementación.

- Preparado frontend y migración `20261020130959_dispenser_model_assignments.sql`: selector combina stock por modelo y equipos individualizados; préstamo/alquiler por unidad, origen depósito o camión de reparto activo del cliente, fecha y devolución desde planilla. No vuelve a ingresar patrimonio ni crea existencias desde el campo Unidad. Rotura/baja del modelo en el cliente cierra asignaciones y no las vuelve disponibles. Dispenser muestra unidades disponibles para asignar. Historial y verificador SQL actualizados.
- Validación local: 102 pruebas (35 dominio, 21 PostgreSQL, 46 interfaz), build correcto; ciclo recepción/asignación/devolución/rotura, disponibilidad, permisos, fecha e idempotencia. Esquema local: 17 tablas con RLS; remoto sin cambios, sigue pendiente verificar su estado. Demo muestra disponibilidad en planilla para asignar mediante atención del reparto.
- **Pendiente remoto**: aplicar primero `20261020130955_inventory_incidents.sql` y después `20261020130959_dispenser_model_assignments.sql`, verificar historial/migraciones antes para no repetir. Después ejecutar `supabase/tests/inventory_incidents_verify.sql` por MCP. Mientras falte la tabla nueva, modelos del stock se muestran pero no se simula su asignación; la web avisa actualización pendiente. OAuth ya guardado; cliente de este chat aún devuelve Auth required. No repetir login ni afirmar que funciona en producción.

## 2026-10-19 · Eliminar artículos de bidones y dispenser

Pedido: volver a probar MCP y agregar Eliminar en tarjetas de stock/modelos. Nuevo intento de conexión sigue devolviendo Auth required; sin cambios remotos. Implementar eliminación de activos con confirmación conservando el registro histórico; comprobar stock antes y rechazar si quedan unidades en depósito/camión/clientes, para no ocultar patrimonio. Preparar protección equivalente en base y reflejar acción en demo. Estado: en implementación.

- Implementado Eliminar en tabla de stock de bidones y tarjetas de artículos/modelos dispenser. Consulta existencias antes de confirmar; si quedan unidades no oculta el artículo. Si no quedan, actualiza active=false sin borrar filas ni historial. Demo incorpora el mismo criterio y controles visibles. Protección atómica de base preparada en `20261020131002_product_archive_guard.sql`, pendiente de aplicar después de incidentes y asignaciones; hasta entonces la comprobación de interfaz no sustituye el control del servidor frente a operaciones concurrentes.
- Usuario pidió un nuevo enlace OAuth y lo completó: login confirmado exitoso, pero el cliente MCP de esta conversación volvió a fallar Auth required después de la autorización. Sin modificación remota; no registrar enlaces ni tokens en Git. Pendiente reconexión real del cliente y aplicación/verificación de las tres migraciones.
- Validación local: 107 pruebas (36 dominio, 22 PostgreSQL, 49 interfaz) y build correctos; eliminación de activos, cancelación, bloqueo con existencias y conservación del historial. Revisión visual en dispositivos pendiente.

## 2026-10-19 · Reinicio de inventario autorizado

El titular confirma que el reparto pendiente era de prueba y autoriza eliminarlo junto con el reinicio de inventario solicitado. Operación puntual y transaccional, limitada a su empresa y ese reparto; conservar cuenta, licencia, miembros y clientes. Verificar conteos después y registrar resultado sin datos personales.

Actualización: MCP con token por variable de entorno conectado y consulta remota correcta al proyecto verificado. Empresa del titular comprobada: 3 artículos, 9 movimientos, ningún equipo individualizado y 1 cliente. Se detectó 1 reparto activo/en rendición, por lo que la limpieza no se ejecutó conforme al bloqueo previsto. Resolver ese reparto antes de reiniciar; cuenta y cliente sin cambios. No guardar token ni identificadores personales en Git. Las tres migraciones locales siguen pendientes de aplicación remota.

Resultado local: preparado `supabase/maintenance/reset_inventory.sql`, acotado a una empresa verificada, con bloqueo ante reparto activo/en rendición y comprobación de clientes conservados. No es una migración ni una función pública. Probado aislamiento de otra empresa y conservación de cuenta/clientes/licencias. El bloqueo de Eliminar ahora muestra un aviso inmediato. Validación: 109 pruebas (36 dominio, 24 PostgreSQL, 49 interfaz) y build correctos; revisión visual pendiente. **Limpieza remota sin ejecutar**: MCP sigue respondiendo Auth required. La revisión automática rechazó acceder a credenciales OAuth fuera del flujo normal; no se leyeron tokens. Continuar mediante reconexión del MCP soportado.

Usuario informa que Eliminar no retiró el bidón y pide limpiar nuevamente bidones/dispenser para empezar de cero. La restricción anterior impide eliminar artículos con unidades; mejorar el aviso inmediato para que no parezca que no responde. **Autorizado reinicio de catálogo e inventario de su empresa**: artículos, equipos, asignaciones, existencias y movimientos de inventario; conservar cuenta/Auth, empresa, licencia, usuarios y clientes. Verificar empresa destino con lectura MCP antes de ejecutar, sin inferir cantidades desde Unidad. No resetear otras empresas ni borrar clientes. Preparar operación transaccional acotada y rechazar si hay repartos activos/en rendición para evitar incoherencias. MCP probado nuevamente, todavía Auth required; limpieza remota no ejecutada. No repetir pedido de autorización del reinicio.

Resultado remoto 19/10: reinicio ejecutado por MCP en una sola empresa y transacción. Eliminado el reparto de prueba autorizado. Verificados cero artículos, equipos, movimientos y repartos; conservados cliente, cuenta Auth, miembros y licencia mediante comparación dentro de la transacción. Las tres migraciones adicionales siguen pendientes; esta limpieza no las aplica.

## 2026-10-19 · Integración de trabajo local y remoto
Pedido: actualizar desde Git conservando aportes locales únicos sin reemplazar avances más recientes. Respaldo completo en stash antes del fast-forward a 7f38c80. Conservar demo integral principal, recuperar administración conectada y mantener demo anterior en acceso separado. Revisar migración administrativa duplicada y combinar pruebas. Estado: en integración; sin cambios remotos en Supabase.


Resultado: integrado sobre 7f38c80. Demo integral principal conservada; demo local anterior accesible en /?demo=legacy; recuperados panel de administración, función admin-users y sus pruebas. Migración administrativa local idéntica a la remota: se conserva solo el nombre remoto para evitar ejecución duplicada. Combinada prueba administrativa con las pruebas recientes de inventario. Build correcto y 135 pruebas aprobadas. Respaldo original conservado en stash. No se desplegó ni modificó Supabase. Revisión visual manual de ambas demos en celular/PC pendiente.

## 2026-10-19 · Retomar cierre de inventario
Integración subida como c425943. Siguiente paso según la bitácora: comprobar historial remoto y aplicar solo migraciones pendientes de incidentes, asignaciones y protección de archivo, luego verificar saldos/permisos. Supabase no está conectado en esta sesión; se ofreció su conexión. Preparar diagnóstico previo de solo lectura sin datos personales ni modificaciones para distinguir componentes ausentes, parciales y presentes. Estado: preparación local; ninguna migración aplicada remotamente.

Resultado: diagnóstico supabase/tests/inventory_preflight.sql y guía docs/CIERRE_INVENTARIO.md preparados. Estados absent/partial/present contrastables con historial; no sustituyen verificar código ni permisos. 137 pruebas locales aprobadas, incluyendo esquema vacío, parcial y completo bajo transacción de solo lectura. Build de integración aprobado previamente; este avance no modifica interfaz ni código de aplicación. Sin acceso remoto confirmado, ninguna migración aplicada. Siguiente paso: conectar Supabase, verificar proyecto/historial/componentes, aplicar solo faltantes y ejecutar verificador posterior.

## 2026-10-19 · Avanzar web y retirar demo gradualmente
Pedido: avanzar en la parte web mientras falta conexión de base, retirando simulaciones cuando sus equivalentes reales estén listos. Primer avance: acceso real como entrada predeterminada; una jornada demo guardada no debe secuestrar el inicio. Demo solo por elección explícita, conservando datos y reanudación dentro de ella. Al salir se limpia únicamente el parámetro de demo de la URL. Estado: en implementación. No retirar funciones de demo sin reemplazo conectado comprobado.
Resultado: entrada automática a demo por jornada guardada retirada. Acceso real predeterminado y demo explícita; salida limpia solo demo de URL conservando parámetros, fragmento, estado de navegación y datos. Tres regresiones probadas: jornada guardada, sesión real y salida/recarga. 140 pruebas aprobadas. Sin cambios de diseño; no se retiraron mapas, ventas ni otras simulaciones sin reemplazo verificado. Siguiente avance: validar módulos conectados de clientes e inventario antes de retirar sus equivalentes demo.

## 2026-10-19 · Panel personal de administración
Pedido: panel para el propietario de la plataforma, desde el que gestionar personas que usan la web. Ampliar AdminWorkspace existente: resumen, directorio de personas, búsqueda por correo/empresa, filtros por rol/estado y gestión de licencias. Mantener verificación is_platform_admin y controles de servidor; no otorgar acceso a datos comerciales ni simular cambios reales. Reutilizar altas y edición de licencias existentes; vista previa explícita con datos ficticios en /?demo=admin. Estado: en implementación; despliegue y acceso real del titular pendientes de comprobar.

Resultado 20/10/2026: panel ampliado con resumen, directorio de membresías, búsqueda por correo/empresa, filtros de rol y acceso, salto a empresa, altas y edición de licencias reutilizando los controles existentes. Vista previa explícita /?demo=admin sin acceso a datos reales. Diseño celeste/turquesa con barra lateral y tablas en PC, navegación horizontal y tarjetas en móvil. 143 pruebas aprobadas y build correcto; pruebas de filtrado, suspensión ficticia aislada y actualización real limitada al tenant seleccionado. Sin cambios remotos ni asignación de administrador. No hay navegador habilitado en esta sesión: revisión visual pendiente. Próximo paso: comprobar tu cuenta administradora por MCP, probar panel real y completar acciones individuales según alcance solicitado.

## 2026-10-20 · Pausar y reactivar choferes desde administración
Continuación del panel: permitir al administrador cambiar el estado de la membresía de un chofer en una empresa, con confirmación, conservación de cuenta/historial y auditoría. No modificar titular ni roles. Reactivación sujeta a licencia vigente y cupo bajo bloqueo transaccional. Preparar migración y frontend sin aplicarlos remotamente. La demo reproduce el cambio local; la cuenta real informa si falta actualización. Estado: en implementación.

Resultado: Pausar/Reactivar en el directorio para choferes, confirmación y cambios aislados por empresa, sin borrar cuenta/historial ni cerrar repartos. Demo funcional; cuenta real usa admin_set_driver_access e informa actualización pendiente si falta RPC. Migración 20261020131006_admin_member_access preparada con permisos de administrador, protección de titulares, bloqueo de licencia para cupo y auditoría con RLS (18 tablas públicas locales). 149 pruebas aprobadas y build correcto. Se probaron cancelación, pausa/reactivación, límite, suspensión/vencimiento, estado nulo, aislamiento, permisos, auditoría y reintentos sin duplicar eventos. No se aplicó migración remota. Revisión visual pendiente por falta de navegador en la sesión.

## 2026-10-20 · Historial administrativo de accesos
Continuación: consultar últimos 100 cambios de acceso con empresa, chofer, administrador, acción y fecha argentina. Preparar RPC de solo lectura restringida a administradores y pantalla con carga/error/actualización pendiente. Demo muestra cambios de esta sesión, sin mezclar datos reales. Estado: en implementación. Push c8ce6b5 rechazado nuevamente por revisión automática: requiere autorización explícita; se continúa localmente sin publicación.

Resultado: Historial de accesos integrado con consulta explícita, actualización y estados de carga/error/migración faltante/vacío. RPC de solo lectura devuelve últimos 100 cambios con empresa, correos actuales, acción y fecha, solo para administradores; sin acceso anónimo ni de titulares. Migración 20261020131010_admin_access_history pendiente de aplicación después de admin_member_access. Demo registra cambios de esta sesión, los borra al restablecer y no consulta servidor. 152 pruebas aprobadas y build correcto; permisos, atribución, fecha argentina y reintento comprobados. Sin revisión visual por falta de navegador. Cambios guardados localmente; publicación bloqueada por revisión automática hasta autorización explícita del push.

## 2026-10-20 · Preparar la base completa

Pedido: completar la preparación de la base. Pull previo realizado hasta d135fb9. Proyecto verificado por MCP: cinco migraciones iniciales, 16 tablas con RLS. Preflight de inventario indica tres actualizaciones ausentes; sin componentes parciales. Aplicar las cinco migraciones locales pendientes en orden y verificar antes de continuar con dominios comerciales faltantes. No repetir limpieza ni insertar datos ficticios remotos. Estado: en curso; no dar toda la base por terminada con el inventario.

Decisión confirmada 20/10: deuda rechazada por el jefe sigue pendiente de cobro al cliente; no se transfiere al asistente. Preparar libro comercial vinculado a entregas existentes: precio histórico de servidor, pagos parciales efectivo/transferencia, aprobación separada del saldo, notificaciones internas y operaciones idempotentes/transaccionales. Mantener aislamiento por empresa y clientes asignados. No generar alquileres periódicos automáticamente ni cargos por roturas. Demo ya representa venta/cobro/deuda; esta etapa conecta su contrato de base, sin afirmar integración de pantalla.

Siguiente bloque de base: paradas ordenadas y desactivables sin borrar asignaciones históricas, visitas y reprogramación auditadas con versión, coordenadas opcionales y manifiesto del reparto con envases y deuda. Posición actual del chofer solo al publicar desde un reparto activo; conservar hora de servidor y permitir detener la emisión. Es soporte de base: no afirmar GPS en vivo ni navegación conectados antes de integrar la web.

Decisión confirmada: futura baja pendiente de recuperación. Bloquear nuevas entregas y equipos mientras se recuperan envases/dispenser; permitir devoluciones y cobros. Notificar al jefe y conservar pendiente visible hasta recuperar todo y aprobar la baja definitiva. No confundir esta etapa con cliente inactivo ni borrar deudas o historial.

Rendición de base: declarar caja efectivo/transferencia y stock con esperado de servidor; diferencias requieren observación. Chofer envía, jefe aprueba o devuelve observado; aprobación y regreso de stock en la misma transacción. Para repartos con pagos, bloquear cierre antiguo sin rendición aprobada. No afirmar verificación bancaria ni sincronización offline: ambas requieren integración de cliente.

Alquiler confirmado: cada mes desde la fecha de entrega. Preparar cargos por período anclado a esa fecha, con unicidad por equipo/período y precio pactado; generación explícita por jefe, sin cron ni cobro automático. No desplazar el ancla al ajustar meses cortos. También preparar apertura de deuda histórica del cliente con fecha y motivo, sin tocar stock. Prorrateo, anulaciones/reintegros y facturación fiscal quedan pendientes de definir; no inventar reglas de cargos automáticos.

## Base principal instalada el 20/10/2026

17 migraciones y 29 tablas con RLS verificadas por MCP. Inventario/roturas/asignaciones y administración actualizados; ventas, cobros, deuda, alquiler mensual, recorridos, futura baja y rendición preparados en servidor. 177 pruebas de dominio, PostgreSQL e interfaz, build y verificadores remotos correctos. Sin datos comerciales ficticios en remoto. Detalle y límites: [BASE_DE_DATOS.md](BASE_DE_DATOS.md). Concurrencia multiconexión, prueba Auth/PostgREST de nuevos flujos y revisión visual móvil/PC pendientes.

Comprobación final: suite completa de 176 pruebas aprobada con 4 workers; se agregó y pasó además una regresión de interfaz para futura baja (18 pruebas de ese archivo), total 177 cubiertas. El fixture PostgreSQL de preflight admite 30 s para inicialización WASM bajo carga; no se cambió ninguna aserción por ese timeout. Build correcto. Renombradas 12 migraciones locales a las versiones efectivamente registradas por MCP; sus referencias/preflight/tests también. Sin despliegue manual de frontend ni inserción remota de fixtures.

## 2026-10-20 · Estado de los bidones al ingresar

Pedido: preguntar explícitamente si los bidones del jefe ingresan vacíos o llenos, y ofrecer marcarlos llenos al cargar. Mostrar selector claro en stock con vacíos predeterminado, sin confundir compra/apertura (agrega patrimonio) y recarga (conserva envases). Consultada la interpretación de rellenar y cargar camión juntos; pendiente de respuesta antes de cambiar ese flujo. Estado: en curso.

Confirmado: rellenar y cargar camión juntos. Usar primero llenos disponibles y rellenar solo el faltante retornable desde vacíos del depósito. Operación atómica e idempotente; mantener carga única y patrimonio. No permitir rellenar dispenser ni mercadería no retornable. Ofrecer opción explícita y fecha; no marcar stock como lleno sin registrar la recarga.

Resultado 20/10: selector explícito Vacíos/Llenos al ingresar stock, conservando la cantidad al cambiar estado. Repartos ofrece rellenar los vacíos que falten para la carga; usa primero llenos y confirma recarga+carga en una transacción con IDs estables. Implementado en acceso real del jefe y demo; nueva RPC instalada por MCP como 20261020135912_fill_and_load. 184 pruebas y verificación remota correctas; 18 migraciones, 30 tablas con RLS. No se cargaron unidades remotas de prueba. Revisión visual pendiente: inventario de automatización sin apps ni navegadores expuestos. Prueba completa Auth/PostgREST de la pantalla pendiente.

## 2026-10-20 · Catálogo unificado

Pedido: productos y dispenser en un solo Catálogo; quitar sección separada de dispenser del menú. Orden: Agregar dispenser, debajo Agregar producto, inventario con acciones de eliminar/corregir y al final Retirar producto o dispenser. Mantener cantidades, ubicaciones e historial, sin volver a convertir registros ni duplicar equipos. Eliminar de activos sigue bloqueado si quedan existencias; retiros/roturas se registran aparte con fecha y persona. Reflejar en web y demo. Estado: en curso.

Interpretación de corrección de alta: Eliminar puede dar de baja auditada las unidades que sigan solo en depósito y archivar el modelo en una transacción con confirmación. Bloquear si hay unidades en camiones o clientes. Equipo individual ingresado por error: retirar del activo desde depósito conservando evento, sin fingir rotura. Categoría explícita al crear, sin depender del nombre. No borrar historial ni relaciones de clientes.

Resultado 20/10: Catálogo unificado en web real y demo, sin menú separado Dispenser. Arriba Agregar dispenser y Agregar producto; inventario combinado debajo y Retirar producto o dispenser al final. Conserva entradas de stock y gestión individual por serie. Corrección de alta elimina de activos y retira stock solo del depósito de forma auditada/atómica; rechaza unidades en camiones o clientes. Equipos individuales del depósito se retiran por alta errónea sin fingir rotura. Tipo explícito al crear, independiente del nombre. Migración 20261020141330_unified_catalog aplicada y verificador remoto correcto. 193 pruebas aprobadas; 19 migraciones, 31 tablas con RLS. Sin alterar cantidades ni registros comerciales reales en esta tarea. Revisión visual móvil/PC y prueba Auth/PostgREST del flujo completo pendientes.


## 2026-10-20 - Asistentes con cuenta propia y varios jefes

Pedido: el jefe agrega asistentes/empleados existentes a su equipo y puede quitar el vinculo sin borrar la cuenta. Cada asistente crea su cuenta, puede pertenecer a varios jefes y no necesita licencia propia. Sin recorrido asignado ve solamente En espera de recorrido; no ve cartera, stock, ventas ni datos del jefe. Cupos por licencia del jefe: basica 1, intermedia 3, superior ilimitados. Registrar y representar primero en demo conforme al procedimiento del repositorio. Estado: en implementacion de demo; registro Auth, vinculacion real y nuevas reglas de licencia/permisos requieren integracion posterior, sin cambios remotos en esta etapa.

Criterio provisional: el cupo cuenta vinculos habilitados, incluso esperando recorrido; quitar libera cupo. No quitar mientras haya reparto activo o rendicion pendiente: resolverlo primero. Cuenta e historial se conservan. Los planes no descuentan dinero ni dias por cada asistente: se interpreta como cupo incluido, pendiente de definir precios. No cambiar licencias actuales automaticamente.


Resultado 20/10: demo implementada con registro ficticio independiente, agregar cuenta existente por correo, asignar recorrido desde la tarjeta y quitar/reagregar sin perder identidad ni historial. Espera privada sin menu, datos comerciales ni ficha restaurada; persiste al recargar. Cupos 1/3/ilimitados y bloqueo de reduccion por debajo del equipo. Ejemplo de relacion con otra empresa conservado, sin segundo espacio comercial navegable. 200 pruebas aprobadas en 22 archivos y build correcto. Sin modificaciones remotas de cuentas, licencias o RLS. Revision visual manual movil/PC pendiente; estilos adaptados a ambos. Siguiente: registro Auth verificado y contrato de vinculacion/consentimiento y permisos por recorrido antes de activar este flujo real.
