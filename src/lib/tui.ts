import readline from "node:readline";

import {
  DevdashService,
  formatDateOnly,
  formatDueLabel,
  formatRelativeDate,
  parseDueDate,
  parsePriority
} from "./service.js";
import { PRIORITY_LABELS, type TuiScreen } from "./types.js";

type TuiState = {
  screen: TuiScreen;
  status?: string;
};

export function startTui(service: DevdashService): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const state: TuiState = {
    screen: "home"
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
        renderTodos(service);
        break;
      case "projects":
        renderProjects(service);
        break;
      case "captures":
        renderCaptures(service);
        break;
      case "sessions":
        renderSessions(service);
        break;
    }
  };

  const setStatus = (message: string): void => {
    state.status = message;
  };

  const ask = async (question: string, actionKey?: string): Promise<string> => {
    busy = true;
    process.stdin.off("keypress", handleKeypress);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    const answer = await new Promise<string>((resolve) => {
      rl.question(question, resolve);
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on("keypress", handleKeypress);
    busy = false;

    return normalizePromptAnswer(answer.trim(), actionKey);
  };

  const perform = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      setStatus(getErrorMessage(error));
    }

    render();
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
      render();
      return;
    }

    if (key.name === "n") {
      void perform(async () => {
        const text = await ask("Note: ", "n");

        if (!text) {
          setStatus("Note canceled.");
          return;
        }

        const note = service.addNote(text);
        state.screen = "home";
        setStatus(`Saved note #${note.id}.`);
      });
      return;
    }

    if (key.name === "a") {
      void perform(async () => {
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
        setStatus(`Added todo #${todo.id}.`);
      });
      return;
    }

    if (key.name === "c") {
      void perform(async () => {
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
        setStatus(`Saved capture #${capture.id}.`);
      });
      return;
    }

    if (key.name === "s") {
      void perform(async () => {
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
        setStatus(`Started session #${session.id}.`);
      });
      return;
    }

    if (key.name === "x") {
      void perform(async () => {
        const session = service.stopSession();
        state.screen = "sessions";
        setStatus(session ? `Stopped session #${session.id}.` : "No active session.");
      });
      return;
    }

    if (key.name === "/") {
      void perform(async () => {
        const query = await ask("Capture search: ", "/");

        if (!query) {
          setStatus("Search canceled.");
          return;
        }

        state.screen = "captures";
        setStatus(`Search ready for "${query}".`);
        renderCaptureSearch(service, query);
      });
      return;
    }

    if (key.name === "1") {
      state.screen = "home";
      render();
      return;
    }

    if (key.name === "2") {
      state.screen = "todos";
      render();
      return;
    }

    if (key.name === "3") {
      state.screen = "projects";
      render();
      return;
    }

    if (key.name === "4") {
      state.screen = "captures";
      render();
      return;
    }

    if (key.name === "5") {
      state.screen = "sessions";
      render();
    }
  };

  const cleanup = (): void => {
    process.stdin.off("keypress", handleKeypress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    rl.close();
    clearScreen();
  };

  readline.emitKeypressEvents(process.stdin, rl);

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

function renderTodos(service: DevdashService): void {
  const todos = service.listTodos("open").slice(0, 10);

  console.log("Open todos:");
  if (todos.length === 0) {
    console.log("  none");
    return;
  }

  for (const todo of todos) {
    const dueLabel = todo.dueAt ? ` due ${formatDateOnly(todo.dueAt)}` : "";
    console.log(`  #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`);
  }
}

function renderProjects(service: DevdashService): void {
  console.log("Projects:");
  for (const project of service.getProjects().slice(0, 10)) {
    const recentLabel = project.lastOpenedAt
      ? ` opened ${formatRelativeDate(project.lastOpenedAt)}`
      : "";
    console.log(`  ${project.name} [${project.stack}]${recentLabel}`);
    console.log(`     ${project.path}`);
  }
}

function renderCaptures(service: DevdashService): void {
  console.log("Recent captures:");
  const captures = service.listCaptures(10);

  if (captures.length === 0) {
    console.log("  none");
    return;
  }

  for (const capture of captures) {
    const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
    console.log(`  ${capture.type}${tagLabel}: ${capture.text}`);
  }
}

function renderSessions(service: DevdashService): void {
  console.log("Sessions:");
  const sessions = service.getSessions(10);

  if (sessions.length === 0) {
    console.log("  none");
    return;
  }

  for (const session of sessions) {
    const status = session.endedAt ? "ended" : "active";
    const noteLabel = session.note ? ` - ${session.note}` : "";
    console.log(
      `  ${status} ${session.projectName} (${formatRelativeDate(session.startedAt)})${noteLabel}`
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

function normalizePromptAnswer(answer: string, actionKey?: string): string {
  if (!actionKey) {
    return answer;
  }

  return answer.startsWith(actionKey) && answer.length > actionKey.length
    ? answer.slice(actionKey.length)
    : answer;
}

function clearScreen(): void {
  process.stdout.write("\x1Bc");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
