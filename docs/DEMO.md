# Guía de la demostración completa

## Abrir

Ejecutar `npm run dev` y entrar a `http://127.0.0.1:5173/?demo=1` (usar el puerto que informe Vite si está ocupado). También se puede entrar desde «Explorar demostración» en el inicio.

Elegir **Santiago · repartidor jefe** o **Lucía · asistente**. El código del autenticador ficticio es **123456**. Después, el selector «Explorar como» permite cambiar de rol conservando las operaciones locales.

La empresa de ejemplo es **Agua Clara**. El día operativo es el **19/10/2026**; las horas de las acciones corresponden a la hora actual de Buenos Aires. No son datos de un reparto real.

### El espacio principal del asistente

Entrar como Lucía y pulsar **Abrir reparto**. La pantalla **Mi reparto** muestra el mapa completo y permite seleccionar clientes, atender con entrega/retiro/alquiler/cobro, consultar ficha y cuadra, marcar ausencia, pasar al siguiente pendiente, revisar carga, solicitar altas/bajas y rendir. La atención se abre encima del reparto; al confirmar vuelve al mapa actualizado. En celular se accede también desde la barra inferior «Mi reparto».

### Llegar a un cliente y controlar lo que debe devolver

En **Mi reparto**, pulsar **Simular avance** o **Llegué al domicilio (demo)**. Aparece «Estás en la casa de…» con dirección y confirmación del cliente. Elegir **Está presente** para ver envases pendientes y equipos en préstamo/alquiler; después **Atender: entrega y cobro** permite indicar cuánto dejás y cuánto devuelve. La pantalla calcula y muestra los envases que quedan para la próxima visita.

Ejemplo: sin bidones pendientes, entregar 1 y retirar 0 deja 1 para devolver. En una visita posterior, entregar 2 y retirar el anterior deja 2. Este saldo es independiente del importe adeudado. Martín Acosta tiene un equipo de ejemplo en préstamo sin cargo; Café La Esquina, uno en alquiler.

Elegir **No está** para volver más tarde hoy, seleccionar una fecha o pasar a la próxima semana. La fecha se conserva en los pendientes sin registrar venta. En esta demo el día base es 19/10/2026, de modo que la próxima semana es 26/10/2026. Todavía no se genera automáticamente un nuevo reparto para esa fecha. La detección por GPS real está pendiente; la llegada actual es siempre simulada.

### Recuperación local

Se guardan el perfil ficticio, pantalla, reparto, cliente seleccionado, posición simulada y cantidades/devoluciones/alquileres/cobro/medio de pago de la atención todavía sin confirmar. Al reabrir la misma web en este navegador, la demo continúa directamente donde quedó. Para probarlo, cargar una cantidad y un pago parcial y recargar sin confirmar: debe recuperar el borrador. Confirmar la visita borra su borrador y evita repetirla al volver.

No hace falta volver a ingresar el código ficticio al recuperar una demo; no es una sesión autenticada real. «Salir de la demostración» quita el regreso automático pero conserva datos ficticios; «Reiniciar» limpia también borradores y posiciones. El navegador debe permitir y conservar almacenamiento local; si se elimina o se usa otro navegador/dispositivo, no habrá recuperación. No se guardan automáticamente borradores de formularios de alta o baja, solo de la atención al cliente.

### Tocar una parada y ver la cuadra

Tocar un marcador de cliente o una parada de la lista en el mapa abre directamente el panel **Clientes de esta cuadra**. Agrupa por cuadra/localidad; tocar un cliente del panel lo selecciona y centra. En el mapa general del jefe, tocar una parada abre el mapa de ese reparto con su cuadra.

El jefe tiene **Subir**, **Bajar**, **Agregar al reparto** y **Quitar del reparto** para paradas pendientes de repartos abiertos. Una visita resuelta queda protegida y conserva su historial. El asistente ve sus clientes asignados y no esos controles. Para probar un alta desde la cuadra, Paula Ferrer está en **Av. de Mayo 1220**, cerca de las tres paradas originales, y comienza fuera del reparto. Las demos guardadas reciben su dirección de ejemplo sin reiniciar ventas.

### Ubicaciones del equipo

Como jefe, pulsar **Ver asistentes en el mapa**, desde Mi jornada o Repartos y mapa. También está el apartado **Mapa del equipo**. Se muestran asistentes activos, sus repartos abiertos y las posiciones ficticias que hayan compartido al abrir su mapa. Los marcadores con iniciales representan asistentes y los números, clientes. Se puede filtrar, centrar a una persona o abrir su reparto.

Para probar: cambiar a Lucía → Abrir reparto → Simular avance. Cambiar al jefe y abrir el mapa del equipo: aparece el último punto de Lucía. Como se cerró la vista del asistente al cambiar de rol, figura pausado. También se puede abrir la misma URL en otra pestaña del **mismo navegador y origen** y mantener una vista por rol; los cambios de posición se replican por almacenamiento local. Las posiciones se actualizan al avanzar y se emite una señal cada 15 segundos mientras el mapa está abierto y la página visible; al ocultar/cerrar, se marca pausa, y si no llega actualización durante más de 45 segundos se indica señal antigua.

Si todavía no hay una posición emitida, aparece «Sin ubicación»; no se inventa una. El mapa del equipo necesita internet para las calles. Esta réplica local no comunica un teléfono con otra PC ni funciona entre navegadores distintos: el GPS y el servidor para ese caso quedan pendientes. No se solicita ubicación real y no se modificó Supabase.

**Prioridad principal: celular.** La vista móvil ofrece navegación inferior para Hoy, Mi ruta/Repartos, Clientes y Mi carga; el resto queda en el menú. Los controles de acción tienen un tamaño táctil mínimo de 44 px y los campos principales usan texto de 16 px. Se usan fuentes del sistema sin solicitar tipografías a un proveedor externo. Esta orientación sigue pendiente de una revisión visual y de rendimiento en teléfonos reales.

## Qué se puede probar

### Abrir el mapa desde la web

Entrar a la demo como Lucía o Santiago → **Repartos y mapa** → **Abrir mapa y ubicación demo**. También hay un botón sobre cada vista ilustrativa del recorrido y «Ver en el mapa» en las fichas con coordenadas.

El reparto de Lucía muestra a Elena Duarte en **Av. de Mayo 1200**, Café La Esquina en **Av. de Mayo 1250** y Martín Acosta en **Av. de Mayo 1280**, Monserrat, CABA. Son clientes ficticios con puntos aproximados cercanos. El botón **Mi ubicación (demo)** centra el punto azul y **Simular avance** lo mueve entre las paradas sin marcar visitas ni registrar ventas. Seleccionar una parada permite abrir su ficha.

El mapa de calles necesita internet. La biblioteca y la cartografía se cargan al abrir el mapa, no al iniciar toda la demo. Si falla el fondo se muestra un aviso y siguen disponibles los marcadores y la lista. La atribución de OpenStreetMap permanece visible. La ubicación es siempre simulada: no se solicita GPS. Las demos anteriores reciben estas tres direcciones sin borrar sus ventas.

Paleta actualizada: petróleo para navegación/bienvenida, turquesa para acciones principales, azul para cobros, violeta para alquileres y ámbar para pendientes. Los estados conservan sus textos y los textos secundarios tienen más presencia.

La demo mantiene barra lateral y disposición amplia para PC, y navegación inferior y controles táctiles para celular. Ambos formatos forman parte del producto; el celular tiene prioridad. La revisión visual en ambos dispositivos sigue pendiente.

| Apartado | Operaciones de la demo |
| --- | --- |
| Mi jornada | Ventas, cobros, visitas, clientes, equipo, siguiente parada, avisos y plano. |
| Repartos y mapa | Crear/asignar repartos, ordenar/agregar/quitar paradas pendientes, atender, marcar ausencia para después u otro día y registrar visita sin compra. |
| Clientes | Buscar por nombre/dirección/localidad, ver ficha, clientes autorizados de la misma cuadra, saldo, envases, alquileres e historial. Solicitar alta o baja; el jefe ve bajas aprobadas y puede reactivar. |
| Artículos y alquileres | Crear/editar artículos, presentaciones, precios, retornables y alquiler mensual de equipos. El asistente propone artículos para aprobación. |
| Atención al cliente | Entregar/retirar varios artículos, actualizar stock/envases, alta de alquiler, cuota del período de un equipo existente, venta/deuda/cobro separados, pago completo/parcial o a cuenta, efectivo/transferencia y calculadora de apoyo. |
| Carga y rendición | Iniciar carga descontando depósito, consultar llenos y vacíos por ubicación, declarar regreso, justificar diferencias, enviar al jefe, observar y aprobar. Crear/solicitar otro reparto del día después del cierre. |
| Mi equipo | Crear perfiles ficticios, asignarlos y desactivarlos si no tienen repartos activos por cerrar. |
| Aprobaciones | Aprobar/rechazar altas y bajas, revisar estado y devoluciones por equipo y acceder a las rendiciones. |
| Ventas y cobros | Filtrar por repartidor, historial de operaciones, deudas de cartera, vista previa de mensajes y exportación CSV de ventas ficticias. |
| Mi empresa | Cambiar nombre, localidad, iniciales o subir logo PNG/JPG local de hasta 1 MB; aparece arriba a la derecha. |

## Recorrido sugerido para revisar juntos

1. Entrar como **Lucía** con `123456`. Abrir «Repartos y mapa» y atender a **Elena Duarte**.
2. Dejar **3 bidones de 20 L** y retirar **2**. La venta es $10.500; con $4.800 anteriores, el total es $15.300. Ingresar un pago parcial de $10.000: quedan $5.300. Confirmar.
3. Verificar el stock del transporte, los vacíos y la ficha de Elena. Cambiar a **Santiago** para ver la misma visita, sus importes y el aviso al jefe.
4. Volver como Lucía y abrir **Café La Esquina**: tiene un equipo en alquiler. Probar el cargo del período, o solicitar su baja desde la ficha con motivo y devolución del equipo.
5. Cambiar a Santiago, revisar la solicitud y aprobarla. Con la regla de ejemplo, todos los equipos deben haber vuelto en buen estado. El cliente queda en «Clientes → Ver bajas» y puede reactivarse; la historia se conserva.
6. Como Lucía, solicitar un cliente nuevo o proponer un artículo. Como jefe, aprobarlo y comprobar que aparece en la cartera/catálogo.
7. Desde el jefe, agregar/quitar clientes pendientes al reparto activo, modificar el orden o crear otro para un asistente.
8. Resolver las paradas restantes del primer reparto; usar «Otro día» si no se visitarán hoy. Rendir, revisar y aprobar como jefe. Productos y vacíos retornan al depósito una única vez.
9. Crear otro reparto del mismo día, confirmar su carga y continuar. Las cargas y rendiciones quedan separadas.
10. Revisar «Ventas y cobros», exportar el CSV ficticio y personalizar «Mi empresa».

## Alcance y reglas provisorias

- Datos guardados bajo `hidrotrack.complete-demo.v1` en este navegador. «Reiniciar» pide confirmación y recupera los ejemplos. Si no hay espacio para guardar, se avisa que los cambios quedan en memoria.
- No se importó Supabase en los módulos de la demo, no se crean cuentas reales y ninguna operación modifica la base. El acceso conectado anterior se conserva fuera de la demo.
- Autenticador visual, perfiles intercambiables, avisos internos y seguimiento local **simulados**. El plano de resumen es ilustrativo y su botón abre un mapa de calles reales con posiciones ficticias. No hay cálculo de ruta vial, GPS, push, WhatsApp ni envío de mensajes. No se solicita ubicación.
- «Atendiendo» se actualiza al abrir la atención y «Último punto» al confirmar. Ambos muestran hora y etiqueta de simulación; no equivalen a un GPS real.
- El jefe ve la cartera completa; el asistente ve clientes activos de sus repartos y sus operaciones. Es una demostración de interfaz, no una frontera de seguridad: todos los datos ficticios están en el navegador.
- El alquiler del ejemplo es mensual: entregar un equipo registra su unidad y primera cuota. Un equipo existente permite registrar su cuota una sola vez en el período demo. No hay calendario de contratos ni facturación recurrente real.
- La baja exige equipos devueltos en buen estado. Los daños y faltantes impiden aprobar y deben revisarse; la política definitiva sigue abierta. La deuda y los envases pendientes no se borran.
- Un cajón de seis y un sifón suelto son presentaciones independientes; no hay conversión automática ni movimiento de desarme.
- Una rendición con diferencias se puede enviar con observación, pero requiere revisión para aprobar. Para iniciar otro reparto del mismo conductor se debe cerrar y aprobar el anterior. Son reglas de la demo, pendientes de validación comercial.
- Los informes usan este día ficticio; no se inventa una historia mensual ni se implementó el ranking propuesto en la referencia.

## Validación de esta entrega

`npm test`: 109 pruebas aprobadas, incluidas operaciones, mapas, recuperación, envases, reprogramación, réplica al jefe y panel de cuadra con orden/agregar/quitar y restricciones del asistente. `npm run build`: compilación de producción aprobada. La carga real de la cartografía y la revisión visual en navegador/dispositivos reales quedan pendientes.

Esta entrega permite evaluar el programa completo por partes. Cada parte que pase a producción necesitará su esquema, permisos y validación reales.

### Iniciar reparto y consultar el camión

Un reparto planificado muestra **Iniciar reparto**: ingresá la carga y pulsá **Confirmar carga e iniciar**. Se abre Mi reparto y la carga queda bloqueada sin recargas ni edición; cerrar y reabrir conserva ese estado. **Stock del camión**, desde Mi reparto, muestra carga inicial, unidades disponibles y vacíos recuperados. Cada entrega confirmada actualiza el stock y el **Total del camión · entregas realizadas** a su precio registrado. El cobrado se informa por separado; el total de entregas excluye cuotas de alquiler de equipos instalados anteriormente.

La Lucía inicial ya tiene un reparto activo con carga confirmada. Para probar el inicio desde cero, el jefe puede crear un reparto para un asistente sin reparto activo, cambiar al asistente y pulsar Iniciar reparto. Para Lucía, finalizar/rendir, obtener aprobación y solicitar el siguiente; cada nuevo reparto permite una única carga independiente. La confirmación de cierre no habilita modificar la carga anterior. Todo se guarda en la demo local; no modifica Supabase. Validación visual en teléfonos y PC reales pendiente.

### Base real de stock

Desde el 19/10/2026 hay una base de stock aplicada en Supabase. Sus funciones y saldos están documentados en [STOCK.md](STOCK.md). Esta demostración sigue usando datos locales: no carga ni consulta inventario real. Catálogo/ingreso del depósito ya están conectados en el acceso real del jefe; falta validar con su cuenta provisionada.

### Deuda autorizada por el jefe

La ficha muestra **Estado de cuenta**: deuda aprobada o **Al día · no debe nada**, más solicitudes pendientes o créditos rechazados por separado. La lista de la cuadra se mantiene en el mapa y fue retirada de la ficha.

Para probar: como Lucía, atender Elena, entregar 1 bidón de 20 L y poner que paga $1.000. La entrega cuesta $3.500: se solicita autorización por $2.500 y se conservan $4.800 de deuda anterior aprobada. Confirmar visita descuenta stock y registra el cobro sin sumar aún esos $2.500 al saldo. Cambiar al jefe, abrir notificaciones → **Revisar solicitudes de deuda** → **Sí, aprobar deuda**. Elena pasa a deber $7.300, sin duplicar entregas ni cobros. La aprobación y el saldo persisten al reabrir.

El pago se aplica primero a lo vendido hoy y el excedente a deuda anterior; esta elección provisional se explica en pantalla. Pagar lo de hoy dejando deuda anterior no vuelve a solicitar autorización. El jefe autoriza directamente si él mismo confirma una visita a crédito. Rechazar conserva el faltante visible como **Pendiente de cobro**, sin incorporarlo a la deuda aprobada ni borrar movimientos. Registrar su cobro posterior queda pendiente de una siguiente parte. Las operaciones antiguas de la demo conservan su saldo previo; no se reabren ni solicitan retroactivamente. Todo este flujo es local de demo: todavía no hay cuentas corrientes, aprobación de deuda ni notificaciones push conectadas a Supabase.

### Celestes y señalización de bajas

Tarjetas de paradas y cuenta en celeste; deuda con naranja suave. Se corrigió una colisión del estilo global pending que oscurecía las paradas. Al aprobar una baja, se guarda fecha/motivo y aparece un recuadro rojo en los repartos de ese día y en la ficha/archivo del jefe. El aviso de baja no permite atender ni vuelve a incorporar al cliente al recorrido. Para la demo, el día operativo es 19/10/2026. Bajas anteriores sin fecha dicen fecha sin registrar. La baja requiere aprobación; una solicitud todavía pendiente no se pinta como baja definitiva. Revisión visual en teléfonos/PC reales pendiente.

### Parque de envases y recargas

Como jefe, abrir Carga y rendición → Tu parque de envases. Muestra total propio y distribución entre depósito, camión y clientes. Registrar recarga demo transforma vacíos del depósito en llenos conservando el total. La ficha de Estudio Robles, en una demo nueva, incluye equipo del cliente: no se devuelve al reparto al aprobar la baja. Las demos guardadas conservan sus equipos anteriores.

En el acceso con cuenta real existe ahora Stock y dispenser: catálogo, inventario inicial, recargas, camión y equipos. Esa pantalla usa Supabase; la demostración sigue guardando únicamente datos ficticios locales. Se requiere empresa, usuario owner y licencia vigente para abrir el espacio conectado. El primer jefe ya tiene cuenta real; debe usar Ingresar a mi cuenta, no el acceso ficticio de esta demo. Ver [datos para el inicio](DATOS_INICIALES.md).

La cuenta real comparte ahora la estructura visual y paleta de la demo, con Mi jornada y accesos a clientes, catálogo, inventario, repartos y dispenser conectados. Los datos ficticios permanecen exclusivos de la demostración.

Catálogo real: tarjetas de artículos y precios. Stock: conteo de depósito, clientes y total en camiones; apertura de vacíos seleccionada inicialmente. Repartos: preparación y detalle del camión. El campo unidad del catálogo describe la venta (unidad, cajón), no carga cantidades. Para 600 bidones vacíos, registrar 600 en Cantidad del inventario inicial de vacíos.

En Repartos, Carga de camión lista los artículos del catálogo: completá cantidades y pulsá Registrar carga. Todos se registran en una operación y la carga queda bloqueada por reparto. La demo muestra la misma lista con datos ficticios. En Stock, Cargar stock del depósito permite cargar varias cantidades y Registrar stock; rellenar vacíos sigue siendo un movimiento del depósito. Equipos individualizados permanecen en Dispenser.

Clientes reales: Abrir ficha (o tocar el nombre), Editar y Eliminar. Eliminar confirma la baja de activos conservando el historial. Desde la ficha, Registrar bidones que ya tiene carga el conteo inicial anterior a HidroTrack; no usarlo para envases ya contados en depósito o entregas. Asignar dispenser permite seleccionar un equipo del depósito previamente registrado y elegir préstamo/alquiler. La ficha muestra envases y equipos actuales y movimientos del cliente. La demo también permite editar datos desde su ficha conservando envases, deuda y equipos.

Como jefe, Carga y rendición → Retirar stock o registrar rotura. Elegir artículo, cantidad, ubicación, fecha, persona involucrada y motivo. Descuenta del lugar elegido y conserva un historial ficticio, sin modificar deuda. El registro real equivalente y las fechas editables requieren aplicar la migración de incidentes; la web avisa y no simula guardados si todavía no existe. Los modelos dispenser aparecen en su sección conservando sus registros; la unidad de venta nunca se convierte en existencias.

Botones secundarios reforzados en demo y cuenta real: fondo celeste y borde visibles sin pasar el puntero, foco de teclado y tamaño táctil. Acciones principales turquesa y eliminación en rojo suave.

Acceso actualizado: Clientes → Planilla. En la cuenta real, Editar datos y Archivar cliente se encuentran dentro de la planilla del jefe; el archivo requiere confirmación y conserva historial. La demo muestra Planilla y el jefe inicia la baja desde Archivar cliente; el asistente conserva Solicitar baja y la aprobación del jefe.

Catálogo: unidades activas destacadas, depósito/camión/clientes debajo y precio al pie. Demo usa sus cantidades ficticias y excluye equipos que pertenecen al cliente. Las tarjetas reales usan existencias registradas en el libro; no convierten el campo Unidad en stock.

En la planilla demo se informa qué dispenser quedan disponibles en el reparto del cliente; Atender cliente permite asignarlos usando ese stock. La planilla real prepara además asignación directa por modelo desde depósito/camión y devolución desde la ficha, sin volver a cargar equipos; requiere aplicar ambas migraciones pendientes de incidentes y asignaciones. No confundir la preparación local con activación remota.

Eliminar artículo/modelo: disponible para el jefe en tarjetas demo y reales y en Stock de bidones. Retira de activos con confirmación conservando historial; con unidades pendientes muestra que deben resolverse primero. En la demo se conserva el registro ficticio; en cuenta real se actualiza active=false. La protección atómica de servidor requiere además la tercera migración pendiente, product_archive_guard.

Cuenta real: el bloqueo de Eliminar con unidades muestra un aviso inmediato. El reinicio administrativo autorizado está preparado y probado localmente; no se ejecutó en Supabase por falta de conexión MCP autenticada.

Actualización 19/10: MCP conectado y proyecto verificado. Limpieza remota sin ejecutar porque existe un reparto pendiente de rendición; resolverlo antes del reinicio. Migraciones adicionales pendientes.

Resultado remoto 19/10: reinicio ejecutado por MCP en una sola empresa y transacción. Eliminado el reparto de prueba autorizado. Verificados cero artículos, equipos, movimientos y repartos; conservados cliente, cuenta Auth, miembros y licencia mediante comparación dentro de la transacción. Las tres migraciones adicionales siguen pendientes; esta limpieza no las aplica.

## Demo anterior recuperada

En el panel `/?demo=admin`, pulsar Ver historial de accesos. Luego pausar o reactivar al chofer de ejemplo desde Usuarios: aparece la acción con empresa, persona, administrador ficticio y hora argentina. El historial de ejemplo corresponde a esta sesión y se limpia al recargar o restablecer demo; no contiene eventos reales.

Panel del propietario de plataforma: abrir `/?demo=admin`. Incluye Resumen, Usuarios con búsqueda/filtros y Empresas y licencias con altas y edición. En Usuarios, pausar y reactivar al chofer del Norte cambia su estado con confirmación conservando sus datos; al reactivar se verifica licencia y cupo. El titular no muestra esa acción. Todo se realiza con ejemplos locales. Para administrar cuentas reales se requiere ingresar con una cuenta verificada como administrador; la vista previa no otorga ese permiso. La gestión individual requiere además la migración `20261020131006_admin_member_access.sql`, pendiente de aplicación remota.

La web abre el acceso real por defecto, aunque exista una jornada de demo guardada. Para continuar la simulación, elegir Explorar demostración o abrir `/?demo=1`; el progreso se recupera dentro de la demo. Salir vuelve al acceso real y retira `demo` de la URL sin borrar los datos ficticios. Las funciones de demo sin equivalente conectado comprobado siguen disponibles.

Siguiente paso del proyecto: [cierre de inventario](CIERRE_INVENTARIO.md). Diagnóstico previo preparado y probado localmente; las tres migraciones adicionales siguen sin confirmación remota en esta sesión.
La demo integral sigue en /?demo=1. Para revisar los mapas, recorridos diarios y equipos de clientes de la copia local anterior, abrir /?demo=legacy. Sus datos permanecen separados en el navegador; no se sincronizan con la demo integral ni con Supabase.

## Base principal instalada el 20/10/2026

17 migraciones y 29 tablas con RLS verificadas por MCP. Inventario/roturas/asignaciones y administración actualizados; ventas, cobros, deuda, alquiler mensual, recorridos, futura baja y rendición preparados en servidor. 177 pruebas de dominio, PostgreSQL e interfaz, build y verificadores remotos correctos. Sin datos comerciales ficticios en remoto. Detalle y límites: [BASE_DE_DATOS.md](BASE_DE_DATOS.md). Concurrencia multiconexión, prueba Auth/PostgREST de nuevos flujos y revisión visual móvil/PC pendientes.

Resultado 20/10: selector explícito Vacíos/Llenos al ingresar stock, conservando la cantidad al cambiar estado. Repartos ofrece rellenar los vacíos que falten para la carga; usa primero llenos y confirma recarga+carga en una transacción con IDs estables. Implementado en acceso real del jefe y demo; nueva RPC instalada por MCP como 20261020135912_fill_and_load. 184 pruebas y verificación remota correctas; 18 migraciones, 30 tablas con RLS. No se cargaron unidades remotas de prueba. Revisión visual pendiente: inventario de automatización sin apps ni navegadores expuestos. Prueba completa Auth/PostgREST de la pantalla pendiente.

Resultado 20/10: Catálogo unificado en web real y demo, sin menú separado Dispenser. Arriba Agregar dispenser y Agregar producto; inventario combinado debajo y Retirar producto o dispenser al final. Conserva entradas de stock y gestión individual por serie. Corrección de alta elimina de activos y retira stock solo del depósito de forma auditada/atómica; rechaza unidades en camiones o clientes. Equipos individuales del depósito se retiran por alta errónea sin fingir rotura. Tipo explícito al crear, independiente del nombre. Migración 20261020141330_unified_catalog aplicada y verificador remoto correcto. 193 pruebas aprobadas; 19 migraciones, 31 tablas con RLS. Sin alterar cantidades ni registros comerciales reales en esta tarea. Revisión visual móvil/PC y prueba Auth/PostgREST del flujo completo pendientes.


## 20/10/2026 - Cuenta propia y equipo de asistentes

En el acceso de la demo: Crear mi cuenta de asistente, usando datos ficticios. Ingresa directamente a En espera de recorrido y conserva esa pantalla al recargar, sin modulos comerciales. Cambiar rol es solo herramienta de demostracion.

Como jefe: Mi equipo > Agregar asistente o empleado; usar sofia@example.com, o la cuenta ficticia creada antes. Asignar recorrido abre el formulario con esa persona seleccionada. Volver a su rol muestra el recorrido. Al aprobar su ultimo cierre vuelve a espera. Quitar del equipo exige resolver recorridos abiertos y conserva cuenta e historial; luego puede volver a agregarse con el mismo correo.

Selector de licencia ficticia: basica 1, intermedia 3 (ejemplo inicial), superior ilimitados. No cobra ni modifica licencias reales. Lucia tiene ademas un vinculo ficticio con otra empresa, que se conserva al quitarla de este jefe; no hay un segundo espacio comercial navegable ni recorridos remotos multiempresa en esta demo. Registro Auth y permisos de produccion pendientes.


## 20/10/2026 - Costo opcional de llenado

Como jefe: Mi empresa > Configuracion de llenado > Controlar costo de llenado y ganancia estimada. Desactivada por defecto. En Catalogo > Editar producto, tildar Este producto tiene costo de llenado e ingresar costo unitario separado del precio de venta. Solo envases retornables de venta; no dispenser.

Para probar: preparar un reparto con faltante de llenos, habilitar Rellenar los vacios que falten y cargar. Se previsualizan cantidad y costo de los que se rellenan, no de los llenos ya disponibles. Ejemplo: cargar 5, deposito 2 llenos, costo $100: se rellenan 3, costo $300, resultado inicial -$300. Stock del camion e informe del jefe muestran vendido, costo y resultado estimado. Cobros y deuda previa no se confunden con venta.

Los costos de la carga quedan congelados; cambiar precio o desactivar opcion no cambia historia. Repartos anteriores sin registro no calculan retroactivamente. Simulacion local, sin base remota ni margen contable completo: excluye combustible, salarios, recargas previas y otros gastos.


## 20/10/2026 - Ubicacion, ficha y visitas especiales

Nuevo/Editar cliente: direccion escrita mas Ubicar en el mapa, Usar posicion actual (GPS del navegador solo al tocar y aceptar permiso), o coordenadas manuales. El mapa carga al abrirlo, necesita internet y no geocodifica direcciones. En demo hay Usar ubicacion de ejemplo para no necesitar GPS. Este permiso puntual no activa seguimiento de choferes; el mapa de recorrido sigue simulado. La fecha de alta de clientes nuevos es el dia ficticio; copias antiguas sin fecha no la inventan. Ficha muestra coordenadas, pedido habitual y dias semanales.

En ficha del jefe: Generar visita adicional, elegir fecha, producto y cantidad. Asignar a un reparto abierto de esa fecha que no incluya al cliente. Si no existe, crear uno desde Repartos y mapa (incluye fecha). No cambia rutina semanal, carga ni stock; al atender queda el registro.

Devolucion parcial existente verificada: tenia 2, devuelve 1 sin recibir nuevos, queda 1 pendiente; si ademas recibe otro, quedan 2. Cambiar dispenser desde Atender cliente: elegir equipo del cliente, reemplazo disponible y estado del retirado. Conserva contrato/modalidad/cuota, no cobra nueva cuota automaticamente, descuenta reemplazo del camion y registra retirado separado. Al aprobar cierre, bueno vuelve al deposito y danado queda en revision. No hay reparacion/reingreso desde revision implementada por esta idea.

Conectado real: selector mapa/GPS, guardado de coordenadas en clientes y lectura de fecha de alta en planilla, usando columnas existentes. Dias, pedido habitual, visitas extras y reemplazos corresponden a esta demo; sus pantallas y contratos remotos completos siguen pendientes. No se cargaron datos de prueba en Supabase. Validacion visual y permiso GPS en dispositivos reales pendientes.


## 20/10/2026 - Carga del recorrido mas extras

En Nuevo/Editar cliente, guardar cantidades habituales por producto; el texto descriptivo no se interpreta automaticamente. Los ejemplos iniciales incluyen cantidades; copias viejas sin ellas muestran aviso para completar la ficha o reiniciar demo.

Crear reparto suma cantidades de los clientes seleccionados y permite indicar dispenser previstos para entregar/cambiar. La sugerencia se ve durante la seleccion y en el recorrido preparado. Dispenser ya instalados no se suman como equipos nuevos. Pedidos de visitas extraordinarias reemplazan el habitual para esa parada. Clientes en futura baja no suman entregas.

Iniciar reparto: cada articulo separa Para el recorrido y Carga extra. Total es la suma; se puede ajustar la cantidad prevista, siempre sujeto a disponibilidad. Confirmar una sola vez guarda carga completa, sugerencia y desglose. El stock del camion muestra lo previsto y lo extra, que puede entregarse luego a nuevos clientes autorizados agregados al recorrido. No habilita segunda carga ni permite editar una carga confirmada. El costo opcional de llenado incluye solo lo que se rellena para el total real, tambien extras. Sin cambios remotos; sugerencias/desglose pendientes de integracion real.


## 20/10/2026 - Tablero, repartos activos y comprobantes

Mi jornada del jefe: graficos de ganancia estimada y gastos del mes, semana por dia, mejor dia, ganancia diaria y bidones llenos/vacios/en clientes. Gastos disponibles: solo llenado historico. Si un reparto con actividad no tiene costos, no muestra ganancia completa ni inventa mejor dia. No equivale a caja ni a ganancia neta contable. Repartos fechados y ventas registradas se agrupan por fecha del reparto (dia ficticio por defecto).

Debajo del banner aparecen tarjetas de repartos por salir, en recorrido y rendidos, con entregados/total, nuevas altas de ese dia entre sus paradas y paradas resueltas. Devolver envases, cobrar deuda o reprogramar ausencia no se cuenta como entrega. Numeracion estable segun recorrido. Actualiza al confirmar operaciones y al sincronizar otra pestana del mismo navegador; no es Realtime entre dispositivos reales.

Finalizar reparto del jefe abre conteo; exige paradas resueltas y cantidades conciliadas. Genera snapshot inmutable del cierre. El asistente sigue pudiendo enviar rendicion y esperar aprobacion. Tras aprobar, Comprobantes de cierre ofrece PDF del jefe o del asistente segun rol. Actualizacion 21/10: sin reparto asignado solo perfil personal, ID y nombres de jefes; se retiran tambien los comprobantes de esa pantalla por indicacion del usuario. Los snapshots se conservan, pero no se muestran en espera.

Ambos PDF incluyen carga inicial/final, efectivo a rendir y dispenser nuevos/cambiados/retirados con estado. Jefe agrega ventas, efectivo y transferencia. Efectivo incluye cobro de deuda anterior; no descuenta gastos pagados por asistente ni confirma recepcion fisica de dinero. No se envian correos/mensajes. Nombres, precios y cantidades del cierre no cambian por editar luego el catalogo. Copias antiguas sin snapshot no se reconstruyen como historia confirmada.

Implementado en demo; tablero/cierre/PDF conectados de produccion pendientes. PDF de muestra ficticio en output/pdf/cierre-reparto-demo.pdf, generado por prueba y excluido de Git; render revisado en PNG, incluyendo caso extenso de 10 paginas. Fuente generadora y pruebas versionadas. Revision visual de la interfaz en movil/PC pendiente.


20/10: correccion en ficha REAL del cliente para catalogo sin unidades. Mensaje explicito, boton Registrar unidades de dispenser (solo existencias aun no contadas), Actualizar disponibilidad y bloqueo de asignacion vacia. No se ingresaron cantidades remotas ni se duplicaron equipos. El alta de catalogo por si sola sigue sin crear inventario; en demo las cantidades se ingresan en su campo de stock.


20/10: formulario REAL de Catalogo ofrece Cantidad inicial en stock, fecha y estado de envases. Dispenser nuevo queda disponible al confirmar junto al modelo. Guardar con cero solo crea catalogo. Selector REAL actualiza disponibilidad al abrir Asignar dispenser; no pide registrar equipos ya existentes. RPC atomica instalada en Supabase. Diagnostico MCP anterior de stock cero fue incorrecto por vista filtrada sin identidad; registro duplicado compensado y saldos verificados. No se cambiaron precios ni asignaciones existentes. Demo ya permite alta con cantidad en deposito; conserva separacion de datos ficticios.
# Promociones en prueba

**Cuenta real del jefe:** ya existe Promociones en el menú lateral (en celular, Abrir navegación). Usa Supabase para permisos de asistentes, avisos internos, registro con cantidades/fechas, conversión y recuperación. La demo continúa siendo local. El chofer real todavía espera la conexión de su pantalla de recorrido; habilitar el permiso no reemplaza esa pantalla. No se envían push externos. Actualizar promociones consulta los avisos nuevos.

Permisos actualizados: en **Mi equipo**, el jefe marca **Permitir ofrecer promociones** para cada asistente. Por defecto nadie está habilitado; puede revocarlo. El asistente habilitado y con recorrido activo ve Promociones, entrega desde su propio camión y ve solo las que ofreció. Cada entrega notifica al jefe con asistente, persona, artículos, condiciones y próxima visita. Conversión, recuperación y cierre siguen a cargo del jefe. Quitar el vínculo también revoca el permiso. No hay notificaciones externas. El contrato de permisos y avisos ya esta instalado en Supabase; esta pantalla sigue siendo simulacion local hasta conectarla.

En `/?demo=1`, entrar como jefe y abrir **Promociones** desde el menú (en celular, Abrir navegación). Crear una persona con condiciones y precio escritos, próxima visita y cantidades a entregar desde depósito. No figura en Clientes durante la prueba.

Al aceptar pasa a Clientes con sus envases y equipos, sin segunda salida de stock; se puede indicar cuota mensual por modelo de equipo (0 = préstamo gratuito). No se registra cobro ni deuda automática. Al rechazar queda pendiente de recuperación, permite devoluciones parciales y roturas; solo cierra cuando recuperó todo. Historial conservado y stock en promociones visible en catálogo; dañados en revisión.

Simulación local: la entrega del asistente descuenta su camión activo; la del jefe descuenta depósito. Seguimiento posterior en el mapa, detalle específico de promociones en PDF, facturación y Supabase pendientes. Fechas de operaciones siguen el día ficticio de la demo. Configurar hábitos y visitas después de convertir.
## Abrir el recorrido en una app del celular (21/10)

En `/?demo=1`, abrir Mi reparto o el mapa de un reparto. Seleccionar una parada y tocar **Abrir navegacion**: elegir Google Maps o Waze para esa persona. **Ver recorrido pendiente en app** muestra enlace a todas las pendientes en Google Maps, manteniendo el orden; recorridos largos se dividen en tramos numerados de hasta cuatro paradas. Al terminar un tramo, volver a HidroTrack y abrir el siguiente. Registrar visitas en HidroTrack; ninguna app confirma entregas automaticamente.

Los destinos de la demo son ficticios. La app parte desde la ubicacion real del telefono, nunca desde el marcador simulado. Sin coordenadas, Maps usa la direccion escrita y Waze abre su busqueda. Revisar la direccion elegida antes de iniciar. Si falta toda ubicacion, se explica el error sin omitir esa parada. En PC o si no abre una app instalada, el enlace puede mostrar la web del servicio.

La planilla real del jefe tambien ofrece **Abrir navegacion** hacia ese cliente. No se agregaron mapas reales de recorridos del asistente ni se modifico Supabase. Apertura en Android/iPhone y revision visual manual pendientes.

## 21/10 - ID y perfil independiente

Entrar como asistente sin reparto (por ejemplo Sofia) para ver Mi perfil: ID personal copiable, nombre editable, foto local PNG/JPG/WebP hasta 250 KB y opcion de contrasena simulada, sin guardar claves ni modificar Auth. Jefes vinculados solo muestra nombres. Sin cartera, recorridos ni PDFs mientras espera. Con reparto, Mi perfil y opciones sigue disponible.

Como jefe, Mi equipo > Agregar asistente o empleado acepta el ID mostrado por el asistente (tambien correo por compatibilidad). Lo conserva en lista para asignar futuras jornadas; desvincular conserva identidad, ID, perfil e historial. Los IDs HT de esta demo son ejemplos, no credenciales reales. Pantalla y vinculacion por ID reales pendientes; no se cambiaron las cuentas de prueba ya creadas.
## Aceptar un reparto (21/10)

Crear un reparto para un asistente desde Mi equipo/Repartos. Al cambiar a su cuenta, se ve invitacion del jefe con Aceptar reparto o Rechazar reparto, sin los clientes ni la ruta. Aceptar habilita ese reparto; rechazar/no responder mantiene privacidad. El jefe recibe respuesta en notificaciones. Invitaciones nuevas tambien aparecen si ya tiene otro reparto aceptado. Los repartos iniciales de ejemplo representan asignaciones previamente aceptadas. Esta aceptacion todavia no esta conectada al servidor real.
## Perfil real y perfil simulado (21/10)

Ingresar con cuenta real de asistente muestra ahora pantalla personal con nombre editable, ID copiable y cambio de contrasena real mediante Auth. No muestra datos comerciales; la vinculacion por ID, fotos privadas e invitaciones reales aun estan pendientes. Las cuentas Auth sin jefe activo tambien conservan su perfil basico. La demo mantiene foto local y cambio de clave simulado; no confundir su formulario con la cuenta real. No se modificaron las credenciales de prueba durante el desarrollo de esta pantalla.
## Actualizacion 22/10: invitaciones reales

Invitacion/respuesta/revocacion y resumen limitado del recorrido aceptado conectados a Supabase. La demo mantiene sus datos locales y circuito simulado. No confundir el resumen real con entregas/cobros/mapa operativo terminados. Detalle: [etapa 2](ETAPA_2_INVITACIONES.md).

## 24/10 - Carga sugerida conectada

La seccion real Repartos y camion calcula referencia desde cantidades habituales y permite extras/faltantes. La demo mantiene su propia simulacion y no sirve de comprobacion de stock real. Sin snapshot historico separado de sugerencia/extras aun.

Visitas extraordinarias 24/10: planilla y lista reales conectadas a nuevas solicitudes de Supabase; demo independiente. Asignar es organizar la visita, no completar entrega ni cobro. Ver ETAPA_3_PREPARACION.md.

## Cambio real de dispenser por modelo - 24/10/2026

Migracion `20261024140721_dispenser_exchange.sql` aplicada por MCP. Estado comprobado: 26 migraciones y 40 tablas publicas con RLS. Desde la planilla del cliente, Cambiar dispenser registra retiro y reemplazo en una transaccion, desde deposito o camion activo autorizado. Conserva contrato, modalidad, cuota y fecha inicial del alquiler. El retirado bueno vuelve al origen; roto significa baja definitiva del inventario activo, con fecha y responsable. No representa reparacion recuperable.

Reintentos idempotentes, disponibilidad previa al retiro y fechas coherentes; fallo revierte ambos movimientos. Historial de cambios visible al jefe. Equipos individualizados por serie y reparaciones siguen pendientes. Rama operativa del asistente permanece bloqueada hasta etapa 4. Sin cambios con stock real para probar ni ajustes de cuentas/claves.

Verificacion: 25 comprobaciones dirigidas de contratos y permisos y 2 del formulario aprobadas; compilacion correcta. MCP confirma cero cambios reales de dispenser, sin escritura directa ni ejecucion anonima. Suite general, prueba visual movil/PC y despliegue publico pendientes.

## Costo y detalle historico de carga real - 24/10/2026

Migracion `20261024183740_load_cost_snapshots.sql` aplicada por MCP: 27 migraciones y 42 tablas publicas con RLS. Nuevas tablas filling_cost_settings e inventory_load_snapshots, solo lectura del jefe de su empresa; escritura mediante RPC, sin acceso anonimo. No se modificaron cuentas ni existencias reales para comprobar; ambas tablas quedaron sin registros reales al verificar.

En Catalogo, Configuracion del costo de llenado permite activar el control y seleccionar productos retornables con costo por unidad, independiente del precio de venta. Desactivado por defecto; no aplica a dispenser. En carga se anticipa el gasto parcial solo del faltante a rellenar. Al confirmar, inventory_confirm_load registra carga y detalle juntos: nombres, sugerencia calculada en servidor, cantidades cargadas, extras/faltantes, rellenados y costo vigente. Pedido extraordinario reemplaza habitual sin doble suma. Si falla, no queda relleno o carga parcial; reintentar conserva el resultado original.

Repartos muestra las ultimas diez cargas con detalle historico. Cambiar nombre, preferencias o costos despues no altera ese registro. Las cargas anteriores o hechas mediante contratos antiguos no se reconstruyen: pueden existir sin este detalle. Costo desactivado o producto sin costo no significa ganancia conocida; el total solo incluye llenado configurado y excluye otros gastos. Graficos y resultado real del reparto siguen pendientes del circuito de ventas/cobros.

Verificacion: 30 contratos/permisos, 2 controles de configuracion/historial y 4 de sugerencia/preview aprobados (36 en total); compilacion correcta. Suite general y QA visual/publicacion movil-PC pendientes. Siguiente paso: circuito operativo real del asistente con permisos por reparto aceptado, entrega/devolucion y cobro; conservar pendientes de equipos por serie y reparacion.

## Apertura real del recorrido del asistente - 24/10/2026

Migracion `20261024184611_assistant_trip_stock.sql` aplicada por MCP. Estado: 28 migraciones y 42 tablas publicas con RLS. Extiende solo assistant_open_trip: lectura de clientes activos, posiciones, estados de parada y stock agregado del camion del reparto aceptado vigente. No devuelve deposito, otros camiones, precios/costos ni cartera general. No se habilita helper global driver ni escrituras operativas. Revocar, cerrar o suspender licencia impide consultar; lectura anonima bloqueada. Sin cambios de datos comerciales, cuentas o posiciones reales para comprobar.

Pantalla real del asistente: Abrir reparto, stock del camion, contador de entregas y selector de parada; mapa de pines y navegacion externa por destino o recorrido pendiente. GPS real solo por boton, con precision y manejo de error, sin compartirlo con el jefe en este avance. No hay deteccion automatica de llegada ni optimizacion de rutas. El mapa se carga al abrirlo.

Retoma reparto/parada guardando solo IDs por cuenta en navegador. No guarda nombres, direcciones, existencias ni coordenadas; al abrir consulta y verifica servidor. Error de lectura oculta la informacion, revocacion elimina el puntero al comprobar invitaciones. Los datos en pantalla se actualizan cada 30 segundos con pagina visible y al recuperar foco; no es una suscripcion en tiempo real ni modo offline.

Verificacion: 31 controles de contratos/permisos y 6 de invitaciones/pantalla aprobados (37), compilacion correcta. Prueba visual movil-PC pendiente: Chrome fue detectado, pero Computer Use se detuvo por no poder verificar su URL con suficiente confianza para aplicar la politica. Se retiro el archivo temporal de revision. No se verifico despliegue publico. Siguiente: entrega/devolucion parcial, cobro y deuda mediante operaciones atomicas autorizadas por reparto; carga inicial del asistente y GPS compartido siguen pendientes.

## Atencion real, devolucion parcial y cobro - 24/10/2026

Migracion `20261024185546_assistant_delivery.sql` aplicada por MCP: 29 migraciones y 43 tablas publicas con RLS. Nueva assistant_delivery_receipts, lectura exclusiva del jefe y sin escritura directa. assistant_customer_visit y assistant_deliver verifican destinatario, aceptacion vigente, licencia, empresa, reparto activo y parada activa. No se reabre has_role driver ni las operaciones antiguas. Sin datos comerciales, stock, cuentas o posiciones reales modificados para comprobar; cero recibos reales al verificar.

Desde Abrir reparto > Atender cliente: saldo real del cliente (incluye importes rechazados aun pendientes), envases que tiene, equipos y productos del camion. Entrega y devolucion parcial dejan para la proxima visita los envases no recuperados. Confirmar registra movimientos, cargo, pago declarado en efectivo/transferencia, deuda restante y avisos internos al jefe juntos. El servidor valida precio total esperado, version de parada, stock disponible, enteros y limites; no acepta mas cobro que esa entrega. Una futura baja admite solo retorno de envases. Los dispenser se muestran, pero no se cambian desde este formulario.

Recibo e ID estable evitan duplicar entrega/pago. Ante respuesta desconocida se bloquean cantidades y cambio de parada y se permite reintentar el mismo comando. Rechazo SQL pide actualizar planilla. Seleccion inicial queda fijada, para no saltar a otro cliente por una actualizacion mientras falta confirmar la respuesta. La parada queda resuelta incluso si solo recupera envases; contador se presenta como Atendidos, sin confundirlo con unidades vendidas.

En Repartos y camion del jefe: Deudas para aprobar, primeras 20 pendientes y cantidad total; aprobar/rechazar con nota usa commerce_review_credit existente. Al resolver aparecen las siguientes. Rechazar no borra cargo ni carga la deuda al asistente. Lista se actualiza cada 30 segundos visible/al foco; avisos guardados en base, sin push del sistema ni correos. Transferencia declarada no verifica acreditacion bancaria.

Verificacion: 38 contratos/permisos, 3 pruebas de formulario/deuda y 7 de invitaciones/continuidad aprobados (48 en total). Compilacion correcta. Suite general, QA visual movil-PC y despliegue publico pendientes. Siguiente: ausencia y reprogramacion, cobros de saldos anteriores, alta de clientes en recorrido; aun pendientes carga inicial del asistente, dispenser operativo, seguimiento compartido, rendicion/PDF y circuito completo entre dispositivos. Pedido extraordinario asignado aun no cambia a estado atendido automaticamente.

## Ausencias y cobros anteriores reales - 24/10/2026

Migracion `20261024190247_assistant_followups_payments.sql` aplicada por MCP: 30 migraciones y 44 tablas publicas con RLS. Nuevas funciones assistant_record_visit, assistant_customer_debts y assistant_collect_debt; assistant_payment_receipts guarda confirmaciones de cobro con lectura del jefe y sin escritura directa. No abre has_role driver ni contratos antiguos. Verificacion remota: anonimo sin acceso, cero recibos de cobro reales; sin operaciones comerciales, cuentas, stock o posiciones reales usados para probar.

En planilla del asistente: No esta / no compro. Ausente permite mas tarde hoy o fecha futura; guarda evento, version y pendiente sin crear venta ni cambiar stock. No compro resuelve parada sin reprogramar. Pendientes de visita se muestran en el recorrido con seleccion rapida. Fecha de hoy se calcula en Buenos Aires. Reintento conserva ID y resultado; version desactualizada pide revisar planilla. La fecha futura no crea otro reparto ni reasigna automaticamente; bandeja global del jefe entre recorridos aun pendiente.

Cobrar saldo pendiente consulta hasta 20 cargos del cliente asignado, con cantidad total y saldo completo; despues de cobrarlos/actualizar aparecen los siguientes. Incluye entregas, alquileres y apertura, tambien deuda rechazada. Seleccion de cargo, importe parcial/total y efectivo/transferencia declarados. Se guarda pago asociado al reparto de cobro, sin nueva venta ni movimiento de stock ni marcar entrega. Si otro pago cambio el saldo se rechaza hasta actualizar; no admite sobrepago. Pago completo resuelve solicitud pending como settled; rechazo historico se conserva aunque luego el saldo quede en cero.

Planilla ya atendida sigue disponible para estos cobros, con otra entrega deshabilitada. Operacion sin respuesta bloquea cambios y permite reintentar mismo ID. Error confirmado obliga a actualizar toda la planilla. Sin datos comerciales en almacenamiento local y sin modo offline/push de pagos.

Verificacion: 46 contratos/permisos y 13 controles UI/continuidad aprobados (59 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: alta de cliente del recorrido con aprobacion del jefe y bandeja global de visitas pendientes; siguen carga inicial del asistente, equipos/promociones, seguimiento compartido y rendicion/PDF. Etapa 4 aun no completa.

## Bandeja global de visitas pendientes del jefe - 24/10/2026

Migracion `20261024191505_owner_followup_queue.sql` aplicada por MCP: 31 migraciones y 45 tablas publicas con RLS. Nueva followup_resolutions registra decisiones atomicas/idempotentes; solo jefe de empresa lee/gestiona, sin escritura directa ni acceso anonimo. Helper global driver sigue bloqueado. Cero resoluciones reales al verificar; no se usaron pendientes, inventario, cuentas ni cobros reales para probar.

En Repartos y camion: Visitas pendientes de todos los repartos, paginadas de 20 con conteo total. Incluye origen abierto o cerrado, cliente, direccion, fecha prevista y nota de ausencia. Trasladar a otro reparto planned/active exige fecha de destino igual/posterior a la prevista y no anterior a hoy. Reutiliza parada pendiente existente o agrega/reactiva una elegible sin duplicar; rechaza destino ya atendido o con otro pendiente. No modifica carga ni asigna/acepta invitaciones. Revisar stock disponible si el destino ya salio.

Traslado desactiva operativamente la parada origen, preservando outcome absent, fecha, nota, eventos y movimientos. Tambien se admite origen cerrado: no cambia estado ni rendicion del recorrido. Resuelve en una transaccion con version e IDs estables; error revierte ambos lados y reintento conserva resultado. Cerrar pendiente con motivo exige nota, retira solo de la bandeja y no registra entrega ni cobro. No infiere resolucion por una venta de otra ruta. Una nueva ausencia en destino se vuelve pendiente propio.

Actualiza cada 30 segundos visible y al foco. No descarta campos escritos en una actualizacion sin cambios; fallo de lectura oculta acciones sin verificar. Respuesta desconocida bloquea cambios y ofrece el mismo reintento. Historial en eventos y followup_resolutions; todavia no hay pantalla dedicada de historial de decisiones.

Verificacion: 50 contratos/permisos y 3 comprobaciones de bandeja/reintento/motivo/error de lectura aprobados (53 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: alta de clientes del asistente durante recorrido con aprobacion del jefe. Siguen carga inicial del asistente, equipos/promociones, GPS compartido y rendicion/PDF.

## Alta de clientes propuesta por asistente - 24/10/2026

Migracion `20261024233446_customer_proposals.sql` aplicada por MCP: 32 migraciones y 46 tablas publicas con RLS. Nueva customer_proposals guarda solicitud y decision, autor, fechas y destino. Funciones dedicadas sin escritura directa/anonima; helper driver global no se reabre. Cero solicitudes reales al verificar. No se crearon clientes ni operaciones con datos reales para comprobar.

Asistente: Abrir reparto activo aceptado > Agregar cliente durante el reparto > Proponer nuevo cliente. Nombre, direccion, localidad, telefono, mapa/posicion actual o coordenadas opcionales. GPS solo por accion, no se consulta para probar. Proponer no crea cliente activo, parada, venta ni stock. Puede consultar sus propias ultimas 20 solicitudes de ese recorrido y la decision mientras conserve acceso. Datos no se guardan en almacenamiento local.

Jefe: Repartos y camion > Clientes propuestos para aprobar. Ve hasta 20 pendientes con total; al resolver aparecen otras. Aprobar exige elegir reparto planned/active, usando origen por defecto si sigue abierto. Si origen cerro, elegir otro. Crea cliente y parada atomicos con el ID de solicitud; no altera carga ni registra entrega. Rechazar exige motivo y no crea cliente. Coincidencia exacta de nombre/direccion con cliente activo frena aprobacion; no se fusiona ni reutiliza silenciosamente. Corregir datos requiere rechazar y reenviar, aun no hay editor de propuesta.

Reintentos de alta/decision conservan ID; IDs o parametros distintos no reinterpretan una decision previa. Solicitud pendiente identica del mismo asistente/recorrido se rechaza sin duplicar. Invitar/aprobar no habilita acceso a otra empresa o otro recorrido. Cliente aprobado aparece en destino al actualizar; listas ya abiertas de clientes del jefe pueden requerir Actualizar datos. Bandeja se consulta cada 30 segundos visible/al foco; sin push del sistema ni correo.

Verificacion: 55 contratos/permisos, 2 pruebas de solicitudes y 10 de atencion/invitaciones/continuidad aprobados (67 en total), compilacion correcta. Suite general, QA visual movil-PC y publicacion pendientes. Siguiente: carga inicial unica desde asistente, equipos/promociones y seguimiento, luego rendicion/PDF. No considerar etapa 4 ni beta completas.

## Jefe como chofer de su propio reparto - 24/10/2026

Pedido explicito del usuario: habilitar jefe que reparte solo. Migracion `20261025000137_owner_self_route.sql` aplicada por MCP (version UTC del servidor; fecha local del trabajo 24/10). Estado: 33 migraciones, 46 tablas con RLS. Nuevo helper privado operational_trip_access permite asistente con aceptacion vigente o jefe activo/licencia vigente asignado a si mismo, en recorrido no cerrado. Solo seis contratos dedicados de lectura/entrega/visita/cobro usan ese helper. No cambia accepted_trip_access, has_role driver, invitaciones, propuestas ni permisos generales. No requiere asistente/invitacion propia. Sin operaciones reales para probar.

Repartos y camion > Mi reparto como chofer > Abrir mi reparto. Preparar eligiendo nombre del titular, seleccionar clientes y confirmar carga existente; despues mapa, paradas, entrega/retorno parcial, cobros de venta/cargos anteriores y ausencias reutilizan el flujo conectado. Lista solo repartos propios; cierre o licencia no vigente retira lectura. Guarda solo IDs de reparto/parada por usuario/empresa para retomar al volver a esta seccion. No guarda clientes, stock ni GPS localmente.

Deuda dejada por el jefe queda aprobada por el con actor y fecha, sin notificacion a si mismo. Deuda del asistente conserva revision pendiente y avisos al jefe. El formulario explica la diferencia. La propuesta de cliente para aprobacion no se ofrece al propio jefe: alta administrativa existente en Clientes. El resto del panel del jefe y asignacion a asistentes se conservan.

Verificacion: 58 contratos/permisos y 12 controles de apertura/retomar/cierre/invitaciones/atencion aprobados (70 total); compilacion correcta. MCP confirma gate propio y permisos anonimos bloqueados, sin habilitar helper driver global. QA visual/manual y circuito completo publicados pendientes; consulta publica HTTP inicial responde 200, version nueva aun por verificar despues de push. Cierre/rendicion/PDF y carga inicial del asistente aun pendientes; prioridad actual es prueba del jefe trabajando solo.

## Cierre conciliado del reparto propio del jefe - 24/10/2026

Migracion `20261025001926_owner_trip_close.sql` aplicada por MCP: 34 migraciones y 47 tablas con RLS. Nueva owner_trip_close_snapshots conserva resumen inmutable de cierre. Funciones owner_preview_trip_close, owner_finish_self_trip y owner_self_close_history, solo jefe asignado a si mismo con licencia vigente. No abre helper global driver ni cierre del asistente. Cero cierres nuevos reales al verificar; sin tocar stock, posiciones, cuentas ni operaciones reales para probar.

Desde Abrir mi reparto > Finalizar mi reparto: muestra ventas registradas, efectivo y transferencias del recorrido (incluye cobros de deudas anteriores), conteo de llenos/unidades y vacios de regreso. Exige confirmar revision fisica. Resumen esperado se calcula en servidor; si hubo movimientos/cobros/cambios de paradas desde la consulta, pide actualizar. Caja y stock deben coincidir; diferencias se concilian en Stock antes de cerrar. No transforma faltantes en ajustes automaticos.

Cierre atomico reutiliza inventory_submit_trip, trip_closures aprobada e inventory_post close, devuelve stock al deposito y libera la siguiente carga del mismo chofer. No crea ventas, duplica cobros, manda autoavisos ni borra driver_positions. Permite recuperar estado submitted antiguo sin rendicion; si ya existe una rendicion submitted debe resolverse por el circuito previo antes de otro cierre. No reemplaza ni reescribe una rendicion existente.

Requiere resultado de todas las paradas activas (atencion, ausencia o no compro). Ausencias se conservan en bandeja global aunque origen cierre. Equipos por modelo se cuentan; equipos identificados por serie aun en camion deben volver desde Catalogo antes de cerrar. Se retira el boton antiguo de finalizar/regreso para recorridos propios, para evitar salida que no concilia caja. Circuito de cierre de asistentes sigue pendiente de integrar.

Respuesta desconocida conserva ID y conteo y bloquea la navegacion/actualizacion del recorrido hasta reintento. Error SQL no deja cierre parcial. Mis ultimos diez cierres muestra carga inicial y regreso con nombres/importes congelados. Para cargas antiguas sin snapshot de preparacion, cantidades iniciales vienen del libro y nombres se fijan al cerrar, sin afirmar nombre historico al cargar. PDF todavia pendiente.

Verificacion: 62 contratos/permisos y 6 controles de formulario/apertura/reintento/cierre aprobados (68 total), compilacion correcta. Incluye retorno al deposito, siguiente carga, pagos previos sin nueva venta, snapshot inmutable, diferencias y resumen obsoleto con rollback, preservacion de posicion y permisos. Publicacion nueva y QA visual/manual autenticada pendientes de comprobar; suite general al final segun preferencia del usuario.


## 2026-10-25 - Alta real de jefes con prueba gratuita

Registro conectado en /?registro=jefe: crear cuenta de jefe, confirmar correo y Crear mi empresa. Prueba gratuita de 30 dias desde el alta de empresa, plan basico con 1 asistente. Luego administracion puede cambiar la licencia conservando empresa y datos. No incluye cobro automatico.

Migracion 20261025044949_owner_signup.sql aplicada por MCP. Estado comprobado: 35 migraciones y 49 tablas publicas con RLS; politica auto_trial=true, trial_days=30. Nuevas owner_signup_policy y owner_registrations. Alta transaccional verificada por Auth, solo empresa propia; metadatos no conceden privilegios. Reintento reutiliza empresa sin duplicar ni renovar prueba. Licencias existentes intactas. Cero altas reales durante verificacion.

Verificacion local: 67 contratos SQL/permisos y 9 pruebas de acceso/formulario aprobados; build correcto. Publicacion pendiente de verificar tras push. Prueba manual autenticada de correo, alta y uso movil/PC pendiente; no se enviaron correos ni crearon cuentas reales para probar.

## 2026-10-25 - PDF conectado del cierre propio

Repartos y camion > Ver mis ultimos cierres > abrir cierre > Descargar PDF del cierre. Comprobante interno generado localmente desde el snapshot autorizado, previa nueva consulta RPC owner_self_close_history. Incluye carga inicial, regreso listo/vacio por producto/modelo, ventas, efectivo, transferencias declaradas, fecha/ID y nota. No confunde cobros anteriores con ventas ni presenta ganancia neta o conciliacion bancaria. Identifica empresa por ID; no inventa nombre historico no guardado. Cambios/series de dispenser no estan desglosados en este snapshot y se indica en el PDF.

Sin migraciones ni escritura remota: base conserva 35 migraciones y 49 tablas con RLS. Descarga no crea cierres, pagos ni movimientos, no envia correos, no persiste datos en localStorage. Error permite reintento; salir o cambiar empresa durante consulta cancela descarga antigua. Generador compartido con demo, que conserva marca DEMO y sus datos separados; modulo real se carga al solicitar PDF.

Verificacion: 14 pruebas dirigidas de cierre/descarga/PDF/demo aprobadas y build correcto. PDF ficticio normal de una pagina y prueba extensa de ocho paginas leidos con pypdf, renderizados y revisados visualmente; sin texto fuera de margenes. Archivos de prueba y herramientas de render fuera de Git. Publicacion pendiente tras push. Prueba manual de descarga en telefono/PC autenticados pendiente. Cierre/PDF del asistente y desglose historico de cambios de dispenser siguen pendientes.

## 2026-10-25 - Carga inicial real del asistente

Asistente acepta invitacion > Abrir reparto preparado > Iniciar reparto / Carga del camion. Consulta sugerencia por habitos o pedido extraordinario asignado, modifica cantidades y extras, elige rellenar faltantes y confirma carga fisica. Fecha actual de Buenos Aires del servidor. Una sola carga por reparto; no se edita al activar. Si jefe ya cargo, asistente ve stock y no otro formulario.

Migracion 20261025052354_assistant_initial_load.sql aplicada por MCP: 36 migraciones, 49 tablas con RLS. assistant_load_options y assistant_confirm_load requieren invitacion aceptada vigente, chofer asignado y licencia activa. No abren has_role driver ni RPC generales. Solo lista necesaria para preparar carga: nombre/unidad/modelo/existencias/sugerencia; no precios/costos ni cartera ajena. Libro de stock, rellenado necesario, estado activo y snapshot se guardan en una transaccion. Usa existencias disponibles y costos del jefe en servidor, conserva historial/sugerencia/extras/costo. No se probaron operaciones remotas con inventario real.

ID y datos identicos al reintentar; otra carga o salida sin cierre/aprobacion anterior se bloquea. Respuesta desconocida congela formulario y actualizaciones de recorrido para no perder reintento aunque servidor ya haya activado. Confirmacion muestra recorrido activo y Stock del camion. Formularios celestes, cantidades tactiles y adaptacion movil/PC; revision visual manual autenticada pendiente.

Verificacion: 71 contratos SQL/permisos y 13 controles de carga/invitacion/recorrido aprobados (84 total), compilacion correcta. Incluye stock insuficiente con rollback, costos privados, permisos y reintento ante respuesta perdida. Publicacion pendiente tras push. Cierre/aprobacion/PDF del asistente es el siguiente incremento.

## 2026-10-25 - Rendicion y aprobacion real de asistentes

Asistente: Abrir reparto activo > Terminar y rendir reparto > contar regreso, efectivo y transferencias > Enviar rendicion al jefe. Se presenta, sin devolver stock ni permitir otra salida. Jefe: Repartos y camion > Rendiciones de asistentes > revisar > aprobar y cerrar o devolver para corregir con motivo. Nueva presentacion despues de observar usa nuevo ID y conserva la anterior. Se retira el viejo boton de finalizar sin rendicion de la pantalla del jefe.

Migracion 20261025053209_assistant_trip_close.sql aplicada por MCP: 37 migraciones, 50 tablas publicas con RLS. Nueva assistant_trip_close_snapshots conserva solicitud original y resumen compartido; snapshot solo cambia al registrar decision. Preview del asistente elimina costos privados de carga. Nuevas RPC dedicadas, sin habilitar helper driver global. La RPC existente trip_review_close pasa por conciliacion de snapshots nuevos; su implementacion anterior queda privada y sin EXECUTE de authenticated para compatibilidad de registros viejos.

Requiere invitacion aceptada, reparto activo, licencia y resultados de todas las visitas. Carga, nombres, conteo y caja se verifican en servidor. Las diferencias requieren nota; se pueden presentar para revision, pero no aprobar hasta corregir. Cambios desde la presentacion obligan a devolver y presentar de nuevo. Aprobar devuelve stock una sola vez y conserva ultima posicion GPS historica; observar reabre reparto sin mover stock. Avisa al jefe dentro de la app, sin email/push externo. Cantidades y montos guardados no son ganancia neta ni conciliacion bancaria.

Respuesta desconocida conserva conteo/decision e ID y bloquea navegacion/refresco que lo descartaria. Reintento conocido del propio envio despues de cerrado/revocado devuelve solamente ID de confirmacion, sin reabrir ni leer datos. No se tocaron stock, pagos, cuentas o cierres reales para probar. Cierre del jefe propio y licencias existentes conservados.

Verificacion: 76 contratos SQL/permisos y 19 controles de formularios/invitaciones/carga/cierre aprobados (95 total); compilacion correcta. QA manual autenticada movil/PC pendiente. Publicacion pendiente tras push. Proximo incremento: PDF de este cierre para ambos y acceso historico limitado del asistente; no confundirlo con PDF propio del jefe ya publicado. Desglose historico de cambios de dispenser pendiente.

## 2026-10-25 - PDF compartido de cierre aprobado

Jefe: Repartos y camion > Rendiciones de asistentes > abrir Aprobada > Descargar PDF del jefe. Asistente: debajo de invitaciones, Mis comprobantes > Ver mis comprobantes > Descargar mi PDF. Ultimos diez cierres propios aprobados. Cierre pendiente o devuelto no genera comprobante aprobado. Sin envio automatico de mensajes ni email.

Migracion 20261025163405_shared_close_receipts.sql aplicada por MCP: 38 migraciones, 50 tablas con RLS. Nuevas consultas assistant_close_receipts y trip_close_receipt verifican usuario confirmado y actor del trabajo o jefe de esa empresa con licencia vigente. Asistente conserva comprobante de su propio trabajo aun sin vinculo/licencia/recorrido abierto, sin obtener acceso a clientes, mapas, stock ni otras personas. Proyeccion del servidor excluye ventas, transferencias, costos privados y revisiones internas; copia del jefe incluye ventas y cobros por medio.

Ambas copias identifican empresa/repartidor/reparto/fecha, carga inicial, regreso confirmado y efectivo validado, notas y aprobacion. Nombres y cantidades provienen del snapshot, sin recalcular con datos actuales. No es factura fiscal ni calculo de ganancia neta; desglose de cambios/series de dispenser pendiente. Descarga revalida por ID y rol en servidor; salir o cambiar contexto cancela respuesta antigua. Generacion local bajo demanda, sin escribir movimientos ni guardar PDF/datos de negocio en localStorage.

Correccion adicional: reintento confirmado solo con ID tras cierre/revocacion libera el formulario sin intentar mostrar un resumen incompleto. No se alteraron cierres, inventario o cuentas reales para probar.

Verificacion: 80 contratos SQL/permisos, 3 de PDF y 16 controles de acceso/descarga/cierre/invitaciones aprobados (99 total). PDFs ficticios de ambas copias y caso extenso de seis paginas leidos con pypdf, renderizados y revisados sin desbordes. Archivos y herramientas de QA fuera de Git. Compilacion final correcta; publicacion por verificar. Prueba manual autenticada movil/PC del circuito completo pendiente; siguiente: esa validacion y completar detalle de cambios de dispenser.

## 2026-10-25 - Regresiones de suite completa corregidas

Claves React de paneles hermanos de Repartos y camion ahora identifican tipo de panel y empresa; evita reconciliacion ambigua y mezcla de estado. Corregidos textos de carga/stock con acentos reemplazados por signos de pregunta. Habitos del cliente solo se consultan despues de lectura principal verificada, sin alertas secundarias antes de cargar ficha; actualizacion de disponibilidad respeta operaciones de habitos/pedidos en curso. Retry de ficha despues de desconexion conserva comprobacion antes de permitir cantidades.

Pruebas actualizadas al contrato vigente inventory_confirm_load (relleno opcional, snapshot, IDs estables) y al driver_plan custom de licencias existentes. Mocks de consultas de bandejas no simulan escrituras. Se conservaron verificaciones de empresa, cantidades, reintento identico y retiro del formulario tras confirmar. Nueva comprobacion de recuperacion de ficha y ausencia de advertencias de claves duplicadas.

Suite completa: 52 archivos, 412 pruebas aprobadas, cero fallos y cero avisos de claves duplicadas. Compilacion final correcta; publicacion por verificar. Sin migraciones ni cambios en inventario/cuentas/cierres reales: base mantiene 38 migraciones y 50 tablas con RLS. QA visual autenticada movil/PC sigue pendiente por bloqueo de Computer Use al no poder verificar la URL de Chrome; no se presenta esta suite local como prueba visual ni recorrido real completo.

## 2026-10-25 - Detalle de dispenser conectado al cierre

Proximas presentaciones/cierres guardan equipment_detail version 1 con operaciones vinculadas explicitamente al reparto: asignaciones por modelo, cambios con reemplazo y estado retirado, roturas/retiros de camion, y cargas/entregas/regresos/traslados de equipos por serie. Cambios excluyen sus dos movimientos componentes para no duplicarlos como nueva asignacion o retiro adicional. Equipo roto no suma disponibilidad. No infiere que el equipo entregado sea de fabrica nuevo ni atribuye devoluciones del deposito al camion solo por fecha/cliente.

Migracion 20261025170559_equipment_close_detail.sql aplicada por MCP: 39 migraciones, 50 tablas con RLS. Helper privado sin EXECUTE directo del usuario, quote propio/asistente incorpora el detalle y proyeccion del recibo propio lo comparte sin cliente, alquiler, responsable, costos ni GPS. Nuevos cambios despues de presentar impiden aprobar sin revisar; rendiciones anteriores sin equipment_detail mantienen sus reglas originales. No se actualizan snapshots antiguos ni saldos/contratos; etiquetas por modelo se congelan al presentar/cerrar, no se afirma reconstruir nombres al dia de un movimiento anterior.

Pantalla de rendicion/historial y PDFs propio del jefe y compartido muestran movimientos sin sumarlos de nuevo al regreso. Comprobantes anteriores conservan aviso de no contener desglose, sin inventar eventos. Se mejora paginacion comun de PDF para que encabezados finales acompanen su contenido. Copias ficticias del jefe (dos paginas) y asistente (una pagina) parseadas y renderizadas sin cortes, incluido titulo Observaciones junto a su texto.

Verificacion final: suite completa 53 archivos, 422 pruebas aprobadas. Incluye cambio bueno/roto, no duplicacion de reemplazo, serie/carga/regreso, snapshot congelado, proyeccion sin datos privados y aprobacion compatible de rendicion antigua. Compilacion final correcta; publicacion pendiente de verificar. Sin movimientos, cambios de dispenser o cierres reales para probar. QA manual autenticada movil/PC aun pendiente por bloqueo de control de Chrome.


2026-10-25: Planilla real del jefe incorpora Cuenta corriente, Cargar deuda anterior (monto, fecha y referencia antes de movimientos), saldo y cargos/pagos acumulados. Usa apertura unica existente, no genera entrega ni cambia stock. Mejora integrada en funcion real; demo conserva sus saldos ficticios. No incluye todavia formulario de cobro en esta planilla.

2026-10-25 - Waze en recorrido: se aclara que el reporte era abrir navegacion externa, no trasladar paradas. Opciones del recorrido ahora separa Waze una parada por vez de Google Maps varias paradas; cada pendiente tiene enlace Waze en orden, con coordenadas o busqueda de direccion si no hay punto exacto. Enlace HTTPS oficial waze.com/ul con utm_source=hidrotrack y navegacion en misma pestana para entrega al sistema del celular. No envia multiples destinos, no registra visita ni modifica recorridos. Una parada sin ubicacion no oculta otras validas. Compartido entre demo y real. Documentacion: https://developers.google.com/waze/deeplinks . 8 pruebas y build correctos; apertura nativa en Android/iOS pendiente de validar con usuario. No se afirma reproducir el error del celular. Publicacion pendiente de verificar.

2026-10-25 - Asignacion inicial de bidones existentes implementada: planilla elige descontar vacios (predeterminado) o llenos del deposito, con fecha; alternativa explicita no contados suma patrimonio. RPC inventory_assign_existing_containers conserva total propio, valida saldo y rol jefe, serializa operaciones y reintenta UUID sin duplicar; asignacion inicial unica por cliente/articulo. Registros historicos aditivos permanecen intactos. Catalogo muestra disponibles y distribucion por ubicacion. Migracion 20261026004710_customer_existing_containers aplicada por MCP, sin alterar existencias reales. 75 pruebas relacionadas y build correctos, incluyendo 600 a 598+2, reintento y rollback por saldo insuficiente. Publicacion pendiente de verificar. Ajuste de los dos bidones cargados previamente pendiente de identificar empresa y origen con usuario.

## 2026-10-25 - Libreta de cobros implementada en planilla real
Cuenta corriente incorpora Historial de pagos individuales con monto, fecha del hecho, efectivo/transferencia, referencia y cargo al que se aplica. Formulario Registrar pago elige cargo pendiente, admite pago parcial o total, fecha entre cargo y hoy y referencia opcional. Si cubre varios cargos se registra la parte de cada uno; no hay reparto automatico entre deudas. El cobro fuera del reparto usa p_trip=null y no altera caja/stock de camion.
Usa commerce_record_payment existente: autorizacion de jefe, saldo validado y bloqueo transaccional del servidor; UUID y valores conservados ante respuesta incierta. Error confirmado refresca saldos sin borrar el mensaje. Relectura tras guardar muestra saldo y pagos; error de consulta impide presentar saldo cero como confirmado. Historial paginado filtra payments por tenant y sales!inner.customer_id con FK compuesta, sin leer pagos de otros clientes. No modifica esquema ni registra pagos reales para probar.
Verificacion: 83 pruebas relacionadas aprobadas (incluye PostgreSQL); nuevo pase de interfaz tras ajuste de errores/fechas y build final correctos. MCP confirma relacion compuesta entre pagos y ventas. QA manual autenticada movil/PC pendiente. Publicacion pendiente de verificar. El pedido del audio deja de estar pendiente salvo validacion en celular y posibles mejoras posteriores.

## 2026-10-25 - Busqueda, saldo a la vista y repartos finalizados
Lista real de clientes permite buscar por nombre/direccion/telefono, ignora acentos y mayusculas, admite palabras en distinto orden, muestra cantidad de resultados, limpiar busqueda y aviso sin coincidencias. Clientes y saldos se consultan por paginas para evitar truncamiento por limite de API. Columna saldo muestra importe pendiente en naranja suave o sin deuda; falla de lectura no se interpreta como cero. Saldos refrescan cada 30 segundos o al recuperar foco y al volver desde planilla. No se consulta de nuevo al escribir cada letra.
Cuenta corriente pasa al inicio de la planilla para responder cuanto debe sin buscar entre equipos. Repartos finalizados y PDF se destaca arriba de Mi reparto como chofer, dentro de Repartos y camion, con explicacion de que quedan guardados y limite de diez propios. No se borra ni reasigna un reparto al cerrarlo; historiales de asistentes siguen separados.
Licencia de la cuenta actual de titular solicitada identificada por membresia y empresa, actualizada por MCP a permanente activa sin vencimiento y plan asistentes ilimitados, con auditoria automatica y relectura confirmada. No se modifico la cuenta antigua ni se cambiaron clientes/saldos/repartos. No incluir identificadores ni datos personales en Git.
Validacion: suite completa 439/439 y build aprobados. QA visual autenticada movil/PC pendiente. Publicacion aun pendiente de verificar; se diagnostica despliegue que sigue sirviendo version anterior. Este incremento incluye la libreta de pagos pusheada previamente.

## 2026-10-26 - Cartel de validacion y reenvio en flujo normal
Main: al crear cuenta sin sesion, cartel celeste Revis? tu correo y valid? tu cuenta con correo ingresado y pasos claros. Alta nueva confirmada por Auth indica envio automatico del enlace; respuesta oculta de duplicado mantiene mensaje neutral sin afirmar nueva cuenta. No se agrega un segundo envio automatico: signUp ya lo solicita a Supabase.
Boton Reenviar correo de validacion usa auth.resend type signup con el mismo correo y destino de alta jefe, sin repetir signUp ni cambiar clave. Respuesta incierta no afirma envio exitoso; estado de carga bloquea otras acciones. Si login devuelve email_not_confirmed, abre cartel de validacion pendiente con reenvio en lugar de error generico.
Lectura de configuracion Auth confirma proveedor email y signup habilitados, confirmacion previa activa y SMTP personalizado configurado. Sin cambios de configuracion ni envio de correos/cuentas reales para probar. La gracia 24 horas sigue en rama separada pendiente de autorizacion especifica, sin aplicar su migracion ni fusionarla.
Verificacion: suite completa 450/450 y build aprobados. Publicacion pendiente de verificar. Prueba manual de recepcion de correo sigue pendiente de usuario; no se afirma entrega basandose solo en configuracion.

## 2026-10-26 - Busqueda de direccion y punto de puerta implementados
Selector compartido de alta/edicion del jefe, propuesta del asistente y demo agrega Buscar direccion en el mapa. Campo de consulta opcional: vacio toma address/locality del formulario; permite completar localidad/provincia. Busca solo por accion expresa (o Enter), no por cada letra, via Photon con filtro Argentina y maximo cinco resultados; valida geometria, rango, pais y duplicados. Resultado no se selecciona solo ni modifica direccion escrita; elegirlo abre mapa, carga coordenadas y permite ajustar la puerta con toque. Punto se persiste al guardar cliente mediante campos existentes, sin migracion.
GPS actual abre mapa y muestra precision aproximada si navegador la informa. Errores, falta de resultados o permiso denegado conservan punto previo; timeout y aborto al desmontar evitan respuestas tardias. Controles y guardado/navegacion del jefe y propuesta quedan bloqueados mientras consultan, sin enviar formularios al buscar. Mapas no aceptan clicks cuando estan deshabilitados.
Verificacion: suite completa 455/455 y build correctos. Prueba HTTP con direccion publica ficticia/de demostracion confirma respuesta y CORS; no se enviaron domicilios reales de clientes ni se guardaron clientes para probar. QA visual autenticada en telefono/PC y precision real de domicilios pendientes. Publicacion pendiente de verificar.
Proveedor publico Photon admite uso razonable sin garantia de disponibilidad; conservar marcado manual y GPS como alternativa. Fuentes oficiales https://github.com/komoot/photon y https://github.com/komoot/photon/blob/master/docs/api-v1.md . La interfaz informa envio de direccion al servicio solo al buscar y muestra atribucion Photon/OpenStreetMap.

## 2026-10-26 - Horarios y recordatorios Web Push implementados
Planilla agrega franja desde/hasta del mismo dia, con guardar/quitar y horario de Argentina. Franja visible al elegir clientes para preparar reparto y al abrir paradas. Aviso interno desde una hora antes, bloques cada 30 minutos; No llegue a horario persiste detencion por parada/reparto sin inventar visita ni mover stock. Entrega/visita resuelta, cierre, revocacion o licencia suspendida impiden nuevos envios.
Push real de fondo: consentimiento solo en dispositivo movil y por boton explicito; iOS necesita instalacion en pantalla de inicio. Receptor sw.js no cachea clientes ni intercepta fetch. Sesion activa en IndexedDB, descarte de cuenta incorrecta y mensajes tardios de parada resuelta desde mismo dispositivo; cerrar sesion desuscribe. Cola privada deduplicada y autenticacion por secreto de tarea; APIs de envio solo service_role, endpoints de suscripcion limitados a proveedores push conocidos y pertenencia al usuario. Claves privadas en Edge secrets/Vault, copia de mantenimiento local ignorada; no se versionan valores ni endpoints reales.
Migraciones 20261026171941_visit_windows_push y 20261026171957_visit_reminder_scheduler aplicadas por MCP: 42 migraciones y 52 tablas publicas con RLS. Se actualizo solo contrato assistant_open_trip conservando acceso operativo y stock. Edge Function visit-reminders v2 activa, autenticacion propia; cron hidrotrack-visit-reminders cada minuto. Prueba real de programador->Edge HTTP 200 y ejecuciones cron exitosas; peticion sin autenticacion 401. Cero telefonos suscriptos/horarios reales/mensajes al comprobar: no se alteraron clientes, recorridos ni existencias para probar.
Suite completa 469/469 y build aprobados. Guia en docs/HORARIOS_Y_AVISOS.md. Publicacion web pendiente de verificar; recepcion fisica con telefono bloqueado pendiente de consentimiento y prueba del usuario. No prometer entrega exacta sin conexion o frente a restricciones del telefono. Primeros avisos solo para repartos activos del dia asignados al destinatario con permiso vigente; no hay SMS/correos generados por esta funcion.

## 2026-10-26 - Navegacion externa validada por usuario
Usuario confirma que Waze y Google Maps toman correctamente los destinos en la prueba real realizada por el repartidor. Se registra como validacion manual reportada por usuario, no como prueba ejecutada por el agente ni como garantia de todos los dispositivos. No valida por si sola la optimizacion del recorrido ni la recepcion de recordatorios push, que son funciones separadas. Sin cambios de codigo ni datos reales.

26/10/2026 - Correccion de horarios: selector explicito de 24 horas (hora 00-23 y minutos 00-59), independiente del formato AM/PM del telefono. Vista previa antes de guardar; 08:30 a 18:30 conserva ambos valores al guardar y releer. Sin migracion ni cambios automaticos a franjas existentes: revisar y guardar nuevamente si se habian cargado como 06:30 por error. Mejora integrada en funcion real existente; sin simular persistencia en demo.

26/10/2026 - Preparar reparto por dia: la fecha elegida determina lunes/domingo, consulta dias habituales paginados por empresa y muestra coincidencias. Lista ordenada por inicio HH:mm, sin franja al final, desempate por nombre. Alternativa Mostrar tambien agrega otros dias/sin dia; las selecciones ocultas se conservan con aviso. Cambiar fecha reinicia seleccion para no arrastrar clientes del dia anterior. Error de consulta muestra todos para seleccion manual con advertencia; horarios no disponibles se indican. No modifica dias/horarios de clientes ni recorridos existentes. Orden de lista/seleccion no equivale a optimizacion vial ni garantiza orden persistido de paradas: la creacion actual de servidor usa un conjunto DISTINCT y su trigger asigna posiciones; cambiar ese contrato queda pendiente y requiere MCP, no disponible en esta sesion.

26/10/2026 - Catalogo agrega Ajustar unidades por articulo y acceso desde Editar: sumar o retirar del deposito con estado, fecha y motivo. Muestra saldo por estado y resultado del movimiento. Reutiliza inventory_record_stock/inventory_remove, permisos del jefe y validaciones existentes; ejecutor conserva ID al perder respuesta. Dispenser ingresa disponible, retornables permiten vacio/lleno. No cambia clientes/camiones ni historial, y no representa correccion como rotura. Solo delta explicito, no edicion directa del total: movimientos concurrentes siguen sumandose. Sin migracion ni modificacion de datos reales para probar.

26/10/2026 - Herramienta local tools/backup/Abrir backup.cmd preparada: GUI Python/Tkinter para ingreso manual de conexion Session pooler y contrasenas no persistidas, pg_dump custom, pg_restore --list, cifrado portable AES-256-GCM/scrypt y descifrado+hash antes de confirmar. Carpeta de copias fuera del repo, nombres UTC unicos, sin borrar copias previas; descifrar a archivo no restaura ni conecta. Pruebas offline 3/3 y compilacion Python correctas: datos ficticios, clave incorrecta, corrupcion y falla de exportacion; no se ejecuto dump de produccion ni se instalaron tareas automaticas. Guia docs/BACKUP_LOCAL.md separa DB de Storage/config/roles/secretos/Vault y explica temporales en disco. Dependencia cryptography ya disponible en esta PC. Faltan pg_dump/pg_restore, conexion y primera copia real; restauracion aislada aun no validada. Herramienta operativa local, no formulario web/demo para credenciales.

26/10/2026 - Iniciador automatico preparado: Python privado por usuario con Tkinter/pip (firma PSF), venv y cryptography desde PyPI, ZIP oficial EDB para pg_dump/pg_restore y DLLs, runtime Microsoft firmado solo si hace falta. Sin servidor PostgreSQL ni PATH global. Lock evita instalacion simultanea, fallos bloquean arranque. Ventana detecta ruta de cliente por entorno y descarta configuracion de ejecutable inexistente al cambiar PC. Corregido limite de carpeta al ejecutar fuera del repositorio. Paquete ZIP por allowlist sin credenciales/config/datos. CheckOnly verifica enlaces reales sin instalar; pruebas offline 3/3 y sintaxis Python correctas. Instalacion completa en PC limpia, primera copia real y restauracion aislada pendientes. tools/backup.rar ajeno conservado, no incluido en Git.

27/10/2026 - Ficha prioriza resumen de horario 24h y fecha habitual (no promesa de visita confirmada). Recuadro Preparar manana en Mi jornada/Repartos con clientes activos y aviso de repartos ya creados; acceso con fecha de manana. Desde las 20 recuerda dentro de la pagina abierta: push de las 20 con pagina cerrada sigue pendiente, sin cambios de cron/emisor. Seleccion masiva del dia, lista revisable y plantillas cloud preparadas con controles de disponibilidad. Cierre propio ofrece Guardar como plantilla y tambien se puede capturar un reparto desde Repartos. Migracion 20261027010000_route_templates preparada y probada localmente: RLS propietario, guardado idempotente, captura solo clientes habilitados y creacion atomica de posiciones; reintento no pisa orden posterior. NO aplicada por ausencia de MCP. Version anterior de crear reparto permanece operativa, con mensaje de orden no habilitado. No se usa guardado local como sustituto de cuenta. Guia PLANIFICACION_Y_PLANTILLAS.md detalla pendiente de activacion y de push nocturno.

27/10/2026 - MCP restablecido. Plantillas/orden aplicados version 20261027193814, RLS y permisos verificados. Cola/preferencia privada diaria aplicada 20261027194519, cron separado 20261027194537, Edge planning-reminders v1 activa con autenticacion propia. Opt-in por jefe/empresa independiente de horarios; solo celulares piden permiso. Emisor manda cantidad y contexto sin nombres/deudas/direcciones; doble validacion de permiso/licencia, deduplicacion diaria, lease/reintentos limitados y cierre de endpoints caducos. Worker recibe tipo next-day-planning con control de sesion/expiracion/duplicados, click solo misma web y tenant/fecha validos, cliente valida pertenencia propietaria antes de elegir empresa. Preferencias existentes no se activaron. Servicio diario global sigue deshabilitado hasta publicar/verificar receptor. Prueba real autenticada con flag apagado HTTP 200 y contadores cero; sin clave HTTP 401. Suite completa 499/499 y build aprobados. Sin datos reales cambiados ni mensajes enviados para QA. Plantillas ya activas; recepcion real de push pendiente de activar/probar en telefono del usuario.

27/10/2026 - Cierre de activacion: servicio planning_push_config.enabled=true por MCP despues de publicar y verificar AccountWorkspace-uDfJwI5m.js, preferencias, enlace planificar/empresa y worker next-day-planning con deduplicacion. 45 migraciones, 53 tablas publicas con RLS, ambos crons activos; ultimo cron diario succeeded y reclamo fuera de horario devuelve cero. Edge planning-reminders v1 activo: prueba autenticada 200/cero mensajes y no autenticada 401. Suite completa 499/499 y build correctos. Ninguna preferencia de usuario se activo ni se enviaron mensajes a telefonos reales para QA. Prueba fisica de telefono bloqueado y revision visual autenticada pendientes. Usuario puede actualizar web, guardar/cargar plantilla y activar permiso + aviso de las 20 desde Preparar manana en celular. Las plantillas/orden y push diario ya no estan pendientes de MCP. Pendientes anteriores separados: notificar cambios del jefe y clientes de la cuadra/GPS; copia real de base y restauracion aislada en otra PC; mejoras de deuda/fecha historica aun anotadas.

28/10/2026 - Demo de clientes usa Eliminar cliente para retirarlo de activos conservando el ejemplo. Acciones reales nuevas en planilla y Mis recorridos; recorridos de demo no prueban eliminacion en Supabase. El jefe confirma cada accion; equipos/envases pendientes requieren recuperacion y reparto activo requiere cierre. El historial no se purga.

28/10/2026 - Papelera preparada en panel de superadministracion y demo /?demo=admin con ejemplo ficticio recuperable. El ejemplo no conecta ni elimina datos reales. La papelera real usa Supabase y requiere rol plataforma; no comparte copias con jefe/asistente. Guia PAPELERA.md explica los 10 dias, vencimiento, purga y restauracion sin iniciar camiones ni duplicar cobros.

28/10/2026 - Seguridad inicial: demo y web real comparten protecciones de navegador en produccion. Plan publico usa script externo propio, compatible con CSP. No cambia estetica ni convierte roles de demo en permisos reales. La compilacion puede hacerse sin configuracion para demo; si se configura Supabase exige URL y clave publica valida. Detalle y limites en SEGURIDAD_BETA.md.

28/10/2026 - Papelera se convierte en seccion principal del panel, con icono y boton destacado Abrir papelera en cabecera. Enlace directo ?admin=papelera; no cambia permisos de plataforma ni backend. Al restaurar se bloquea navegacion/salida para conservar confirmacion. Demo admin refleja el acceso; restauracion sigue siendo ficticia en demo. Guia PAPELERA.md actualizada.
