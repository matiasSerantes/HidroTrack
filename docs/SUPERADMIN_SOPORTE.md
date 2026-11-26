# Soporte desde la cuenta de superadministrador

## Asignar, renovar o suspender una licencia
1. Ingresar con tu cuenta y completar el doble factor si esta activado.
2. Tocar **Asignar licencias**, buscar la empresa y abrir **Editar licencia** (o **Asignar licencia** si falta).
3. Elegir Basico, Intermedio, Superior o Personalizado; mensual o permanente; estado activo o suspendido. Para renovar una mensual, cambiar su fecha de vencimiento.
4. Revisar y confirmar. Guardar no genera cobros ni pagos automaticos. Un plan menor exige que la cuenta cumpla sus cupos; no se borra informacion para hacerlo entrar.
5. Si se pierde la respuesta, usar **Reintentar misma asignacion**. No volver a crear una operacion diferente. El cambio conserva los datos anteriores y el administrador que lo hizo.

## Corregir stock por solicitud del titular
Desde la empresa, tocar **Gestionar stock y repartos**. Tambien esta el menu **Repartos y stock**.
- **Marcar bidones como llenos:** convierte una cantidad de vacios del deposito en llenos. Conserva el total propio.
- **Corregir existencias del deposito:** elegir un producto o modelo de dispenser e ingresar su conteo final. Muestra la diferencia que agregara o retirara del patrimonio; no modifica lo que tienen clientes ni camiones. Los dispenser no admiten estado vacio. Un modelo archivado solo admite reducciones.
- **Clientes y bidones asignados:** buscar por nombre, direccion o telefono. Muestra saldo pendiente y dispenser como referencia. Para corregir envases, elegir el modelo y la cantidad final del cliente; la diferencia se mueve desde/hacia el deposito elegido, sin cambiar total propio, ventas ni deudas. Futura baja/inactivo solo admite recuperar envases.
- **Repartos abiertos:** revisar caja, regreso y estados antes de finalizar; los conteos deben coincidir. Los equipos individualizados mantienen su control de devolucion y los contratos de dispenser no se reescriben desde un conteo de stock.

Las operaciones registran fecha, usuario administrador y valores antes/despues; nunca usan la identidad del jefe. Si los datos cambiaron desde la consulta, se rechaza el comando y se pide actualizar. En **Ultimas operaciones administrativas**, abrir los valores registrados. Usar **Papelera** para recuperar eliminaciones dentro del plazo vigente; **Uso por cuenta** para revisar cantidades y actividad. Las herramientas no exponen ni cambian contrasenas de otros usuarios.

En la demostracion administrativa todas las cantidades y empresas son ficticias. No se hacen correcciones reales para probar el sistema.

## Ingresos por licencias
En Resumen o Empresas y licencias, consultar Ingresos por licencias y elegir el mes. Muestra cobros registrados, compras, renovaciones, empresas que pagaron, grafico de seis meses y ranking mensual por compras. Son ingresos brutos en ARS, sin deducir gastos. Una asignacion manual o prueba gratuita no se supone pagada.

Para un pago recibido, usar Registrar cobro de licencia: empresa, plan efectivamente comprado, importe, compra/cambio de plan o renovacion, fecha del cobro y medio. Opcionalmente usar el precio actual del plan como referencia. Confirmar que ya se recibio y no se registro antes. Registrar no cobra dinero ni activa/renueva la licencia; la asignacion sigue siendo manual. El importe y nombre del plan se conservan historicamente.

Ante un error, Anular cobro lo excluye de ingresos/ranking conservando el historial; Restaurar cobro lo vuelve a incluir. No son reembolsos ni transferencias. Si se pierde la respuesta, Reintentar mismo registro mantiene el identificador y evita duplicar el ingreso. Los controles son solo para superadministracion y mantienen MFA.
