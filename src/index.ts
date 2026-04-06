#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Priority = "low" | "medium" | "high";
type TodoFilter = "all" | "open" | "done";

type Todo = {
  id: number;
  text: string;
  done: boolean;
  priority: Priority;
  createdAt: string;
  completedAt?: string;
};

type Note = {
  id: number;
  text: string;
  createdAt: string;
};

type DevdashData = {
  notes: Note[];
  todos: Todo[];
  projectHistory: ProjectHistoryEntry[];
};

type RecentActivity = {
  type: "note" | "todo-created" | "todo-completed";
  id: number;
  text: string;
  timestamp: string;
  priority?: Priority;
};

type ProjectHistoryEntry = {
  name: string;
  path: string;
  openedAt: string;
};

type ProjectOpenOptions = {
  printPath: boolean;
};

type ProjectEntry = {
  name: string;
  path: string;
  isGitRepo: boolean;
  lastOpenedAt?: string;
};

const EMPTY_DATA: DevdashData = {
  notes: [],
  todos: [],
  projectHistory: []
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH"
};

function main(): void {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case "note":
      addNote(rest);
      return;
    case "recent":
      showRecent(rest);
      return;
    case "open":
      openProject(rest);
      return;
    case "projects":
      listProjects(rest);
      return;
    case "recent-projects":
      showRecentProjects(rest);
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
    case undefined:
      printHelp();
      return;
    default:
      fail(`Unknown command: ${command}`);
  }
}

function handleTodo(subcommand: string | undefined, args: string[]): void {
  switch (subcommand) {
    case "add":
      addTodo(args);
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
      fail("Usage: devdash todo <add|list|done|remove>");
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

function addTodo(args: string[]): void {
  const { priority, text } = parseTodoAddArgs(args);
  const data = readData();
  const todo: Todo = {
    id: nextId(data.todos),
    text,
    done: false,
    priority,
    createdAt: new Date().toISOString()
  };

  data.todos.push(todo);
  writeData(data);

  console.log(
    `Added todo #${todo.id} [${PRIORITY_LABELS[todo.priority]}]: ${todo.text}`
  );
}

function listTodos(args: string[]): void {
  const filter = parseTodoListFilter(args[0]);
  const data = readData();
  const todos = data.todos.filter((todo) => matchesFilter(todo, filter));

  if (todos.length === 0) {
    console.log(`No ${filter === "all" ? "" : `${filter} `}todos found.`.trim());
    return;
  }

  for (const todo of sortTodosForDisplay(todos)) {
    const status = todo.done ? "x" : " ";
    console.log(
      `[${status}] ${todo.id}. [${PRIORITY_LABELS[todo.priority]}] ${todo.text}`
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
  const pendingTodos = sortTodosForDisplay(data.todos.filter((todo) => !todo.done));
  const recentNotes = data.notes.slice(0, 3);
  const recentProjects = data.projectHistory.slice(0, 3);

  console.log("devdash today");
  console.log("");
  console.log(`Pending tasks: ${pendingTodos.length}`);

  if (pendingTodos.length === 0) {
    console.log("- No pending tasks.");
  } else {
    for (const todo of pendingTodos) {
      console.log(`- #${todo.id} [${PRIORITY_LABELS[todo.priority]}] ${todo.text}`);
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
    }
  }
}

function openProject(args: string[]): void {
  const { query, options } = parseOpenProjectArgs(args);
  const project = resolveProject(query);
  const data = readData();

  data.projectHistory = [
    {
      name: project.name,
      path: project.path,
      openedAt: new Date().toISOString()
    },
    ...data.projectHistory.filter((entry) => entry.path !== project.path)
  ].slice(0, 20);
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
    console.log(`${project.name} [${gitLabel}]${recentLabel}`);
    console.log(`  ${project.path}`);
  }
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
    projectHistory: Array.isArray(parsed.projectHistory)
      ? parsed.projectHistory.map(normalizeProjectHistoryEntry)
      : []
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
    createdAt: typeof todo.createdAt === "string" ? todo.createdAt : new Date(0).toISOString(),
    completedAt: typeof todo.completedAt === "string" ? todo.completedAt : undefined
  };
}

function normalizeNote(rawNote: unknown): Note {
  const note = rawNote as Partial<Note>;

  return {
    id: typeof note.id === "number" ? note.id : 0,
    text: typeof note.text === "string" ? note.text : "",
    createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date(0).toISOString()
  };
}

function normalizeProjectHistoryEntry(rawEntry: unknown): ProjectHistoryEntry {
  const entry = rawEntry as Partial<ProjectHistoryEntry>;

  return {
    name: typeof entry.name === "string" ? entry.name : "unknown",
    path: typeof entry.path === "string" ? entry.path : "",
    openedAt:
      typeof entry.openedAt === "string"
        ? entry.openedAt
        : new Date(0).toISOString()
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

function parseTodoAddArgs(args: string[]): { priority: Priority; text: string } {
  if (args.length === 0) {
    fail('Usage: devdash todo add [--priority low|medium|high] "task"');
  }

  let priority: Priority = "medium";
  const textParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--priority") {
      priority = parsePriority(args[index + 1]);
      index += 1;
      continue;
    }

    textParts.push(token);
  }

  const text = textParts.join(" ").trim();

  if (!text) {
    fail('Usage: devdash todo add [--priority low|medium|high] "task"');
  }

  return { priority, text };
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

function parseTodoListFilter(rawFilter: string | undefined): TodoFilter {
  if (!rawFilter) {
    return "all";
  }

  if (rawFilter === "all" || rawFilter === "open" || rawFilter === "done") {
    return rawFilter;
  }

  fail("Usage: devdash todo list [all|open|done]");
}

function matchesFilter(todo: Todo, filter: TodoFilter): boolean {
  if (filter === "all") {
    return true;
  }

  return filter === "done" ? todo.done : !todo.done;
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

function sortTodosForDisplay(todos: Todo[]): Todo[] {
  return [...todos].sort((left, right) => {
    const priorityOrder = priorityWeight(right.priority) - priorityWeight(left.priority);

    if (priorityOrder !== 0) {
      return priorityOrder;
    }

    return left.id - right.id;
  });
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

function buildRecentActivity(data: DevdashData): RecentActivity[] {
  const noteActivity: RecentActivity[] = data.notes.map((note) => ({
    type: "note",
    id: note.id,
    text: note.text,
    timestamp: note.createdAt
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

  return [...noteActivity, ...todoCreatedActivity, ...todoCompletedActivity].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

function parseOptionalLimit(
  rawLimit: string | undefined,
  usage: string
): number {
  if (!rawLimit) {
    return 5;
  }

  const limit = Number(rawLimit);

  if (!Number.isInteger(limit) || limit <= 0) {
    fail(usage);
  }

  return limit;
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

function printHelp(): void {
  console.log(`devdash

Usage:
  devdash note "text"
  devdash recent [limit]
  devdash open <project-name> [--print-path]
  devdash projects [query]
  devdash recent-projects [limit]
  devdash todo add [--priority low|medium|high] "task"
  devdash todo list [all|open|done]
  devdash todo done <id>
  devdash todo remove <id>
  devdash today`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
