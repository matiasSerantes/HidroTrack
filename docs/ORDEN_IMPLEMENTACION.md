# Orden recomendado para completar HidroTrack real

Fecha: 22/10/2026. Estado: propuesta de trabajo; ninguna etapa pendiente se considera terminada por aparecer en este documento.

Referencia del punto de partida: [Estado real](ESTADO_REAL.md). La base ya tiene contratos importantes; cada etapa debe reutilizarlos y extender solo lo necesario. No hacer primero todas las tablas y dejar las pantallas para el final: cerrar cada circuito con servidor, interfaz y pruebas.

## 1. Identidad del asistente y lista de choferes

Avance 22/10: codigo y contratos principales instalados; bloqueo temporal autorizado e instalado; etapa aun abierta por SMTP y validacion. Ver [detalle y bloqueo concreto](ETAPA_1_USUARIOS.md).

- Registro propio verificado y recuperacion de cuenta. Mantener nombre, ID estable y cambio de clave ya conectados.
- Vincular/desvincular por ID desde el jefe, sin recrear cuentas; un asistente puede trabajar con varios jefes.
- Aplicar cupos en servidor: basico 1, intermedio 3, superior ilimitado. Definir representacion y transiciones sin alterar licencias existentes arbitrariamente.
- Sin reparto habilitado, mostrar solo cuenta personal y datos minimos de sus vinculos.

Cierre: dos jefes pueden vincular la misma cuenta sin mezclar informacion; altas simultaneas no superan el cupo.

## 2. Invitacion y permisos del reparto

Avance 22/10: invitacion/respuesta/revocacion y resumen de lectura limitada instalados; las operaciones del chofer siguen bloqueadas hasta etapas 3/4. Ver [detalle de etapa 2](ETAPA_2_INVITACIONES.md). Validacion completa y publicacion pendientes.

- Jefe asigna; asistente ve remitente y nombre del reparto, acepta o rechaza.
- Solo la aceptacion vigente habilita clientes, carga, cobros y ubicacion de ese reparto.
- Revisar todas las politicas y funciones relacionadas; revocar o cerrar debe retirar acceso operativo.

Cierre: pruebas de aceptar, rechazar, no responder, revocar y cerrar; otra cuenta/empresa no puede leer ni operar esos datos. Esta etapa bloquea habilitar la pantalla real de recorrido.

## 3. Clientes, inventario y preparacion

Avance 24/10: carga sugerida conectada a cantidades habituales por cliente del recorrido, extras/faltantes visibles y confirmacion unica existente. Comparacion historica sugerido/extras y resto de la etapa pendientes.

Avance 22/10 parcial: dias de visita y cantidades habituales conectados en planilla, fecha de alta visible. Compilacion comprobada; guardado manual/real y demas puntos de etapa pendientes.

- Completar dias de visita, cantidades habituales, ubicacion y solicitud de visita extraordinaria.
- Verificar stock real disponible, llenos/vacios, equipos con clientes y roturas con fecha/responsable.
- Completar reparacion/retiro y cambio atomico de dispenser, conservando el historial y las condiciones del alquiler.
- Crear recorrido con carga recomendada; permitir extras y rellenar/cargar juntos en una operacion unica.
- Guardar desde aqui cantidades y costo historico de lo rellenado durante la carga, si la opcion esta activa; los graficos pueden esperar.

Cierre: preparar y cargar un reparto una sola vez, sin duplicados ni stock negativo; las unidades quedan trazables. Datos iniciales ya cargados se conservan.

## 4. Recorrido real del chofer

- Abrir reparto aceptado y continuar donde quedo al reabrir la pagina.
- Mapa y planilla; entregar, registrar devolucion parcial y actualizar saldo de envases y stock del camion.
- Calcular total, cobrar por medio de pago y tramitar deuda con aviso/aprobacion del jefe. Si la rechaza, el importe sigue pendiente de cobro.
- Ausente: volver mas tarde u otro dia. Registrar nuevos clientes durante el recorrido.
- Manejar reintentos y mala conexion sin duplicar entregas ni cobros; mostrar claramente lo pendiente de guardar.

Cierre: recorrido completo desde un celular con entregas, devoluciones y cobros correctos, incluyendo recarga de pagina y reintento.

## 5. Excepciones y seguimiento del jefe

- Alquiler mensual desde la entrega, cobro y seguimiento.
- Futura baja bloquea nuevas entregas y avisa recuperacion pendiente; no aprobar baja definitiva hasta devolver lo prestado.
- Promociones del asistente solo con permiso del jefe y notificacion; conversion o recuperacion sin perder inventario.
- Cambios de dispenser dentro del recorrido, solicitudes/aprobaciones y agregar/quitar clientes del reparto activo.
- Notificaciones y ubicacion compartida mientras corresponde al reparto autorizado.

Cierre: el jefe puede resolver cada pendiente y ambos dispositivos reflejan el resultado sin mezclar empresas.

## 6. Finalizacion, rendicion y PDF

- Conciliar carga inicial/final, llenos, vacios, dispenser entregados/cambiados/devueltos y diferencias.
- Separar efectivo a devolver, transferencias, otros cobros y deuda; finalizar con control del jefe.
- Generar PDF para ambos desde un cierre historico estable, con acceso autorizado y sin abrir la cartera general del jefe.
- Permitir otro reparto del dia solo despues del cierre correspondiente.

Cierre: totales y existencias coinciden con movimientos; PDF reproducible aunque luego cambien precios o productos.

## 7. Panel, opciones y terminacion visual

- Graficos de ingresos, gastos y resultado, mejor dia y existencias; distinguir importes cobrados, facturados y pendientes.
- Resultado usa costos historicos registrados; indicar cuando faltan costos, sin inventar ganancia.
- Repartos activos con avance y clientes nuevos.
- Foto privada de perfil y terminacion visual del asistente; revisar autenticador real y opciones de cuenta.
- Mantener celestes, botones visibles y buen uso en PC. La usabilidad movil se verifica en cada etapa, no se posterga hasta esta.

Cierre: cifras explicables desde sus movimientos y pantallas legibles en celular/PC.

## 8. Validacion de beta y publicacion

- Prueba completa con jefe y dos asistentes, incluyendo otra empresa, permisos, rechazos y revocacion.
- Revisar concurrencia, desconexion, reintentos, backup/recuperacion y seguridad completa. Los permisos basicos son obligatorios desde las primeras etapas.
- Verificar compilacion, migraciones y despliegue; probar la web publicada en celular y PC.
- Confirmar que demo y datos reales se distinguen y no se mezclan.

Cierre: circuito real de principio a fin aprobado y limitaciones conocidas documentadas antes de llamar a la version beta operativa.

## Despues, por decision actual

Optimizacion automatica de ruta corta/tiempos/distancias. Mantener apertura en app de navegacion; no presentar la linea del mapa como ruta optimizada.

## Regla para continuar desde otra PC

Empezar por la primera etapa pendiente. Antes de cada cambio, registrar la idea; al terminar, actualizar estado, verificar, hacer commit y push. Antes de una migracion real, detallar que cambia, su impacto y la autorizacion aplicable. Este plan no modifica Supabase ni autoriza por si solo operaciones remotas.

Actualizacion 22/10: bloqueo temporal autorizado explicitamente e instalado como 20261022130128_assistant_waiting_access.sql; 23 migraciones, 35 tablas con RLS. Referencias anteriores al SQL pendiente son historicas. SMTP a cargo del usuario, aun sin validar.
