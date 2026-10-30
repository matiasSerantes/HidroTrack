# Fecha desde que compra el cliente

1. Entrar como jefe y abrir **Clientes**.
2. Para uno existente: **Planilla > Editar datos**. Para uno nuevo: **Nuevo cliente**.
3. Completar **Cliente desde** con el dia en que empezo a comprar, aunque sea anterior a HidroTrack. Si no se conoce, dejar vacio.
4. Tocar **Guardar cliente** y abrir su planilla.

La planilla distingue **Cliente desde** (inicio del servicio) y **Cargado en HidroTrack** (fecha original de registro en la aplicacion). Editar una no modifica la otra. Las altas nuevas sugieren hoy; las fichas existentes no reciben fechas inventadas. Se admiten fechas validas desde 1900 hasta hoy, con referencia de Argentina.

Este campo no registra entregas, pagos ni deuda y no mueve inventario. Las deudas anteriores conservan su propia fecha en Cuenta corriente. Solo el jefe autorizado de la empresa puede editar la ficha mediante los permisos existentes.

Verificacion: pruebas locales de fecha, planilla y permisos SQL con datos ficticios. No se cambiaron fechas de clientes reales para probar. Revision visual autenticada en celular y PC pendiente.
