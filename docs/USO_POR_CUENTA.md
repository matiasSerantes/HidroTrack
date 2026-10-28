# Uso por cuenta — superadministración

Ingresar con la cuenta de superadministrador y abrir **Uso por cuenta** en el menú. Acceso directo: https://hidrotrack.matilegen.workers.dev/?admin=uso . Elegir fecha, buscar por empresa/correo del jefe y tocar **Actualizar estadísticas** cuando se necesiten nuevos valores.

Una cuenta corresponde a una empresa del jefe. Los asistentes comparten el stock de esa empresa, por lo que agregar asistentes no multiplica las cantidades. El panel no mide MB ni tráfico de red.

## Inventario actual

- Artículos/modelos activos del catálogo: cantidad de definiciones de productos, no unidades físicas.
- Unidades registradas: saldo actual de movimientos del catálogo, incluyendo unidades en depósito, camiones, clientes, promociones y daños de promociones pendientes. Los retiros ya registrados se reflejan en el saldo.
- Depósito: listas para entregar y vacías, separadas también en texto. Las unidades listas incluyen productos/dispenser disponibles; no todo artículo es un bidón lleno.
- Dispenser individualizados: equipos propios activos con identificación individual, aparte del inventario por modelo. No incluir equipos propiedad del cliente ni retirados, ni sumar dos veces estas formas de registro.

El stock siempre es el saldo actual al consultar. Cambiar la fecha **no reconstruye inventario histórico**.

## Recorridos del día elegido

- **Creados ese día**: fecha de creación convertida a horario argentino, aunque se hayan preparado para otra fecha.
- **De esos, eliminados**: subconjunto de los creados ese día que actualmente están eliminados; no es la cantidad de eliminaciones realizadas durante ese día.
- **Para esa fecha, vigentes**: fecha de servicio elegida, sin los eliminados. Se divide en sin iniciar, en curso/rendición y finalizados.

No son promedios mensuales ni conteos de clientes/paradas. Se consultan los registros existentes, no una serie histórica de consumo independiente; las purgas pueden retirar filas sin referencias. Los recorridos con historia vinculada conservan su identificador anónimo y siguen reflejados en el conteo de creación.

## Acceso y rendimiento

Consulta de solo lectura, validada en servidor para superadministración. Ni jefe ni asistente pueden invocarla para ver otras cuentas. No se otorga lectura directa nueva sobre tablas. Filtro y paginación de 50 empresas en servidor; agregados calculados únicamente para la página. Índices por empresa/fecha de creación y de servicio. Sin sondeo automático en segundo plano ni descargas de clientes o ventas.

La demo de administración muestra métricas ficticias, señaladas como ejemplo. No consulta cantidades reales ni modifica inventario. Una falla de consulta muestra error y evita presentar ceros sin verificar.
