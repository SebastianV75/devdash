#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

type Priority = "low" | "medium" | "high";
type TodoFilter = "all" | "open" | "done" | "due";
type CaptureType = "note" | "snippet" | "command";

type Todo = {
  id: number;
  text: string;
  done: boolean;
  priority: Priority;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
};

type Note = {
  id: number;
  text: string;
  createdAt: string;
};

type Capture = {
  id: number;
  type: CaptureType;
  text: string;
  tag?: string;
  createdAt: string;
};

type ProjectHistoryEntry = {
  name: string;
  path: string;
  openedAt: string;
};

type Session = {
  id: number;
  projectName: string;
  projectPath: string;
  note?: string;
  startedAt: string;
  endedAt?: string;
};

type DevdashData = {
  notes: Note[];
  todos: Todo[];
  captures: Capture[];
  projectHistory: ProjectHistoryEntry[];
  sessions: Session[];
};

type RecentActivity = {
  type:
    | "note"
    | "todo-created"
    | "todo-completed"
    | "capture"
    | "session-started";
  id: number;
  text: string;
  timestamp: string;
  priority?: Priority;
};

type ProjectOpenOptions = {
  printPath: boolean;
};

type ProjectEntry = {
  name: string;
  path: string;
  isGitRepo: boolean;
  hasReadme: boolean;
  hasPackageJson: boolean;
  hasGitIgnore: boolean;
  stack: string;
  lastOpenedAt?: string;
};

type DoctorCheck = {
  label: string;
  command: string;
  versionCommand?: string;
  required: boolean;
};

type TuiScreen = "home" | "todos" | "projects" | "captures" | "sessions";

const EMPTY_DATA: DevdashData = {
  notes: [],
  todos: [],
  captures: [],
  projectHistory: [],
  sessions: []
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH"
};

const CAPTURE_TYPES: CaptureType[] = ["note", "snippet", "command"];

function main(): void {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case undefined:
      if (process.stdout.isTTY && process.stdin.isTTY) {
        startTui();
        return;
      }
      printHelp();
      return;
    case "note":
      addNote(rest);
      return;
    case "capture":
      handleCapture(rest[0], rest.slice(1));
      return;
    case "recent":
      showRecent(rest);
      return;
    case "doctor":
      runDoctor();
      return;
    case "open":
      openProject(rest);
      return;
    case "project":
      handleProject(rest[0], rest.slice(1));
      return;
    case "projects":
      listProjects(rest);
      return;
    case "recent-projects":
      showRecentProjects(rest);
      return;
    case "session":
      handleSession(rest[0], rest.slice(1));
      return;
    case "todo":
      handleTodo(rest[0], rest.slice(1));
      return;
    case "today":
      showToday();
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      fail(`Unknown command: ${command}`);
  }
}

function handleProject(subcommand: string | undefined, args: string[]): void {
  switch (subcommand) {
    case "info":
      showProjectInfo(args);
      return;
    case "stack":
      showProjectStack(args);
      return;
    default:
      fail("Usage: devdash project <info|stack> <project-name>");
  }
}

function handleSession(subcommand: string | undefined, args: string[]): void {
  switch (subcommand) {
    case "start":
      startSession(args);
      return;
    case "list":
      listSessions(args);
      return;
    default:
      fail("Usage: devdash session <start|list>");
  }
}

function handleCapture(subcommand: string | undefined, args: string[]): void {
  switch (subcommand) {
    case "add":
      addCapture(args);
      return;
    case "list":
      listCaptures(args);
      return;
    default:
      fail("Usage: devdash capture <add|list>");
  }
}

function handleTodo(subcommand: string | undefined, args: string[]): void {
  switch (subcommand) {
    case "add":
      addTodo(args);
      return;
    case "due":
      listTodos(["due"]);
      return;
    case "list":
      listTodos(args);
      return;
    case "done":
      completeTodo(args[0]);
      return;
    case "remove":
      removeTodo(args[0]);
      return;
    default:
      fail("Usage: devdash todo <add|due|list|done|remove>");
  }
}

function addNote(args: string[]): void {
  const text = args.join(" ").trim();

  if (!text) {
    fail('Usage: devdash note "your note"');
  }

  const data = readData();
  const note: Note = {
    id: nextId(data.notes),
    text,
    createdAt: new Date().toISOString()
  };

  data.notes.unshift(note);
  writeData(data);
  console.log(`Saved note #${note.id}: ${note.text}`);
}

function addCapture(args: string[]): void {
  const { type, tag, text } = parseCaptureArgs(args);
  const data = readData();
  const capture: Capture = {
    id: nextId(data.captures),
    type,
    tag,
    text,
    createdAt: new Date().toISOString()
  };

  data.captures.unshift(capture);
  writeData(data);

  const tagLabel = tag ? ` [${tag}]` : "";
  console.log(`Saved ${type}${tagLabel} #${capture.id}: ${capture.text}`);
}

function listCaptures(args: string[]): void {
  const { type, limit } = parseCaptureListArgs(args);
  const data = readData();
  const captures = data.captures
    .filter((capture) => (type ? capture.type === type : true))
    .slice(0, limit);

  if (captures.length === 0) {
    console.log("No captures found.");
    return;
  }

  for (const capture of captures) {
    const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
    console.log(
      `${formatRelativeDate(capture.createdAt)} ${capture.type}${tagLabel} #${capture.id}: ${capture.text}`
    );
  }
}

function addTodo(args: string[]): void {
  const { priority, dueAt, text } = parseTodoAddArgs(args);
  const data = readData();
  const todo: Todo = {
    id: nextId(data.todos),
    text,
    done: false,
    priority,
    dueAt,
    createdAt: new Date().toISOString()
  };

  data.todos.push(todo);
  writeData(data);

  const dueLabel = dueAt ? ` due ${formatDateOnly(dueAt)}` : "";
  console.log(
    `Added todo #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel}: ${todo.text}`
  );
}

function listTodos(args: string[]): void {
  const filter = parseTodoListFilter(args[0]);
  const data = readData();
  const todos = sortTodosForDisplay(data.todos.filter((todo) => matchesFilter(todo, filter)));

  if (todos.length === 0) {
    console.log(`No ${filter === "all" ? "" : `${filter} `}todos found.`.trim());
    return;
  }

  for (const todo of todos) {
    const status = todo.done ? "x" : " ";
    const dueLabel = todo.dueAt ? ` due:${formatDateOnly(todo.dueAt)}` : "";
    console.log(
      `[${status}] ${todo.id}. [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`
    );
  }
}

function completeTodo(rawId: string | undefined): void {
  const id = parseId(rawId, "Usage: devdash todo done <id>");
  const data = readData();
  const todo = data.todos.find((item) => item.id === id);

  if (!todo) {
    fail(`Todo #${id} not found.`);
  }

  if (todo.done) {
    console.log(`Todo #${id} is already completed.`);
    return;
  }

  todo.done = true;
  todo.completedAt = new Date().toISOString();
  writeData(data);
  console.log(`Completed todo #${todo.id}: ${todo.text}`);
}

function removeTodo(rawId: string | undefined): void {
  const id = parseId(rawId, "Usage: devdash todo remove <id>");
  const data = readData();
  const todoIndex = data.todos.findIndex((item) => item.id === id);

  if (todoIndex === -1) {
    fail(`Todo #${id} not found.`);
  }

  const [removed] = data.todos.splice(todoIndex, 1);
  writeData(data);
  console.log(`Removed todo #${removed.id}: ${removed.text}`);
}

function showToday(): void {
  const data = readData();
  const pendingTodos = sortTodosForDisplay(data.todos.filter((todo) => !todo.done)).slice(0, 5);
  const recentNotes = data.notes.slice(0, 3);
  const recentProjects = data.projectHistory.slice(0, 3);
  const activeSession = getActiveSession(data);

  console.log("devdash today");
  console.log("");

  if (activeSession) {
    console.log(
      `Active session: ${activeSession.projectName} (${formatRelativeDate(activeSession.startedAt)})`
    );
    console.log("");
  }

  console.log(`Pending tasks: ${pendingTodos.length}`);

  if (pendingTodos.length === 0) {
    console.log("- No pending tasks.");
  } else {
    for (const todo of pendingTodos) {
      const dueLabel = todo.dueAt ? ` due ${formatDateOnly(todo.dueAt)}` : "";
      console.log(
        `- #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`
      );
    }
  }

  console.log("");
  console.log("Recent notes:");

  if (recentNotes.length === 0) {
    console.log("- No notes yet.");
  } else {
    for (const note of recentNotes) {
      console.log(`- #${note.id} ${note.text}`);
    }
  }

  console.log("");
  console.log("Recent captures:");
  if (data.captures.length === 0) {
    console.log("- No captures yet.");
  } else {
    for (const capture of data.captures.slice(0, 3)) {
      console.log(`- ${capture.type}: ${capture.text}`);
    }
  }

  console.log("");
  console.log("Recent projects:");

  if (recentProjects.length === 0) {
    console.log("- No projects opened yet.");
  } else {
    for (const entry of recentProjects) {
      console.log(`- ${entry.name} (${formatRelativeDate(entry.openedAt)})`);
    }
  }
}

function showRecent(args: string[]): void {
  const limit = parseOptionalLimit(args[0], "Usage: devdash recent [limit]");
  const data = readData();
  const activity = buildRecentActivity(data).slice(0, limit);

  if (activity.length === 0) {
    console.log("No recent activity yet.");
    return;
  }

  for (const item of activity) {
    switch (item.type) {
      case "note":
        console.log(`${formatRelativeDate(item.timestamp)} note #${item.id}: ${item.text}`);
        break;
      case "capture":
        console.log(`${formatRelativeDate(item.timestamp)} capture #${item.id}: ${item.text}`);
        break;
      case "todo-created":
        console.log(
          `${formatRelativeDate(item.timestamp)} todo #${item.id} [${PRIORITY_LABELS[item.priority ?? "medium"]}] created: ${item.text}`
        );
        break;
      case "todo-completed":
        console.log(
          `${formatRelativeDate(item.timestamp)} todo #${item.id} completed: ${item.text}`
        );
        break;
      case "session-started":
        console.log(
          `${formatRelativeDate(item.timestamp)} session #${item.id} started: ${item.text}`
        );
        break;
    }
  }
}

function openProject(args: string[]): void {
  const { query, options } = parseOpenProjectArgs(args);
  const project = resolveProject(query);
  const data = readData();

  registerProjectOpen(data, project);
  writeData(data);

  if (options.printPath) {
    console.log(project.path);
    return;
  }

  const result = spawnSync("xdg-open", [project.path], { stdio: "ignore" });

  if (result.error || result.status !== 0) {
    console.log(`Project path: ${project.path}`);
    fail("Could not launch xdg-open. Try: devdash open <name> --print-path");
  }

  console.log(`Opened ${project.name}: ${project.path}`);
}

function listProjects(args: string[]): void {
  const query = args.join(" ").trim().toLowerCase();
  const data = readData();
  const projects = getProjectEntries(data).filter((project) =>
    query ? project.name.toLowerCase().includes(query) : true
  );

  if (projects.length === 0) {
    console.log(query ? `No projects found for "${query}".` : "No projects found.");
    return;
  }

  for (const project of projects) {
    const gitLabel = project.isGitRepo ? "git" : "dir";
    const recentLabel = project.lastOpenedAt
      ? ` opened ${formatRelativeDate(project.lastOpenedAt)}`
      : "";
    console.log(`${project.name} [${gitLabel}] ${project.stack}${recentLabel}`);
    console.log(`  ${project.path}`);
  }
}

function showProjectInfo(args: string[]): void {
  const query = args.join(" ").trim();

  if (!query) {
    fail("Usage: devdash project info <project-name>");
  }

  const project = getResolvedProjectEntry(query, readData());
  const childDirectories = listChildDirectories(project.path);

  console.log(`Project: ${project.name}`);
  console.log(`Path: ${project.path}`);
  console.log(`Type: ${project.isGitRepo ? "git repository" : "directory"}`);
  console.log(`Stack: ${project.stack}`);
  console.log(`package.json: ${project.hasPackageJson ? "yes" : "no"}`);
  console.log(`README: ${project.hasReadme ? "yes" : "no"}`);
  console.log(`.gitignore: ${project.hasGitIgnore ? "yes" : "no"}`);

  if (project.lastOpenedAt) {
    console.log(`Last opened: ${formatRelativeDate(project.lastOpenedAt)}`);
  }

  console.log(
    `Folders: ${childDirectories.length > 0 ? childDirectories.join(", ") : "none"}`
  );
}

function showProjectStack(args: string[]): void {
  const query = args.join(" ").trim();

  if (!query) {
    fail("Usage: devdash project stack <project-name>");
  }

  const project = getResolvedProjectEntry(query, readData());
  console.log(`${project.name}: ${project.stack}`);
}

function showRecentProjects(args: string[]): void {
  const limit = parseOptionalLimit(
    args[0],
    "Usage: devdash recent-projects [limit]"
  );
  const data = readData();
  const history = data.projectHistory.slice(0, limit);

  if (history.length === 0) {
    console.log("No recent projects yet.");
    return;
  }

  for (const entry of history) {
    console.log(`${formatRelativeDate(entry.openedAt)} ${entry.name} -> ${entry.path}`);
  }
}

function startSession(args: string[]): void {
  const { query, note } = parseSessionStartArgs(args);
  const data = readData();
  const project = resolveProject(query);
  const activeSession = getActiveSession(data);

  if (activeSession) {
    activeSession.endedAt = new Date().toISOString();
  }

  registerProjectOpen(data, project);

  const session: Session = {
    id: nextId(data.sessions),
    projectName: project.name,
    projectPath: project.path,
    note,
    startedAt: new Date().toISOString()
  };

  data.sessions.unshift(session);
  writeData(data);

  const noteLabel = note ? ` (${note})` : "";
  console.log(`Started session #${session.id}: ${session.projectName}${noteLabel}`);
}

function listSessions(args: string[]): void {
  const limit = parseOptionalLimit(args[0], "Usage: devdash session list [limit]");
  const data = readData();
  const sessions = data.sessions.slice(0, limit);

  if (sessions.length === 0) {
    console.log("No sessions yet.");
    return;
  }

  for (const session of sessions) {
    const status = session.endedAt ? "ended" : "active";
    const noteLabel = session.note ? ` - ${session.note}` : "";
    console.log(
      `${status} ${session.projectName} (${formatRelativeDate(session.startedAt)})${noteLabel}`
    );
  }
}

function runDoctor(): void {
  const checks: DoctorCheck[] = [
    { label: "node", command: "node", versionCommand: "node --version", required: true },
    { label: "npm", command: "npm", versionCommand: "npm --version", required: true },
    { label: "git", command: "git", versionCommand: "git --version", required: true },
    { label: "tsc", command: "tsc", versionCommand: "tsc --version", required: false },
    { label: "tsx", command: "tsx", versionCommand: "tsx --version", required: false },
    { label: "xdg-open", command: "xdg-open", required: false }
  ];

  console.log("devdash doctor");
  console.log("");

  for (const check of checks) {
    const pathResult = spawnSync(
      "bash",
      ["-lc", `command -v ${shellEscape(check.command)}`],
      { encoding: "utf8" }
    );
    const executablePath = pathResult.stdout.trim();
    const ok = pathResult.status === 0 && executablePath.length > 0;

    if (ok) {
      const versionOutput = check.versionCommand
        ? spawnSync("bash", ["-lc", check.versionCommand], { encoding: "utf8" })
        : null;
      const output = versionOutput
        ? [versionOutput.stdout, versionOutput.stderr].join(" ").trim().replace(/\s+/g, " ")
        : executablePath;
      console.log(`OK   ${check.label}: ${output || executablePath}`);
      continue;
    }

    const level = check.required ? "ERR" : "WARN";
    console.log(`${level} ${check.label}: not available`);
  }

  console.log("");
  console.log(`Projects root: ${getProjectsRoot()}`);
  console.log(`Data file: ${getDataFilePath()}`);
}

function startTui(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  let screen: TuiScreen = "home";

  const render = (): void => {
    const data = readData();
    process.stdout.write("\x1Bc");
    console.log("devdash");
    console.log("");
    console.log("Keys: [1] Home [2] Todos [3] Projects [4] Captures [5] Sessions [r] Refresh [q] Quit");
    console.log("");

    switch (screen) {
      case "home":
        renderTuiHome(data);
        break;
      case "todos":
        renderTuiTodos(data);
        break;
      case "projects":
        renderTuiProjects(data);
        break;
      case "captures":
        renderTuiCaptures(data);
        break;
      case "sessions":
        renderTuiSessions(data);
        break;
    }
  };

  readline.emitKeypressEvents(process.stdin, rl);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  const handleKeypress = (_: string, key: readline.Key): void => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      cleanup();
      return;
    }

    if (key.name === "r") {
      render();
      return;
    }

    if (key.name === "1") {
      screen = "home";
    } else if (key.name === "2") {
      screen = "todos";
    } else if (key.name === "3") {
      screen = "projects";
    } else if (key.name === "4") {
      screen = "captures";
    } else if (key.name === "5") {
      screen = "sessions";
    } else {
      return;
    }

    render();
  };

  const cleanup = (): void => {
    process.stdin.off("keypress", handleKeypress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    rl.close();
    process.stdout.write("\x1Bc");
  };

  process.stdin.on("keypress", handleKeypress);
  render();
}

function renderTuiHome(data: DevdashData): void {
  const activeSession = getActiveSession(data);
  const dueTodos = sortTodosForDisplay(data.todos.filter((todo) => matchesFilter(todo, "due"))).slice(0, 5);

  if (activeSession) {
    console.log(`Active session: ${activeSession.projectName}`);
    console.log(`Started: ${formatRelativeDate(activeSession.startedAt)}`);
    if (activeSession.note) {
      console.log(`Note: ${activeSession.note}`);
    }
    console.log("");
  }

  console.log("Due tasks:");
  if (dueTodos.length === 0) {
    console.log("  none");
  } else {
    for (const todo of dueTodos) {
      console.log(`  #${todo.id} ${todo.text} (${formatDueLabel(todo)})`);
    }
  }

  console.log("");
  console.log("Recent projects:");
  const projects = data.projectHistory.slice(0, 4);
  if (projects.length === 0) {
    console.log("  none");
  } else {
    for (const entry of projects) {
      console.log(`  ${entry.name} (${formatRelativeDate(entry.openedAt)})`);
    }
  }
}

function renderTuiTodos(data: DevdashData): void {
  console.log("Open todos:");
  const todos = sortTodosForDisplay(data.todos.filter((todo) => !todo.done)).slice(0, 10);

  if (todos.length === 0) {
    console.log("  none");
    return;
  }

  for (const todo of todos) {
    console.log(`  #${todo.id} [${PRIORITY_LABELS[todo.priority]}] ${todo.text}`);
    if (todo.dueAt) {
      console.log(`     due ${formatDueLabel(todo)}`);
    }
  }
}

function renderTuiProjects(data: DevdashData): void {
  console.log("Projects:");
  for (const project of getProjectEntries(data).slice(0, 10)) {
    console.log(`  ${project.name} [${project.stack}]`);
    console.log(`     ${project.path}`);
  }
}

function renderTuiCaptures(data: DevdashData): void {
  console.log("Recent captures:");
  if (data.captures.length === 0) {
    console.log("  none");
    return;
  }

  for (const capture of data.captures.slice(0, 10)) {
    const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
    console.log(`  ${capture.type}${tagLabel}: ${capture.text}`);
  }
}

function renderTuiSessions(data: DevdashData): void {
  console.log("Sessions:");
  if (data.sessions.length === 0) {
    console.log("  none");
    return;
  }

  for (const session of data.sessions.slice(0, 10)) {
    const status = session.endedAt ? "ended" : "active";
    console.log(`  ${status} ${session.projectName} (${formatRelativeDate(session.startedAt)})`);
  }
}

function readData(): DevdashData {
  const filePath = getDataFilePath();

  if (!fs.existsSync(filePath)) {
    return EMPTY_DATA;
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (!content.trim()) {
    return EMPTY_DATA;
  }

  const parsed = JSON.parse(content) as Partial<DevdashData>;

  return {
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(normalizeNote) : [],
    todos: Array.isArray(parsed.todos) ? parsed.todos.map(normalizeTodo) : [],
    captures: Array.isArray(parsed.captures) ? parsed.captures.map(normalizeCapture) : [],
    projectHistory: Array.isArray(parsed.projectHistory)
      ? parsed.projectHistory.map(normalizeProjectHistoryEntry)
      : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeSession) : []
  };
}

function writeData(data: DevdashData): void {
  const filePath = getDataFilePath();
  const directory = path.dirname(filePath);

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeTodo(rawTodo: unknown): Todo {
  const todo = rawTodo as Partial<Todo>;

  return {
    id: typeof todo.id === "number" ? todo.id : 0,
    text: typeof todo.text === "string" ? todo.text : "",
    done: Boolean(todo.done),
    priority: isPriority(todo.priority) ? todo.priority : "medium",
    createdAt:
      typeof todo.createdAt === "string" ? todo.createdAt : new Date(0).toISOString(),
    dueAt: typeof todo.dueAt === "string" ? todo.dueAt : undefined,
    completedAt: typeof todo.completedAt === "string" ? todo.completedAt : undefined
  };
}

function normalizeNote(rawNote: unknown): Note {
  const note = rawNote as Partial<Note>;

  return {
    id: typeof note.id === "number" ? note.id : 0,
    text: typeof note.text === "string" ? note.text : "",
    createdAt:
      typeof note.createdAt === "string" ? note.createdAt : new Date(0).toISOString()
  };
}

function normalizeCapture(rawCapture: unknown): Capture {
  const capture = rawCapture as Partial<Capture>;

  return {
    id: typeof capture.id === "number" ? capture.id : 0,
    type: isCaptureType(capture.type) ? capture.type : "note",
    text: typeof capture.text === "string" ? capture.text : "",
    tag: typeof capture.tag === "string" ? capture.tag : undefined,
    createdAt:
      typeof capture.createdAt === "string"
        ? capture.createdAt
        : new Date(0).toISOString()
  };
}

function normalizeProjectHistoryEntry(rawEntry: unknown): ProjectHistoryEntry {
  const entry = rawEntry as Partial<ProjectHistoryEntry>;

  return {
    name: typeof entry.name === "string" ? entry.name : "unknown",
    path: typeof entry.path === "string" ? entry.path : "",
    openedAt:
      typeof entry.openedAt === "string" ? entry.openedAt : new Date(0).toISOString()
  };
}

function normalizeSession(rawSession: unknown): Session {
  const session = rawSession as Partial<Session>;

  return {
    id: typeof session.id === "number" ? session.id : 0,
    projectName: typeof session.projectName === "string" ? session.projectName : "unknown",
    projectPath: typeof session.projectPath === "string" ? session.projectPath : "",
    note: typeof session.note === "string" ? session.note : undefined,
    startedAt:
      typeof session.startedAt === "string"
        ? session.startedAt
        : new Date(0).toISOString(),
    endedAt: typeof session.endedAt === "string" ? session.endedAt : undefined
  };
}

function getDataFilePath(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const baseDirectory = xdgDataHome
    ? xdgDataHome
    : path.join(os.homedir(), ".local", "share");

  return path.join(baseDirectory, "devdash", "data.json");
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
}

function parseId(rawId: string | undefined, usage: string): number {
  const id = Number(rawId);

  if (!rawId || !Number.isInteger(id) || id <= 0) {
    fail(usage);
  }

  return id;
}

function parseTodoAddArgs(args: string[]): {
  priority: Priority;
  dueAt?: string;
  text: string;
} {
  if (args.length === 0) {
    fail('Usage: devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"');
  }

  let priority: Priority = "medium";
  let dueAt: string | undefined;
  const textParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--priority") {
      priority = parsePriority(args[index + 1]);
      index += 1;
      continue;
    }

    if (token === "--due") {
      dueAt = parseDueDate(args[index + 1]);
      index += 1;
      continue;
    }

    textParts.push(token);
  }

  const text = textParts.join(" ").trim();

  if (!text) {
    fail('Usage: devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"');
  }

  return { priority, dueAt, text };
}

function parseCaptureArgs(args: string[]): {
  type: CaptureType;
  tag?: string;
  text: string;
} {
  if (args.length === 0) {
    fail('Usage: devdash capture add [--type note|snippet|command] [--tag name] "text"');
  }

  let type: CaptureType = "note";
  let tag: string | undefined;
  const textParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--type") {
      const value = args[index + 1];

      if (!isCaptureType(value)) {
        fail("Capture type must be one of: note, snippet, command.");
      }

      type = value;
      index += 1;
      continue;
    }

    if (token === "--tag") {
      tag = args[index + 1];
      index += 1;
      continue;
    }

    textParts.push(token);
  }

  const text = textParts.join(" ").trim();

  if (!text) {
    fail('Usage: devdash capture add [--type note|snippet|command] [--tag name] "text"');
  }

  return { type, tag, text };
}

function parseCaptureListArgs(args: string[]): {
  type?: CaptureType;
  limit: number;
} {
  let type: CaptureType | undefined;
  let limit = 10;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--type") {
      const value = args[index + 1];

      if (!isCaptureType(value)) {
        fail("Capture type must be one of: note, snippet, command.");
      }

      type = value;
      index += 1;
      continue;
    }

    limit = parseOptionalLimit(token, "Usage: devdash capture list [--type kind] [limit]");
  }

  return { type, limit };
}

function parseOpenProjectArgs(args: string[]): {
  query: string;
  options: ProjectOpenOptions;
} {
  if (args.length === 0) {
    fail("Usage: devdash open <project-name> [--print-path]");
  }

  const textParts: string[] = [];
  const options: ProjectOpenOptions = {
    printPath: false
  };

  for (const token of args) {
    if (token === "--print-path") {
      options.printPath = true;
      continue;
    }

    textParts.push(token);
  }

  const query = textParts.join(" ").trim();

  if (!query) {
    fail("Usage: devdash open <project-name> [--print-path]");
  }

  return { query, options };
}

function parseSessionStartArgs(args: string[]): { query: string; note?: string } {
  if (args.length === 0) {
    fail('Usage: devdash session start <project-name> [--note "text"]');
  }

  let note: string | undefined;
  const textParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--note") {
      note = args[index + 1];
      index += 1;
      continue;
    }

    textParts.push(token);
  }

  const query = textParts.join(" ").trim();

  if (!query) {
    fail('Usage: devdash session start <project-name> [--note "text"]');
  }

  return { query, note };
}

function parseTodoListFilter(rawFilter: string | undefined): TodoFilter {
  if (!rawFilter) {
    return "all";
  }

  if (
    rawFilter === "all" ||
    rawFilter === "open" ||
    rawFilter === "done" ||
    rawFilter === "due"
  ) {
    return rawFilter;
  }

  fail("Usage: devdash todo list [all|open|done|due]");
}

function matchesFilter(todo: Todo, filter: TodoFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "done") {
    return todo.done;
  }

  if (filter === "open") {
    return !todo.done;
  }

  return !todo.done && Boolean(todo.dueAt);
}

function parsePriority(rawPriority: string | undefined): Priority {
  if (!isPriority(rawPriority)) {
    fail("Priority must be one of: low, medium, high.");
  }

  return rawPriority;
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

function isCaptureType(value: unknown): value is CaptureType {
  return CAPTURE_TYPES.includes(value as CaptureType);
}

function sortTodosForDisplay(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    const dueOrder = compareDueDates(left, right);

    if (dueOrder !== 0) {
      return dueOrder;
    }

    const priorityOrder = priorityWeight(right.priority) - priorityWeight(left.priority);

    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.id - right.id;
  });
}

function compareDueDates(left: Todo, right: Todo): number {
  if (left.dueAt && right.dueAt) {
    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  }

  if (left.dueAt) {
    return -1;
  }

  if (right.dueAt) {
    return 1;
  }

  return 0;
}

function priorityWeight(priority: Priority): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function resolveProject(query: string): { name: string; path: string } {
  const projectsRoot = getProjectsRoot();
  const projectDirectories = getProjectEntries(readData());

  if (projectDirectories.length === 0) {
    fail(`No project directories found in ${projectsRoot}`);
  }

  const normalizedQuery = query.toLowerCase();
  const exactMatch = projectDirectories.find(
    (project) => project.name.toLowerCase() === normalizedQuery
  );

  if (exactMatch) {
    return exactMatch;
  }

  const partialMatches = projectDirectories.filter((project) =>
    project.name.toLowerCase().includes(normalizedQuery)
  );

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  if (partialMatches.length > 1) {
    fail(
      `Multiple projects match "${query}": ${partialMatches
        .map((project) => project.name)
        .join(", ")}`
    );
  }

  fail(`Project "${query}" not found in ${projectsRoot}`);
}

function getResolvedProjectEntry(query: string, data: DevdashData): ProjectEntry {
  const project = resolveProject(query);
  const fullEntry = getProjectEntries(data).find((entry) => entry.path === project.path);

  if (!fullEntry) {
    fail(`Project "${query}" not found.`);
  }

  return fullEntry;
}

function getProjectsRoot(): string {
  const homeProjects = path.join(os.homedir(), "Documents", "Projects");

  if (fs.existsSync(homeProjects)) {
    return homeProjects;
  }

  return process.cwd();
}

function getProjectEntries(data: DevdashData): ProjectEntry[] {
  const projectsRoot = getProjectsRoot();
  const historyMap = new Map(
    data.projectHistory.map((entry) => [entry.path, entry.openedAt])
  );

  return fs
    .readdirSync(projectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectPath = path.join(projectsRoot, entry.name);

      return {
        name: entry.name,
        path: projectPath,
        isGitRepo: fs.existsSync(path.join(projectPath, ".git")),
        hasReadme: hasAnyFile(projectPath, ["README.md", "readme.md", "README"]),
        hasPackageJson: fs.existsSync(path.join(projectPath, "package.json")),
        hasGitIgnore: fs.existsSync(path.join(projectPath, ".gitignore")),
        stack: detectProjectStack(projectPath),
        lastOpenedAt: historyMap.get(projectPath)
      };
    })
    .sort((left, right) => {
      if (left.lastOpenedAt && right.lastOpenedAt) {
        return (
          new Date(right.lastOpenedAt).getTime() -
          new Date(left.lastOpenedAt).getTime()
        );
      }

      if (left.lastOpenedAt) {
        return -1;
      }

      if (right.lastOpenedAt) {
        return 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function detectProjectStack(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, "build.gradle.kts"))) {
    return "android/kotlin";
  }

  if (fs.existsSync(path.join(projectPath, "next.config.js")) || fs.existsSync(path.join(projectPath, "next.config.ts"))) {
    return "nextjs";
  }

  if (fs.existsSync(path.join(projectPath, "package.json"))) {
    return "node/typescript";
  }

  if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) {
    return "rust";
  }

  if (fs.existsSync(path.join(projectPath, "pyproject.toml")) || fs.existsSync(path.join(projectPath, "requirements.txt"))) {
    return "python";
  }

  return "generic";
}

function registerProjectOpen(data: DevdashData, project: { name: string; path: string }): void {
  data.projectHistory = [
    {
      name: project.name,
      path: project.path,
      openedAt: new Date().toISOString()
    },
    ...data.projectHistory.filter((entry) => entry.path !== project.path)
  ].slice(0, 20);
}

function getActiveSession(data: DevdashData): Session | undefined {
  return data.sessions.find((session) => !session.endedAt);
}

function buildRecentActivity(data: DevdashData): RecentActivity[] {
  const noteActivity: RecentActivity[] = data.notes.map((note) => ({
    type: "note",
    id: note.id,
    text: note.text,
    timestamp: note.createdAt
  }));

  const captureActivity: RecentActivity[] = data.captures.map((capture) => ({
    type: "capture",
    id: capture.id,
    text: capture.text,
    timestamp: capture.createdAt
  }));

  const todoCreatedActivity: RecentActivity[] = data.todos.map((todo) => ({
    type: "todo-created",
    id: todo.id,
    text: todo.text,
    timestamp: todo.createdAt,
    priority: todo.priority
  }));

  const todoCompletedActivity: RecentActivity[] = data.todos
    .filter((todo) => todo.completedAt)
    .map((todo) => ({
      type: "todo-completed",
      id: todo.id,
      text: todo.text,
      timestamp: todo.completedAt ?? todo.createdAt
    }));

  const sessionActivity: RecentActivity[] = data.sessions.map((session) => ({
    type: "session-started",
    id: session.id,
    text: session.projectName,
    timestamp: session.startedAt
  }));

  return [
    ...noteActivity,
    ...captureActivity,
    ...todoCreatedActivity,
    ...todoCompletedActivity,
    ...sessionActivity
  ].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

function parseOptionalLimit(rawLimit: string | undefined, usage: string): number {
  if (!rawLimit) {
    return 5;
  }

  const limit = Number(rawLimit);

  if (!Number.isInteger(limit) || limit <= 0) {
    fail(usage);
  }

  return limit;
}

function parseDueDate(rawDate: string | undefined): string {
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    fail("Due date must be in YYYY-MM-DD format.");
  }

  return `${rawDate}T23:59:59.000Z`;
}

function formatRelativeDate(value: string): string {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDateOnly(value: string): string {
  return value.slice(0, 10);
}

function isDueSoon(todo: Todo): boolean {
  if (!todo.dueAt) {
    return false;
  }

  const dueTime = new Date(todo.dueAt).getTime();
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return dueTime <= now + threeDaysMs;
}

function formatDueLabel(todo: Todo): string {
  if (!todo.dueAt) {
    return "no due date";
  }

  const dueTime = new Date(todo.dueAt).getTime();
  const diffMs = dueTime - Date.now();

  if (diffMs < 0) {
    return `overdue since ${formatDateOnly(todo.dueAt)}`;
  }

  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0 || diffDays === 1) {
    return `due ${formatDateOnly(todo.dueAt)}`;
  }

  return `due in ${diffDays}d`;
}

function hasAnyFile(projectPath: string, fileNames: string[]): boolean {
  return fileNames.some((fileName) => fs.existsSync(path.join(projectPath, fileName)));
}

function listChildDirectories(projectPath: string): string[] {
  return fs
    .readdirSync(projectPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .sort();
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function printHelp(): void {
  console.log(`devdash

Usage:
  devdash
  devdash note "text"
  devdash capture add [--type note|snippet|command] [--tag name] "text"
  devdash capture list [--type kind] [limit]
  devdash recent [limit]
  devdash doctor
  devdash open <project-name> [--print-path]
  devdash project info <project-name>
  devdash project stack <project-name>
  devdash projects [query]
  devdash recent-projects [limit]
  devdash session start <project-name> [--note "text"]
  devdash session list [limit]
  devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"
  devdash todo due
  devdash todo list [all|open|done|due]
  devdash todo done <id>
  devdash todo remove <id>
  devdash today`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
