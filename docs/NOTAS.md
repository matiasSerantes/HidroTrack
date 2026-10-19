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
