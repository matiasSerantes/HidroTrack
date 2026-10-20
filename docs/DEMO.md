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
