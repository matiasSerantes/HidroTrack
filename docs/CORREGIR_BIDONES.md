# Corregir bidones de un cliente

1. Abrir Clientes y la Planilla del cliente.
2. Tocar **Corregir cantidad de bidones**.
3. Elegir artículo y escribir el **total correcto que tiene ahora**. Si figuraban 2 y debe tener 4, escribir 4.
4. Elegir el depósito de vacíos o llenos para la diferencia, fecha y motivo.
5. Guardar cantidad correcta. Puede repetirse el mismo día.

Al aumentar, se descuenta la diferencia del depósito; al reducir, vuelve al depósito elegido. El total propio, las ventas, los cobros y la deuda no cambian. La operación queda en Movimientos del cliente como Corrección de envases, con fecha de registro, motivo y diferencia. No borra la apertura anterior.

Para ventas o entregas físicas usar Atender cliente dentro del reparto. Para bidones nunca contados en el patrimonio, conservar la apertura inicial correspondiente; no usarla para sumar nuevamente los que ya estaban registrados.

Solo el jefe puede corregir. Si falta stock o cambió el saldo, no se guarda: actualizar disponibilidad y revisar. Una baja pendiente solo admite reducir, no aumentar. Una respuesta perdida permite Reintentar misma operación sin duplicar el ajuste.


## Promos y hora de carga

En Articulo a corregir aparecen las promociones guardadas. Elegir una despliega el total actual de cada bidon incluido: corregir cada total fisico, no la cantidad de combos supuesta. Se guarda todo junto; si falta stock o cambio un saldo, no se guarda parcialmente. Las promos con articulos no retornables se indican como solo para entregas.

En Registrar bidones que ya tiene se puede elegir una promo y cuantas recibio; sus bidones se suman al conteo, junto con unidades sueltas adicionales. No repetir debajo los incluidos. Es carga historica de envases: no registra venta ni deuda. El stock se toma del origen elegido.

Las nuevas operaciones de esta planilla capturan hora del dispositivo con segundos y zona horaria al confirmar. Un reintento conserva esa captura. created_at del servidor se conserva para auditoria y orden del historial; el reloj del dispositivo puede estar mal configurado y no modifica fechas de ventas, permisos ni stock. Los registros anteriores muestran Registro del servidor sin inventar una hora de dispositivo.
