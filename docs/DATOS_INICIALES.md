# Datos para preparar el reparto de Darío

La pantalla conectada del jefe está en **Ingresar a mi cuenta → Stock y surtidores**. Hace falta provisionar su usuario, empresa, membresía de jefe y licencia antes de entrar. No se creó una cuenta usando datos inventados ni se cargó un inventario real todavía. No enviar contraseñas por el chat ni guardarlas en Git.

## Qué pedirle

1. Nombre de la empresa y correo que usará para acceder.
2. Artículos: bidón 12 L, bidón 20 L, sifón, cajón u otros; precio por entrega y qué presentaciones se cuentan por unidad. Distinguir cajón de sifón para no contar el mismo stock dos veces.
3. Por artículo, cuántos envases propios hay: llenos y vacíos del depósito, en el camión y en cada cliente. El total propio es la suma de esas ubicaciones, no la suma de entregas históricas.
4. Clientes: nombre, dirección y teléfono opcional, con la cantidad de cada envase que ya tienen al comenzar.
5. Surtidores propios: modelo/tipo, identificación o serie si la conoce, ubicación y cliente. Si está con el cliente: préstamo gratuito o alquiler, con cuota mensual. Surtidores que pertenecen al cliente, aparte.

Las plantillas CSV vacías en [plantillas](plantillas) sirven para reunir esa información; todavía no hay importador automático. No subir las planillas completadas con datos reales al repositorio.

## Orden de carga inicial

Hacer un corte al cierre de un día, con el camión descargado. Contar llenos/vacíos reales del depósito y los envases que quedan en clientes. Así no se necesita inventar entregas para representar vacíos que ya estaban en el vehículo.

1. Crear clientes y artículos. Los retornables son envases que siguen perteneciendo al reparto; el precio es lo que se cobra por entregar el producto, no el costo de comprar el bidón.
2. Ingresar los llenos del depósito mediante Compra / inventario inicial de llenos, y los vacíos por su opción correspondiente. Hacerlo una vez por cantidad contada; no repetir aperturas como si fueran compras adicionales.
3. Registrar Inventario inicial en un cliente por cada artículo que ya tenga. Debe hacerse antes de comenzar a registrar entregas de ese cliente/artículo. No se necesita una venta ficticia.
4. Registrar los surtidores uno por uno. Del cliente no suma a los propios; préstamo gratuito no tiene cuota.
5. Comparar el total propio con el conteo de Darío. La apertura es un punto de partida, no un historial reconstruido.
6. Preparar un reparto, asignarle clientes y quién sale. Confirmar su única carga; pasa del depósito al camión. Para surtidores, ubicar la unidad en el reparto activo si viaja en el camión.

Al volver, se finaliza el reparto y se aprueba el regreso exacto de llenos y vacíos. Rellenar vacíos transforma esos envases en llenos; no incrementa la cantidad propia. Los movimientos de entrega reales todavía no tienen pantalla del chofer: esa integración es la siguiente parte y debe validarse antes de usarlo para repartir en producción. Las diferencias, pérdidas, roturas y correcciones de apertura aún no tienen circuito; conviene revisar bien el conteo inicial antes de confirmarlo.

La pantalla fue probada con un cliente simulado y la base con PostgreSQL local. Falta la prueba completa de sesión real y revisión visual en celular/PC. Podemos empezar con un inventario controlado después de provisionar la cuenta y validar ese acceso, manteniendo la demo aparte.
