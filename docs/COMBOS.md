# Combos con precio especial

## Crear una sola vez

Como jefe, abrir **Promociones → Combos con precio especial → Crear combo**. Indicar nombre, precio total y cantidades incluidas de cada producto. Guardar. También se puede editar o desactivar desde esa sección; desactivarlo no borra ventas anteriores. Los dispenser se asignan por separado.

No se compra ni se carga stock del combo: usa las existencias de sus artículos. La pantalla del jefe muestra cuántos podrían armarse con los llenos del depósito. No reserva esas unidades: dos combos pueden compartir productos.

## Usar durante un reparto

1. Cargar el camión con los artículos físicos e iniciar el reparto habitual.
2. Abrir una parada y **Atender cliente**.
3. En **Promociones disponibles**, indicar cuántos combos se entregan.
4. En los campos **Entregar**, agregar solamente unidades sueltas adicionales. No repetir las incluidas en el combo.
5. Registrar envases devueltos, cobro y medio de pago. Revisar el total y confirmar.

Ejemplo: un combo de dos bidones más un bidón suelto baja tres del camión. Si el cliente tenía dos y devuelve uno, quedan cuatro para devolver. El cobro suma el precio del combo y el de una unidad suelta.

Solo se confirma si alcanza el stock total de todos los combos y sueltos seleccionados. Si otra operación consume existencias, el servidor rechaza todo sin dejar una venta parcial. Un cambio del combo exige actualizar la planilla. Reintentar una entrega sin respuesta conserva el identificador y no duplica stock, cobros ni deuda.

## Permisos e historial

El jefe crea y edita. Un asistente solo puede usar combos si el jefe le habilitó promociones en esa empresa y tiene acceso a su recorrido activo. Sin permiso no aparecen ni se pueden enviar por API. El jefe puede usarlos en su propio reparto.

La venta guarda nombre, versión, composición, cantidades y precio del combo usados ese día; cambios posteriores no reescriben la venta. Las unidades sueltas quedan en `sale_items` y los combos en `sale_combo_lines`; el movimiento físico registra todos los productos. El saldo, efectivo, transferencias y PDF del cierre usan el total de la venta. La cuenta corriente identifica los combos en la descripción del cargo.

Los kits de prueba para personas que aún no son clientes conservan su circuito separado: no son estos combos vendidos.

La demo permite crear combos ficticios en Promociones y usarlos en Atender cliente. No toca la base real.


## Promo habitual de un cliente

En Planilla > Visitas y pedido habitual > Producto habitual, elegir la promo en el grupo Promociones. En Promos por visita escribir 1 para una promo por visita. Ejemplo: una promo de dos bidones de 12 L suma dos bidones de 12 L a la sugerencia de carga; no suma un bidon de 20 L por tener ese precio. Se usa el precio definido en Promociones al registrar la venta, no al configurar el habito.

Guardar cero quita esa preferencia. Si la promo reemplaza un producto habitual anterior, quitar tambien ese anterior con cero para no sumar los dos. Los pedidos extraordinarios asignados reemplazan el habitual completo durante esa visita. La planilla de atencion recuerda la cantidad habitual de promos; el chofer sigue confirmando lo realmente entregado.

Editar la composicion del combo actualiza futuras sugerencias; desactivarlo o retirar un ingrediente lo deja fuera de sugerencias sin borrar ventas anteriores. Siempre revisar la carga. No modifica stock, envases ni deuda al guardar el habito. La demo ofrece el mismo campo de promo habitual y expansion de carga ficticia.
