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

`npm test`: 44 pruebas aprobadas, incluidas operaciones, mapas, recuperación, envases, reprogramación, réplica al jefe y panel de cuadra con orden/agregar/quitar y restricciones del asistente. `npm run build`: compilación de producción aprobada. La carga real de la cartografía y la revisión visual en navegador/dispositivos reales quedan pendientes.

Esta entrega permite evaluar el programa completo por partes. Cada parte que pase a producción necesitará su esquema, permisos y validación reales.

### Iniciar reparto y consultar el camión

Un reparto planificado muestra **Iniciar reparto**: ingresá la carga y pulsá **Confirmar carga e iniciar**. Se abre Mi reparto y la carga queda bloqueada sin recargas ni edición; cerrar y reabrir conserva ese estado. **Stock del camión**, desde Mi reparto, muestra carga inicial, unidades disponibles y vacíos recuperados. Cada entrega confirmada actualiza el stock y el **Total del camión · entregas realizadas** a su precio registrado. El cobrado se informa por separado; el total de entregas excluye cuotas de alquiler de equipos instalados anteriormente.

La Lucía inicial ya tiene un reparto activo con carga confirmada. Para probar el inicio desde cero, el jefe puede crear un reparto para un asistente sin reparto activo, cambiar al asistente y pulsar Iniciar reparto. Para Lucía, finalizar/rendir, obtener aprobación y solicitar el siguiente; cada nuevo reparto permite una única carga independiente. La confirmación de cierre no habilita modificar la carga anterior. Todo se guarda en la demo local; no modifica Supabase. Validación visual en teléfonos y PC reales pendiente.
