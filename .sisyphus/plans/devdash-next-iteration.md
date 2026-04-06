# DevDash Next Iteration Plan

## Summary

Objetivo de esta iteración: seguir profesionalizando `devdash` como herramienta local-first para Linux, priorizando acciones reales dentro de la TUI, robustez de interacción, cobertura automatizada sobre lógica crítica y un flujo de trabajo de git más sólido.

## Confirmed Decisions

- Prioridad principal: **TUI actions**
- Alcance: **incluir todo lo recomendado en un solo plan**
- Estrategia de tests: **tests-after**
- Exclusiones explícitas: **ninguna**

## Current Baseline

- `src/index.ts` concentra CLI routing, parse helpers y output formatting del modo comando.
- `src/lib/service.ts` concentra la lógica de negocio y también varios helpers puros útiles para testear (`parsePriority`, `parseDueDate`, `parseLimit`, `parseId`, `formatRelativeDate`, `formatDueLabel`).
- `src/lib/storage.ts` normaliza y persiste JSON local.
- `src/lib/tui.ts` ya está separada del CLI, pero sigue basada en key handlers directos, un estado simple (`screen`, `status`) y acciones puntuales sin selección contextual.
- `package.json` no tiene infraestructura de tests todavía: no hay `test` script, framework ni CI configurado.

## Desired Outcomes

- Poder navegar mejor dentro de la TUI sin depender solo de saltos de pantalla sueltos.
- Poder completar tareas desde la TUI y, si el diseño actual lo soporta sin romper simplicidad, editar al menos el texto o metadatos básicos de una tarea.
- Detectar y cerrar bugs residuales de input/render en la TUI.
- Introducir una base mínima y mantenible de tests automáticos para lógica y parsing.
- Dejar guardrails de git/workflow para seguir trabajando en ramas `feature/*` con checks claros.

## Constraints

- Mantener arquitectura modular actual; no volver a mezclar TUI y CLI en un único flujo monolítico.
- Reutilizar la capa de servicio desde la TUI en vez de invocar handlers CLI que imprimen a stdout.
- Evitar cambios de storage incompatibles salvo que sean estrictamente necesarios.
- Preferir mejoras incrementales de UX de terminal sobre un rediseño total.

## Implementation Strategy

1. Primero reforzar el modelo de interacción de la TUI para soportar navegación y acciones sobre todos visibles.
2. Luego exponer desde `service.ts` las operaciones mínimas que falten para completar/editar tareas sin meter lógica de negocio en `tui.ts`.
3. Después cazar bugs residuales de input/render sobre la TUI real.
4. Con el flujo estable, agregar tests automáticos para parsing y lógica de servicio.
5. Finalmente, formalizar scripts/checks y expectativas de trabajo en ramas feature.

## TODOs

- [ ] **T1 — Mejorar navegación real de la TUI**
  - Añadir un modelo de navegación más claro dentro de `src/lib/tui.ts` para moverse entre pantallas y elementos visibles.
  - Definir estado de selección/contexto en la TUI si hace falta para habilitar acciones contextuales.
  - Mantener el render limpio y predecible tras cada acción.
  - Evidence:
    - TUI abre con `dsh` o `devdash` sin degradar la navegación actual.
    - Navegación entre pantallas y elementos funciona sin artefactos visuales ni input basura.

- [ ] **T2 — Permitir completar y editar tareas desde la TUI**
  - Extender `src/lib/service.ts` con operaciones de negocio necesarias para modificar tareas de forma segura.
  - Integrar en `src/lib/tui.ts` acciones para completar tareas desde la lista activa.
  - Si el diseño incremental lo permite, soportar edición básica de tarea (texto, prioridad y/o due date) desde la TUI.
  - Mantener `src/index.ts` consistente con cualquier helper nuevo que se extraiga para parsing o validación.
  - Evidence:
    - Una tarea puede marcarse como hecha desde la TUI y el estado persiste.
    - Si se implementa edición, la tarea actualizada se rerenderiza correctamente y persiste.

- [ ] **T3 — Revisar y corregir bugs residuales de input/render en la TUI**
  - Auditar flujos de prompts en `src/lib/tui.ts` para detectar residuos de teclas, doble render, estados inconsistentes o pérdida de foco.
  - Validar cancelaciones, errores y retorno a pantalla tras acciones exitosas/fallidas.
  - Corregir cualquier bug descubierto sin reintroducir acoplamiento con handlers CLI.
  - Evidence:
    - Crear nota/todo/captura/sesión desde TUI no arrastra caracteres basura.
    - Tras éxito, cancelación o error, la pantalla queda consistente y útil.

- [ ] **T4 — Agregar base mínima de tests para lógica y parsing**
  - Introducir infraestructura de tests TypeScript-friendly (recomendado: Vitest) con el mínimo setup necesario.
  - Añadir `test` script en `package.json` y configuración mínima correspondiente.
  - Cubrir al menos helpers puros y lógica crítica de `src/lib/service.ts` y parsing relacionado desde `src/index.ts` o helpers extraídos.
  - Priorizar casos límite: inputs vacíos, formatos inválidos, defaults, límites, ids inválidos, fechas y prioridades.
  - Evidence:
    - `npm test` existe y pasa.
    - Hay tests automáticos relevantes para parsing y service logic, no tests triviales.

- [ ] **T5 — Profesionalizar flujo git y checks del proyecto**
  - Documentar o automatizar el flujo esperado para trabajar en ramas `feature/*`.
  - Dejar comandos/checks claros para validar cambios antes de merge (`build`, `check`, `test`).
  - Si encaja con el estado del repo, añadir una base de CI/workflow para ejecutar validaciones automáticamente en PRs.
  - Evidence:
    - El flujo recomendado queda explícito en documentación o scripts.
    - Queda claro cómo validar una rama antes de merge a `main`.

## Suggested Execution Order

1. T1
2. T2
3. T3
4. T4
5. T5

## Parallelization Notes

- **T1 + T2**: secuenciales, porque la edición/completado en TUI depende del modelo de navegación/selección.
- **T3**: después de T1/T2, porque debe validar el flujo resultante real.
- **T4**: parcialmente paralelizable con T3 solo si el trabajo de tests se concentra en helpers puros ya estabilizados; como plan base, mejor hacerlo después para testear la forma final.
- **T5**: puede ejecutarse al final sin bloquear funcionalidad principal.

## File Focus

- `src/lib/tui.ts` — principal foco para navegación, selección, prompts y rerender.
- `src/lib/service.ts` — foco para operaciones de negocio reutilizables y testables.
- `src/index.ts` — foco secundario para parsing helpers y consistencia del CLI.
- `src/lib/types.ts` — ampliar tipos de estado o contratos si hace falta.
- `package.json` — scripts de test/check.
- `README.md` y/o `.github/workflows/*` — documentación/automatización del flujo git/checks si aplica.

## Risks

- `src/lib/tui.ts` todavía concentra bastante comportamiento interactivo; cambios rápidos pueden volver a introducir bugs de input.
- `src/index.ts` sigue mezclando routing con parse helpers; esto dificulta testear parsing si no se extraen piezas.
- Añadir edición de tasks puede empujar a refactorizar tipos y contratos de servicio; conviene mantener alcance incremental.
- Introducir tests y CI en el mismo ciclo puede expandir el scope si no se mantiene setup mínimo.

## Definition of Done

- La TUI permite navegar mejor y operar tareas relevantes sin glitches visibles.
- Completar tareas desde TUI funciona y persiste; edición básica queda soportada si el alcance incremental lo permite sin degradar UX.
- Se validaron y corrigieron bugs residuales de input/render.
- El proyecto queda con test runner mínimo y tests útiles sobre lógica/parsing.
- El flujo de trabajo recomendado para ramas feature y validación previa a merge queda explícito.

## Final Verification Wave

- [ ] **F1 — Build + type safety**
  - `npm run build`
  - `npm run check`

- [ ] **F2 — Automated tests**
  - `npm test`
  - Verificar que cubre lógica real de `service.ts` y parsing

- [ ] **F3 — Hands-on TUI QA**
  - Probar `dsh` o `devdash` en PTY real
  - Verificar navegación, creación, completado/edición de todos y rerender

- [ ] **F4 — Workflow/documentation QA**
  - Revisar que ramas `feature/*`, checks requeridos y proceso de validación estén documentados o automatizados
  - Confirmar que el flujo propuesto es coherente con el estado actual del repo
