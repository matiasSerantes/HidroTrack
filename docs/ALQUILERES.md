# Acuerdos y cuotas de alquiler

Cada jefe define el importe y las condiciones de sus alquileres. No hay una regla global de devolucion anticipada o prorrateo impuesta por la aplicacion.

## Asignar y configurar

En **Clientes > Planilla > Asignar dispenser**, elegir un equipo disponible y modalidad **Alquiler**, completar la cuota mensual y, opcionalmente, las condiciones acordadas. El stock/asignacion y el acuerdo se guardan en una transaccion: si una parte falla, no queda una entrega a medias. Funciona para stock por modelo y equipos individualizados por serie.

Los prestamos gratuitos y equipos propios del cliente no generan cuotas. El precio de entrega del catalogo y la cuota de alquiler del contrato son conceptos separados.

## Editar un alquiler existente

En la planilla, abrir **Cuotas de alquiler > Editar acuerdo de [dispenser]**. Cambiar el importe mensual o las condiciones y guardar. Se valida que el contrato siga siendo el mismo y que otro cambio no haya reemplazado el importe o acuerdo consultado. Hay registro de antes/despues, autor y fecha.

Las cuotas ya generadas y los pagos anteriores mantienen sus importes. El cambio aplica al importe vigente que se utilizara al generar otra cuota; no reescribe la cuenta corriente ni mueve stock. No se transforma automaticamente un prestamo gratuito en un alquiler.

## Generar y cobrar

La seccion muestra el primer periodo iniciado que todavia no tiene cuota, con inicio/fin calculados desde la fecha de entrega del alquiler. Fin de mes no acumula deriva: una entrega del 31 de enero tiene periodos anclados al 31, ajustados al ultimo dia del mes cuando corresponda.

**Generar cuota** agrega el cargo a Cuenta corriente con la fecha que muestra la pantalla. Es una accion del jefe, sin cobro automatico. El importe y la fecha del contrato se vuelven a verificar al guardar; una cuota por contrato/periodo no puede duplicarse. Si se pierde la respuesta, usar **Reintentar misma cuota**; no cerrar la pantalla mientras haya una confirmacion pendiente.

El pago parcial o total se registra desde **Cuenta corriente > Registrar pago**, eligiendo la deuda correspondiente. El asistente autorizado puede cobrar los cargos ya generados desde su recorrido; generar cuotas o cambiar acuerdos corresponde al jefe. Los acuerdos de cierre anticipado se deciden entre jefe y cliente; no se prorratean automaticamente.

Se muestran las ultimas 50 cuotas, incluidas las de contratos ya devueltos que se hayan generado antes. Si un equipo individualizado no tiene fecha de entrega trazable, se informa y se impide facturar inventando una fecha.

## Verificacion

Migracion `20261102131027_customer_rental_panel` aplicada mediante MCP: tabla de auditoria con RLS/solo lectura del jefe, comandos protegidos y recibos privados de asignacion. Ningun acuerdo ni cuota real se genero para QA. 141 pruebas relacionadas y build correctos; incluidos fin de mes, idempotencia, cambio de condiciones, aislamiento, precio anterior inmutable y rollback de stock si falla el acuerdo. Publicacion y revision visual autenticada se registran en ESTADO_REAL.md.
