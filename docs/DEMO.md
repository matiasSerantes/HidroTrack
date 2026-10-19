# Guía de la demostración completa

## Abrir

Ejecutar `npm run dev` y entrar a `http://127.0.0.1:5173/?demo=1` (usar el puerto que informe Vite si está ocupado). También se puede entrar desde «Explorar demostración» en el inicio.

Elegir **Santiago · repartidor jefe** o **Lucía · asistente**. El código del autenticador ficticio es **123456**. Después, el selector «Explorar como» permite cambiar de rol conservando las operaciones locales.

La empresa de ejemplo es **Agua Clara**. El día operativo es el **19/10/2026**; las horas de las acciones corresponden a la hora actual de Buenos Aires. No son datos de un reparto real.

## Qué se puede probar

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
- Autenticador visual, perfiles intercambiables, avisos internos y seguimiento local **simulados**. El plano es ilustrativo: sin mapas de calles reales, cálculo de ruta, GPS, push, WhatsApp ni envío de mensajes. No se solicita ubicación.
- «Atendiendo» se actualiza al abrir la atención y «Último punto» al confirmar. Ambos muestran hora y etiqueta de simulación; no equivalen a un GPS real.
- El jefe ve la cartera completa; el asistente ve clientes activos de sus repartos y sus operaciones. Es una demostración de interfaz, no una frontera de seguridad: todos los datos ficticios están en el navegador.
- El alquiler del ejemplo es mensual: entregar un equipo registra su unidad y primera cuota. Un equipo existente permite registrar su cuota una sola vez en el período demo. No hay calendario de contratos ni facturación recurrente real.
- La baja exige equipos devueltos en buen estado. Los daños y faltantes impiden aprobar y deben revisarse; la política definitiva sigue abierta. La deuda y los envases pendientes no se borran.
- Un cajón de seis y un sifón suelto son presentaciones independientes; no hay conversión automática ni movimiento de desarme.
- Una rendición con diferencias se puede enviar con observación, pero requiere revisión para aprobar. Para iniciar otro reparto del mismo conductor se debe cerrar y aprobar el anterior. Son reglas de la demo, pendientes de validación comercial.
- Los informes usan este día ficticio; no se inventa una historia mensual ni se implementó el ranking propuesto en la referencia.

## Validación de esta entrega

`npm test`: 27 pruebas aprobadas, incluidas las existentes, operaciones de la demo y navegación de ambos roles en jsdom. `npm run build`: compilación de producción aprobada. No se pudo realizar una revisión visual en navegador porque no había una superficie de navegador conectada disponible; el diseño incluye reglas adaptativas, pero esa comprobación visual queda pendiente.

Esta entrega permite evaluar el programa completo por partes. Cada parte que pase a producción necesitará su esquema, permisos y validación reales.
