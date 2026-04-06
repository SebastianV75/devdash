import readline from "node:readline";

import {
  DevdashService,
  formatDateOnly,
  formatDueLabel,
  formatRelativeDate,
  parseDueDate,
  parsePriority
} from "./service.js";
import { PRIORITY_LABELS, type TodoFilter, type TuiScreen } from "./types.js";

type TuiState = {
  screen: TuiScreen;
  status?: string;
  selectedIndex: number;
  todoFilter: TodoFilter;
};

const SCREEN_ORDER: TuiScreen[] = ["home", "todos", "projects", "captures", "sessions"];
const TODO_FILTER_ORDER: TodoFilter[] = ["open", "due", "done", "all"];
const TODO_LIST_LIMIT = 10;

export function startTui(service: DevdashService): void {
  const state: TuiState = {
    screen: "home",
    selectedIndex: 0,
    todoFilter: "open"
  };

  let busy = false;

  const render = (): void => {
    const data = service.getData();
    clearScreen();
    console.log("DevDash~");
    console.log("");

    if (state.status) {
      console.log(state.status);
      console.log("");
    }

    console.log("Keys: [1] Home [2] Todos [3] Projects [4] Captures [5] Sessions");
    console.log("Actions: [n] Note [a] Todo [c] Capture [s] Start session [x] Stop session [/] Search capture [r] Refresh [q] Quit");
    console.log("");

    switch (state.screen) {
      case "home":
        renderHome(service);
        break;
      case "todos":
        renderTodos(service, state.todoFilter, state.selectedIndex);
        break;
      case "projects":
        renderProjects(service, state.selectedIndex);
        break;
      case "captures":
        renderCaptures(service, state.selectedIndex);
        break;
      case "sessions":
        renderSessions(service, state.selectedIndex);
        break;
    }

    if (state.screen !== "home") {
      const count = getScreenItemCount(service, state);
      console.log("");
      console.log(
        count > 0
          ? `Selection: ${state.selectedIndex + 1}/${count} · Use ↑/↓ or j/k, Tab/Shift+Tab to switch screens`
          : "Selection: no items on this screen"
      );
    }

    if (state.screen === "todos") {
      renderTodoDetailLine(service, state.todoFilter, state.selectedIndex);
    }
  };

  const setStatus = (message: string): void => {
    state.status = message;
  };

  const syncSelection = (): void => {
    const count = getScreenItemCount(service, state);

    if (count === 0) {
      state.selectedIndex = 0;
      return;
    }

    state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, count - 1));
  };

  const switchScreen = (screen: TuiScreen): void => {
    state.screen = screen;
    state.selectedIndex = 0;
    syncSelection();
    render();
  };

  const moveSelection = (delta: number): void => {
    const count = getScreenItemCount(service, state);

    if (count === 0) {
      render();
      return;
    }

    state.selectedIndex = (state.selectedIndex + delta + count) % count;
    render();
  };

  const moveScreen = (delta: number): void => {
    const currentIndex = SCREEN_ORDER.indexOf(state.screen);
    const nextIndex = (currentIndex + delta + SCREEN_ORDER.length) % SCREEN_ORDER.length;
    switchScreen(SCREEN_ORDER[nextIndex]);
  };

  const rotateTodoFilter = (delta: number): void => {
    const currentIndex = TODO_FILTER_ORDER.indexOf(state.todoFilter);
    const nextIndex = (currentIndex + delta + TODO_FILTER_ORDER.length) % TODO_FILTER_ORDER.length;
    state.todoFilter = TODO_FILTER_ORDER[nextIndex];
    state.selectedIndex = 0;
    syncSelection();
    render();
  };

  const ask = async (question: string, _actionKey?: string): Promise<string> => {
    busy = true;
    process.stdin.off("keypress", handleKeypress);

    const answer = await new Promise<string>((resolve) => {
      let value = "";

      const renderPrompt = (): void => {
        process.stdout.write(`\r\x1b[2K${question}${value}`);
      };

      const finish = (result: string): void => {
        process.stdin.off("keypress", promptHandler);
        process.stdout.write("\n");
        process.stdin.on("keypress", handleKeypress);
        busy = false;
        resolve(result);
      };

      const promptHandler = (input: string, key: readline.Key): void => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }

        if (key.name === "escape") {
          finish("");
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          finish(value);
          return;
        }

        if (key.name === "backspace") {
          value = value.slice(0, -1);
          renderPrompt();
          return;
        }

        if (!key.ctrl && !key.meta && input) {
          value += input;
          renderPrompt();
        }
      };

      process.stdin.on("keypress", promptHandler);
      renderPrompt();
    });

    return answer.trim();
  };

  const perform = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }

    render();
  };

  const queueAction = (action: () => Promise<void>): void => {
    setImmediate(() => {
      void perform(action);
    });
  };

  const handleKeypress = (_: string, key: readline.Key): void => {
    if (busy) {
      return;
    }

    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      cleanup();
      return;
    }

    if (key.name === "r") {
      syncSelection();
      render();
      return;
    }

    if (key.name === "tab") {
      moveScreen(key.shift ? -1 : 1);
      return;
    }

    if (key.name === "up" || key.name === "k") {
      moveSelection(-1);
      return;
    }

    if (key.name === "down" || key.name === "j") {
      moveSelection(1);
      return;
    }

    if (state.screen === "todos" && key.name === "f") {
      rotateTodoFilter(1);
      return;
    }

    if (state.screen === "todos" && key.name === "[") {
      rotateTodoFilter(-1);
      return;
    }

    if (state.screen === "todos" && key.name === "]") {
      rotateTodoFilter(1);
      return;
    }

    if (key.name === "n") {
      queueAction(async () => {
        const text = await ask("Note: ", "n");

        if (!text) {
          setStatus("Note canceled.");
          return;
        }

        const note = service.addNote(text);
        state.screen = "home";
        state.selectedIndex = 0;
        setStatus(`Saved note #${note.id}.`);
      });
      return;
    }

    if (key.name === "a") {
      queueAction(async () => {
        const text = await ask("Todo text: ", "a");

        if (!text) {
          setStatus("Todo canceled.");
          return;
        }

        const rawPriority = (await ask("Priority [low|medium|high] (default medium): ")) || "medium";
        const rawDueDate = await ask("Due date YYYY-MM-DD (optional): ");
        const todo = service.addTodo({
          text,
          priority: parsePriority(rawPriority),
          dueAt: rawDueDate ? parseDueDate(rawDueDate) : undefined
        });
        state.screen = "todos";
        state.selectedIndex = 0;
        setStatus(`Added todo #${todo.id}.`);
      });
      return;
    }

    if (key.name === "c") {
      queueAction(async () => {
        const text = await ask("Capture text: ", "c");

        if (!text) {
          setStatus("Capture canceled.");
          return;
        }

        const type = (await ask("Type [note|snippet|command] (default note): ")) || "note";
        const tag = await ask("Tag (optional): ");
        const capture = service.addCapture({
          text,
          type: type === "snippet" || type === "command" ? type : "note",
          tag: tag || undefined
        });
        state.screen = "captures";
        state.selectedIndex = 0;
        setStatus(`Saved capture #${capture.id}.`);
      });
      return;
    }

    if (key.name === "s") {
      queueAction(async () => {
        const query = await ask("Project name: ", "s");

        if (!query) {
          setStatus("Session canceled.");
          return;
        }

        const note = await ask("Session note (optional): ");
        const session = service.startSession({
          query,
          note: note || undefined
        });
        state.screen = "sessions";
        state.selectedIndex = 0;
        setStatus(`Started session #${session.id}.`);
      });
      return;
    }

    if (key.name === "x") {
      queueAction(async () => {
        const session = service.stopSession();
        state.screen = "sessions";
        state.selectedIndex = 0;
        setStatus(session ? `Stopped session #${session.id}.` : "No active session.");
      });
      return;
    }

    if (key.name === "/") {
      queueAction(async () => {
        const query = await ask("Capture search: ", "/");

        if (!query) {
          setStatus("Search canceled.");
          return;
        }

        state.screen = "captures";
        state.selectedIndex = 0;
        setStatus(`Search ready for "${query}".`);
        renderCaptureSearch(service, query);
      });
      return;
    }

    if (key.name === "return" && state.screen === "todos") {
      queueAction(async () => {
        const todo = getSelectedTodo(service, state.todoFilter, state.selectedIndex);

        if (!todo) {
          setStatus("No todo selected.");
          return;
        }

        if (todo.done) {
          const reopened = service.reopenTodo(todo.id);
          setStatus(`Reopened todo #${reopened.id}.`);
        } else {
          const completed = service.completeTodo(todo.id);
          setStatus(`Completed todo #${completed.id}.`);
        }

        syncSelection();
      });
      return;
    }

    if (key.name === "e" && state.screen === "todos") {
      queueAction(async () => {
        const todo = getSelectedTodo(service, state.todoFilter, state.selectedIndex);

        if (!todo) {
          setStatus("No todo selected.");
          return;
        }

        const text = await ask(`Edit todo #${todo.id} text (${todo.text}): `, "e");
        const rawPriority = await ask(
          `Priority [low|medium|high] (${todo.priority}): `
        );
        const rawDueDate = await ask(
          `Due date YYYY-MM-DD (blank keeps current, '-' clears) (${todo.dueAt ? formatDateOnly(todo.dueAt) : 'none'}): `
        );

        const updated = service.updateTodo(todo.id, {
          text: text || todo.text,
          priority: rawPriority ? parsePriority(rawPriority) : todo.priority,
          dueAt: rawDueDate ? (rawDueDate === "-" ? "" : parseDueDate(rawDueDate)) : todo.dueAt
        });

        setStatus(`Updated todo #${updated.id}.`);
        syncSelection();
      });
      return;
    }

    if (key.name === "d" && state.screen === "todos") {
      queueAction(async () => {
        const todo = getSelectedTodo(service, state.todoFilter, state.selectedIndex);

        if (!todo) {
          setStatus("No todo selected.");
          return;
        }

        const confirmation = await ask(`Delete todo #${todo.id}? [y/N]: `);

        if (confirmation.toLowerCase() !== "y") {
          setStatus("Delete canceled.");
          return;
        }

        const removed = service.removeTodo(todo.id);
        setStatus(`Deleted todo #${removed.id}.`);
        syncSelection();
      });
      return;
    }

    if (key.name === "1") {
      switchScreen("home");
      return;
    }

    if (key.name === "2") {
      switchScreen("todos");
      return;
    }

    if (key.name === "3") {
      switchScreen("projects");
      return;
    }

    if (key.name === "4") {
      switchScreen("captures");
      return;
    }

    if (key.name === "5") {
      switchScreen("sessions");
    }
  };

  const cleanup = (): void => {
    process.stdin.off("keypress", handleKeypress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    clearScreen();
  };

  readline.emitKeypressEvents(process.stdin);

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", handleKeypress);
  render();
}

function renderHome(service: DevdashService): void {
  const today = service.getTodayData();
  const dueTodos = service.listTodos("due").slice(0, 5);

  if (today.activeSession) {
    console.log(`Active session: ${today.activeSession.projectName}`);
    console.log(`Started: ${formatRelativeDate(today.activeSession.startedAt)}`);
    if (today.activeSession.note) {
      console.log(`Note: ${today.activeSession.note}`);
    }
    console.log("");
  }

  console.log("Due tasks:");
  if (dueTodos.length === 0) {
    console.log("  none");
  } else {
    for (const todo of dueTodos) {
      const dueLabel = todo.dueAt ? formatDueLabel(todo) : "no due date";
      console.log(`  #${todo.id} ${todo.text} (${dueLabel})`);
    }
  }

  console.log("");
  console.log("Recent notes:");
  if (today.notes.length === 0) {
    console.log("  none");
  } else {
    for (const note of today.notes) {
      console.log(`  #${note.id} ${note.text}`);
    }
  }

  console.log("");
  console.log("Recent captures:");
  if (today.captures.length === 0) {
    console.log("  none");
  } else {
    for (const capture of today.captures) {
      console.log(`  ${capture.type}: ${capture.text}`);
    }
  }

  console.log("");
  console.log("Recent projects:");
  if (today.projects.length === 0) {
    console.log("  none");
  } else {
    for (const project of today.projects) {
      console.log(
        `  ${project.name} (${formatRelativeDate(project.lastOpenedAt ?? new Date(0).toISOString())})`
      );
    }
  }
}

function renderTodos(service: DevdashService, filter: TodoFilter, selectedIndex: number): void {
  const todos = getVisibleTodos(service, filter);

  console.log(`Todos (${filter}):`);
  if (todos.length === 0) {
    console.log("  none");
    return;
  }

  for (const todo of todos) {
    const selectedLabel = todos[selectedIndex]?.id === todo.id ? ">" : " ";
    const dueLabel = todo.dueAt ? ` due ${formatDateOnly(todo.dueAt)}` : "";
    console.log(`${selectedLabel} #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`);
  }
}

function renderProjects(service: DevdashService, selectedIndex: number): void {
  console.log("Projects:");
  const projects = service.getProjects().slice(0, 10);

  if (projects.length === 0) {
    console.log("  none");
    return;
  }

  for (const project of projects) {
    const selectedLabel = projects[selectedIndex]?.path === project.path ? ">" : " ";
    const recentLabel = project.lastOpenedAt
      ? ` opened ${formatRelativeDate(project.lastOpenedAt)}`
      : "";
    console.log(`${selectedLabel} ${project.name} [${project.stack}]${recentLabel}`);
    console.log(`    ${project.path}`);
  }
}

function renderCaptures(service: DevdashService, selectedIndex: number): void {
  console.log("Recent captures:");
  const captures = service.listCaptures(10);

  if (captures.length === 0) {
    console.log("  none");
    return;
  }

  for (const capture of captures) {
    const selectedLabel = captures[selectedIndex]?.id === capture.id ? ">" : " ";
    const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
    console.log(`${selectedLabel} ${capture.type}${tagLabel}: ${capture.text}`);
  }
}

function renderSessions(service: DevdashService, selectedIndex: number): void {
  console.log("Sessions:");
  const sessions = service.getSessions(10);

  if (sessions.length === 0) {
    console.log("  none");
    return;
  }

  for (const session of sessions) {
    const selectedLabel = sessions[selectedIndex]?.id === session.id ? ">" : " ";
    const status = session.endedAt ? "ended" : "active";
    const noteLabel = session.note ? ` - ${session.note}` : "";
    console.log(
      `${selectedLabel} ${status} ${session.projectName} (${formatRelativeDate(session.startedAt)})${noteLabel}`
    );
  }
}

function renderCaptureSearch(service: DevdashService, query: string): void {
  const results = service.searchCaptures(query).slice(0, 10);
  clearScreen();
  console.log("DevDash~");
  console.log("");
  console.log(`Capture search: ${query}`);
  console.log("");

  if (results.length === 0) {
    console.log("No captures found.");
    return;
  }

  for (const capture of results) {
    const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
      console.log(`  ${capture.type}${tagLabel}: ${capture.text}`);
  }
}

function renderTodoDetailLine(
  service: DevdashService,
  filter: TodoFilter,
  selectedIndex: number
): void {
  const todo = getSelectedTodo(service, filter, selectedIndex);

  if (!todo) {
    console.log(`Todo filter: ${filter}`);
    console.log("Actions: Enter complete/reopen · e edit · d delete · f filter");
    return;
  }

  const status = todo.done ? "done" : "open";
  const dueLabel = todo.dueAt ? `due ${formatDateOnly(todo.dueAt)}` : "no due";
  const enterAction = todo.done ? "reopen" : "complete";
  console.log(
    `#${todo.id} · ${PRIORITY_LABELS[todo.priority]} · ${dueLabel} · ${status} · filter ${filter}`
  );
  console.log(`Actions: Enter ${enterAction} · e edit · d delete · f filter`);
}

function clearScreen(): void {
  process.stdout.write("\x1Bc");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

function getScreenItemCount(service: DevdashService, state: TuiState): number {
  switch (state.screen) {
    case "home":
      return 0;
    case "todos":
      return getVisibleTodos(service, state.todoFilter).length;
    case "projects":
      return service.getProjects().slice(0, 10).length;
    case "captures":
      return service.listCaptures(10).length;
    case "sessions":
      return service.getSessions(10).length;
  }
}

function getVisibleTodos(service: DevdashService, filter: TodoFilter) {
  return service.listTodos(filter).slice(0, TODO_LIST_LIMIT);
}

function getSelectedTodo(service: DevdashService, filter: TodoFilter, selectedIndex: number) {
  return getVisibleTodos(service, filter)[selectedIndex];
}
