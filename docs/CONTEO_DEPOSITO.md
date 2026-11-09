# Editar llenos y vacíos por producto

En Catálogo y en la tabla de Inventario, cada artículo tiene Editar llenos y vacíos. Para consumibles o dispenser se muestra Editar disponibles: esos productos no admiten estado vacío.

Abrir, escribir cuántos llenos y vacíos hay físicamente en el depósito, indicar fecha y motivo, y guardar. La confirmación muestra ambos valores anteriores y nuevos. Si la suma permanece igual, solo cambia la distribución; si cambia, el total propio se corrige por esa diferencia. No se tocan existencias en clientes, camiones, promociones o equipos individualizados.

Es una corrección de conteo, no una carga del camión ni un llenado con costos. Conservar Registrar rotura para bajas por rotura y Carga de camión para salir a repartir.

Solo el jefe de la empresa con licencia vigente puede guardar. El servidor compara ambos saldos esperados y bloquea un conteo viejo si hubo un movimiento mientras se editaba. Los cambios se registran como movimientos compensatorios con fecha, motivo y actor, dentro de una transacción. Un identificador de solicitud impide duplicarlos al reintentar una respuesta perdida.

El límite es de 100.000 unidades de diferencia por estado y por ajuste. Los valores finales deben ser enteros no negativos. Un producto no retornable no acepta vacíos. No se eliminan movimientos previos ni se reemplaza el historial.

Demo: como jefe, Catálogo → Editar llenos y vacíos. Solo modifica el depósito ficticio. El asistente no ve este editor ni puede invocar el ajuste remoto.

Migración `20261109120000_depot_counts.sql`: helper privado, RPC pública SECURITY INVOKER y registro privado con RLS sin escrituras directas para usuarios. Usa las operaciones existentes de ingreso/retiro y conserva sus controles. Instalarla no cambia saldos reales.

Verificado con 180 pruebas relacionadas y compilación de entrega aislada. Casos nuevos: distribución 500/98 con 2 en clientes conserva 600; cambio posterior a 480/110 conserva las 2 en clientes y deja total 592; reintento estable, saldo viejo, negativos y rechazo a asistente/otra empresa. Chrome en 360 y 1366 px, datos ficticios, sin desborde y controles de al menos 44 px. Queda la prueba de conteo físico y guardado con la cuenta del jefe.
