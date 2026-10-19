# Acuerdos de trabajo

## Procedimiento obligatorio y portable

Acuerdo del usuario del 19/10/2026. Estas instrucciones viven en el repositorio para continuar desde otra PC o una sesión de Codex que tenga acceso a este mismo proyecto.

1. **Primero, anotar cada idea nueva.** Antes de editar código, registrarla con fecha en `docs/NOTAS.md`; incorporar el detalle funcional en `docs/REQUISITOS.md` cuando corresponda. Marcar su estado: propuesta, demo, implementada en producción o pendiente de validar. Conservar dudas y decisiones sin presentar suposiciones como acuerdos.
2. **Reflejar la idea en el programa.** Por defecto, incorporar la nueva idea a la demostración visual HTML que sirve la aplicación (`src/features/DemoProgram.tsx` y sus módulos), con datos ficticios; no alcanza con anotarla en el plan. Si la función ya existe, integrar la mejora en esa función y mantener coherentes su demo y documentación. La simulación no autoriza por sí sola cambios remotos en Supabase. Una regla de negocio todavía abierta puede representarse como provisoria y debe indicarse.
3. **Actualizar el estado.** Mantener `public/plan.html`, las notas y la guía de demo coherentes con el resultado; distinguir lo que se puede probar en demo de lo conectado a producción. No dejar la idea como pendiente si ya fue incorporada.
4. **Al terminar cada edición, verificar, hacer commit y push.** También aplica a cambios de notas, ideas y estas instrucciones. Ejecutar las comprobaciones apropiadas al cambio, subir la rama de trabajo y verificar que el push haya terminado. Informar el commit y cualquier bloqueo real; no afirmar que se subió algo si falló.
5. **Al retomar desde otra máquina o sesión, leer antes de trabajar.** Revisar este archivo, `docs/NOTAS.md`, requisitos, guía y estado de Git; comprobar la relación con el remoto y conservar cambios locales/ajenos. No depender de memoria del chat ni de archivos fuera del repositorio para conocer los pasos.
6. **Al finalizar el proyecto, limpiar las notas de desarrollo de la versión final.** Cuando el usuario dé por terminado el proyecto, retirar del árbol versionado y de la entrega las notas temporales de ideas/bitácora y material de referencia que ya no deba permanecer; actualizar enlaces y conservar la documentación final necesaria de uso y mantenimiento. Durante el desarrollo, las notas deben seguir en Git para permitir continuidad. Una eliminación normal conserva los commits anteriores en el historial; no reescribir ni purgar el historial, ni hacer force push, sin un pedido explícito adicional.

## Criterios generales

- **Celular y PC deben verse y funcionar bien.** Priorizar el celular no elimina el escritorio: adaptar navegación, formularios, tablas, mapas y uso del espacio a ambos. Conservar en PC la barra lateral y las vistas amplias; en móvil priorizar el flujo táctil del chofer. Comprobar ambos tamaños al modificar la interfaz.

- **Prioridad principal: celular y chofer.** La aplicación se usará mayormente desde teléfonos durante los recorridos. Diseñar primero el flujo móvil: acceso rápido al cliente, cantidades, cobro y siguiente parada; pocos pasos, controles táctiles cómodos, texto legible, buena estética y uso eficiente de red/recursos. El escritorio acompaña esta prioridad.
- Llegar primero a una beta funcional; programar la revisión completa y el endurecimiento de seguridad para esa etapa, antes del uso con datos reales. Mantener las protecciones básicas existentes durante el desarrollo y no confundir la autenticación/permisos simulados de la demo con seguridad de producción.

- Mantener `docs/NOTAS.md` actualizado con ideas, decisiones, trabajo terminado, validaciones y pendientes. Separar propuestas de decisiones confirmadas y registrar fechas.
- Antes de comenzar, leer estas notas y el estado de Git. Al cerrar una tarea, dejar anotado el resultado y el siguiente paso útil.
- Crear commits de cambios coherentes y verificados, y hacer push al remoto de la rama de trabajo al terminar cada avance. El usuario autorizó este flujo de forma permanente el 19 de octubre de 2026; no pedir confirmación rutinaria para commit o push.
- No incluir cambios ajenos, credenciales, tokens, `.env`, datos personales ni salidas de diagnóstico sin revisar en los commits. No usar force push ni descartar trabajo existente.
- Registrar qué se verificó y qué queda sin verificar. Las notas no sustituyen pruebas ni confirman cambios remotos que no se hayan comprobado.
- Para Supabase, usar el MCP autenticado. Una revisión de base es de solo lectura; la autorización para llevar notas y hacer push no amplía el alcance de cambios en la base o despliegues.
