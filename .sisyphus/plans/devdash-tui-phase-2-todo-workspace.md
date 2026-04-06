# DevDash TUI Phase 2 Plan — Todo Workspace

## Summary

Objetivo de esta fase: convertir la pantalla de todos de la TUI en un workspace realmente utilizable sin salir a la CLI, aprovechando la navegación y acciones contextuales ya construidas en la fase anterior.

## Why This Phase

- La TUI ya permite navegar, completar y editar tareas.
- El siguiente paso natural es cerrar el flujo diario de trabajo sobre todos.
- Esto mantiene el rumbo actual sin rediseñar toda la TUI.
- Aumenta utilidad real con un alcance incremental y coherente.

## Scope

### Include
- filtros de todos dentro de la TUI (`open`, `done`, `due`, `all`)
- completar o reabrir tareas según estado
- borrar tarea seleccionada desde la TUI
- línea de detalle/contexto del item seleccionado
- comportamiento consistente de selección al cambiar filtro o mutar la lista
- tests para service y lógica nueva asociada a todos

### Exclude
- rediseño total de layout de la TUI
- edición completa de notas/capturas/proyectos/sesiones
- soporte de mouse
- múltiples paneles complejos o split views
- migraciones de storage

## Functional Goals

1. Poder cambiar el filtro visible de todos sin salir de la TUI.
2. Poder completar o reabrir una tarea con una acción contextual clara.
3. Poder borrar la tarea seleccionada con una interacción segura.
4. Mostrar el contexto útil del item seleccionado en la propia pantalla.
5. Mantener selección y rerender limpios tras cada cambio.

## Proposed UX

### Todo Filters
- Filtros disponibles:
  - `open`
  - `done`
  - `due`
  - `all`
- Atajo recomendado:
  - `f` rota el filtro actual
- Alternativa opcional si encaja con el diseño final:
  - `[` filtro anterior
  - `]` filtro siguiente

### Contextual Todo Actions
- `Enter`
  - si el todo está `open` → complete
  - si el todo está `done` → reopen
- `e`
  - editar tarea seleccionada cuando el estado lo permita
- `d`
  - borrar tarea seleccionada

### Detail Line
Mostrar una línea inferior con contexto del item seleccionado, por ejemplo:

```txt
#14 · HIGH · due 2026-04-10 · open
Actions: Enter complete · e edit · d delete · f filter
```

Si no hay items visibles:
- mostrar filtro actual
- indicar que no hay selección
- seguir mostrando acciones disponibles para cambiar filtro

## Technical Direction

### `src/lib/service.ts`
Agregar o ajustar operaciones de negocio necesarias:
- [ ] `reopenTodo(id)`
- [ ] mantener `updateTodo(id, input)` consistente con la nueva fase
- [ ] reutilizar `listTodos(filter)` como fuente principal de la vista
- [ ] decidir si `removeTodo(id)` mantiene naming actual o si se expone alias más explícito solo si aporta claridad real

### `src/lib/tui.ts`
Agregar al estado de la TUI:
- [ ] filtro actual de todos
- [ ] selección consistente basada en la lista filtrada visible

Agregar al flujo de render:
- [ ] render de encabezado con filtro activo
- [ ] render de lista según filtro actual
- [ ] línea de detalle/contexto
- [ ] acciones visibles según item y estado actual

Agregar al flujo de interacción:
- [ ] cambiar filtro
- [ ] completar/reabrir contextual con `Enter`
- [ ] borrar con confirmación mínima
- [ ] mantener selección válida tras cambiar filtro, borrar o mutar estado

### `src/lib/types.ts`
Agregar tipos solo si realmente ayudan a mantener claridad:
- [ ] tipo para filtro de la vista TUI si no conviene reutilizar directamente `TodoFilter`
- [ ] tipos auxiliares de estado si el nuevo flujo lo necesita

### Tests
Agregar cobertura enfocada en lógica útil, no tests triviales:
- [ ] `reopenTodo(id)`
- [ ] consistencia de filtros
- [ ] comportamiento de borrar
- [ ] casos límite de selección tras cambios de estado o borrado

## Implementation Order

1. introducir soporte de negocio para reabrir tareas
2. añadir estado de filtro en la TUI
3. renderizar todos según filtro actual
4. hacer `Enter` contextual para complete/reopen
5. añadir delete con confirmación
6. añadir línea de detalle/contexto
7. cubrir con tests de service/lógica asociada
8. hacer QA manual de TUI en PTY

## Risks

- La selección puede quedar inconsistente tras borrar o cambiar filtro si no se sincroniza bien.
- La confirmación de borrado puede reintroducir bugs de input si no reutiliza correctamente el flujo de prompts ya estabilizado.
- Reusar `TodoFilter` directamente puede ser suficiente, pero conviene evitar mezclar semánticas CLI/TUI si la vista necesita algo más específico.
- Si se amplía demasiado el alcance visual, esta fase podría derivar hacia un rediseño no deseado.

## Evidence Required

- `npm run build` pasa
- `npm run check` pasa
- `npm test` pasa
- QA manual en PTY confirma:
  - cambio de filtros
  - complete/reopen contextual
  - delete con confirmación
  - rerender limpio
  - selección consistente

## Definition of Done

- La pantalla de todos se puede usar como workspace principal dentro de la TUI.
- Se puede cambiar entre `open`, `done`, `due` y `all` sin salir de la TUI.
- `Enter` completa o reabre según corresponda.
- `d` borra de forma segura la tarea seleccionada.
- La línea de detalle deja claro el contexto y las acciones disponibles.
- La selección no se rompe tras mutaciones o cambios de filtro.
- Build, check, tests y QA manual quedan en verde.
