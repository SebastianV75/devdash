import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { DataStore } from "./storage.js";
import {
  CAPTURE_TYPES,
  PRIORITY_LABELS,
  type Capture,
  type CaptureAddInput,
  type CaptureType,
  type DevdashData,
  type DoctorCheckResult,
  type Note,
  type Priority,
  type ProjectEntry,
  type RecentActivity,
  type Session,
  type SessionStartInput,
  type Todo,
  type TodoAddInput,
  type TodoUpdateInput,
  type TodoFilter
} from "./types.js";

export class DevdashService {
  constructor(private readonly store: DataStore) {}

  getData(): DevdashData {
    return this.store.read();
  }

  getDataFilePath(): string {
    return this.store.getFilePath();
  }

  addNote(text: string): Note {
    const trimmed = text.trim();

    if (!trimmed) {
      throw new Error('Usage: devdash note "your note"');
    }

    const data = this.store.read();
    const note: Note = {
      id: nextId(data.notes),
      text: trimmed,
      createdAt: new Date().toISOString()
    };

    data.notes.unshift(note);
    this.store.write(data);
    return note;
  }

  addCapture(input: CaptureAddInput): Capture {
    const trimmed = input.text.trim();

    if (!trimmed) {
      throw new Error(
        'Usage: devdash capture add [--type note|snippet|command] [--tag name] "text"'
      );
    }

    if (!CAPTURE_TYPES.includes(input.type)) {
      throw new Error("Capture type must be one of: note, snippet, command.");
    }

    const data = this.store.read();
    const capture: Capture = {
      id: nextId(data.captures),
      type: input.type,
      text: trimmed,
      tag: input.tag?.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    data.captures.unshift(capture);
    this.store.write(data);
    return capture;
  }

  listCaptures(limit: number, type?: CaptureType): Capture[] {
    const data = this.store.read();
    return data.captures
      .filter((capture) => (type ? capture.type === type : true))
      .slice(0, limit);
  }

  searchCaptures(query: string): Capture[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      throw new Error('Usage: devdash capture search "query"');
    }

    return this.store
      .read()
      .captures.filter((capture) =>
        `${capture.type} ${capture.tag ?? ""} ${capture.text}`
          .toLowerCase()
          .includes(normalizedQuery)
      );
  }

  addTodo(input: TodoAddInput): Todo {
    const trimmed = input.text.trim();

    if (!trimmed) {
      throw new Error(
        'Usage: devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"'
      );
    }

    const data = this.store.read();
    const todo: Todo = {
      id: nextId(data.todos),
      text: trimmed,
      done: false,
      priority: input.priority,
      dueAt: input.dueAt,
      createdAt: new Date().toISOString()
    };

    data.todos.push(todo);
    this.store.write(data);
    return todo;
  }

  listTodos(filter: TodoFilter): Todo[] {
    const data = this.store.read();
    return sortTodosForDisplay(
      data.todos.filter((todo) => matchesTodoFilter(todo, filter))
    );
  }

  completeTodo(id: number): Todo {
    const data = this.store.read();
    const todo = data.todos.find((item) => item.id === id);

    if (!todo) {
      throw new Error(`Todo #${id} not found.`);
    }

    if (!todo.done) {
      todo.done = true;
      todo.completedAt = new Date().toISOString();
      this.store.write(data);
    }

    return todo;
  }

  updateTodo(id: number, input: TodoUpdateInput): Todo {
    const data = this.store.read();
    const todo = data.todos.find((item) => item.id === id);

    if (!todo) {
      throw new Error(`Todo #${id} not found.`);
    }

    const nextText = input.text === undefined ? todo.text : input.text.trim();

    if (!nextText) {
      throw new Error('Usage: devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"');
    }

    todo.text = nextText;

    if (input.priority) {
      todo.priority = input.priority;
    }

    if (input.dueAt !== undefined) {
      todo.dueAt = input.dueAt || undefined;
    }

    this.store.write(data);
    return todo;
  }

  removeTodo(id: number): Todo {
    const data = this.store.read();
    const index = data.todos.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Todo #${id} not found.`);
    }

    const [removed] = data.todos.splice(index, 1);
    this.store.write(data);
    return removed;
  }

  getRecentActivity(limit: number): RecentActivity[] {
    const data = this.store.read();

    const activity: RecentActivity[] = [
      ...data.notes.map((note) => ({
        type: "note" as const,
        id: note.id,
        text: note.text,
        timestamp: note.createdAt
      })),
      ...data.captures.map((capture) => ({
        type: "capture" as const,
        id: capture.id,
        text: capture.text,
        timestamp: capture.createdAt
      })),
      ...data.todos.map((todo) => ({
        type: "todo-created" as const,
        id: todo.id,
        text: todo.text,
        timestamp: todo.createdAt,
        priority: todo.priority
      })),
      ...data.todos
        .filter((todo) => todo.completedAt)
        .map((todo) => ({
          type: "todo-completed" as const,
          id: todo.id,
          text: todo.text,
          timestamp: todo.completedAt ?? todo.createdAt
        })),
      ...data.sessions.map((session) => ({
        type: "session-started" as const,
        id: session.id,
        text: session.projectName,
        timestamp: session.startedAt
      }))
    ];

    return activity
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      )
      .slice(0, limit);
  }

  getProjects(query = ""): ProjectEntry[] {
    const normalizedQuery = query.trim().toLowerCase();
    const data = this.store.read();
    const historyMap = new Map(
      data.projectHistory.map((entry) => [entry.path, entry.openedAt])
    );

    return fs
      .readdirSync(this.getProjectsRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const projectPath = path.join(this.getProjectsRoot(), entry.name);
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
      .filter((project) =>
        normalizedQuery ? project.name.toLowerCase().includes(normalizedQuery) : true
      )
      .sort(sortProjects);
  }

  getProjectInfo(query: string): ProjectEntry & { folders: string[] } {
    const project = this.resolveProject(query);
    return {
      ...project,
      folders: fs
        .readdirSync(project.path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort()
    };
  }

  getProjectStack(query: string): string {
    return this.resolveProject(query).stack;
  }

  getRecentProjects(limit: number): ProjectEntry[] {
    return this.getProjects().filter((project) => project.lastOpenedAt).slice(0, limit);
  }

  openProject(query: string): ProjectEntry {
    const project = this.resolveProject(query);
    this.registerProjectOpen(project);
    return project;
  }

  launchProject(projectPath: string): void {
    const result = spawnSync("xdg-open", [projectPath], { stdio: "ignore" });

    if (result.error || result.status !== 0) {
      throw new Error("Could not launch xdg-open. Try: devdash open <name> --print-path");
    }
  }

  startSession(input: SessionStartInput): Session {
    const project = this.resolveProject(input.query);
    const data = this.store.read();
    const activeSession = data.sessions.find((session) => !session.endedAt);

    if (activeSession) {
      activeSession.endedAt = new Date().toISOString();
    }

    this.applyProjectHistory(data, project);

    const session: Session = {
      id: nextId(data.sessions),
      projectName: project.name,
      projectPath: project.path,
      note: input.note?.trim() || undefined,
      startedAt: new Date().toISOString()
    };

    data.sessions.unshift(session);
    this.store.write(data);
    return session;
  }

  stopSession(): Session | null {
    const data = this.store.read();
    const activeSession = data.sessions.find((session) => !session.endedAt);

    if (!activeSession) {
      return null;
    }

    activeSession.endedAt = new Date().toISOString();
    this.store.write(data);
    return activeSession;
  }

  getSessions(limit: number): Session[] {
    return this.store.read().sessions.slice(0, limit);
  }

  getActiveSession(): Session | undefined {
    return this.store.read().sessions.find((session) => !session.endedAt);
  }

  getTodayData(): {
    activeSession?: Session;
    pendingTodos: Todo[];
    notes: Note[];
    captures: Capture[];
    projects: ProjectEntry[];
  } {
    const data = this.store.read();

    return {
      activeSession: data.sessions.find((session) => !session.endedAt),
      pendingTodos: sortTodosForDisplay(data.todos.filter((todo) => !todo.done)).slice(0, 5),
      notes: data.notes.slice(0, 3),
      captures: data.captures.slice(0, 3),
      projects: this.getRecentProjects(3)
    };
  }

  getDoctorResults(): DoctorCheckResult[] {
    const checks = [
      { label: "node", command: "node", versionCommand: "node --version", required: true },
      { label: "npm", command: "npm", versionCommand: "npm --version", required: true },
      { label: "git", command: "git", versionCommand: "git --version", required: true },
      { label: "tsc", command: "tsc", versionCommand: "tsc --version", required: false },
      { label: "tsx", command: "tsx", versionCommand: "tsx --version", required: false },
      { label: "xdg-open", command: "xdg-open", required: false }
    ];

    return checks.map((check) => {
      const pathResult = spawnSync(
        "bash",
        ["-lc", `command -v ${shellEscape(check.command)}`],
        { encoding: "utf8" }
      );
      const executablePath = pathResult.stdout.trim();

      if (pathResult.status === 0 && executablePath) {
        const versionOutput = check.versionCommand
          ? spawnSync("bash", ["-lc", check.versionCommand], { encoding: "utf8" })
          : null;

        return {
          label: check.label,
          level: "OK" as const,
          detail:
            versionOutput && (versionOutput.stdout.trim() || versionOutput.stderr.trim())
              ? [versionOutput.stdout, versionOutput.stderr]
                  .join(" ")
                  .trim()
                  .replace(/\s+/g, " ")
              : executablePath
        };
      }

      return {
        label: check.label,
        level: check.required ? ("ERR" as const) : ("WARN" as const),
        detail: "not available"
      };
    });
  }

  getProjectsRoot(): string {
    const homeProjects = path.join(os.homedir(), "Documents", "Projects");
    return fs.existsSync(homeProjects) ? homeProjects : process.cwd();
  }

  private resolveProject(query: string): ProjectEntry {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      throw new Error("Project name is required.");
    }

    const projects = this.getProjects();
    const exactMatch = projects.find(
      (project) => project.name.toLowerCase() === normalizedQuery
    );

    if (exactMatch) {
      return exactMatch;
    }

    const partialMatches = projects.filter((project) =>
      project.name.toLowerCase().includes(normalizedQuery)
    );

    if (partialMatches.length === 1) {
      return partialMatches[0];
    }

    if (partialMatches.length > 1) {
      throw new Error(
        `Multiple projects match "${query}": ${partialMatches
          .map((project) => project.name)
          .join(", ")}`
      );
    }

    throw new Error(`Project "${query}" not found in ${this.getProjectsRoot()}`);
  }

  private registerProjectOpen(project: ProjectEntry): void {
    const data = this.store.read();
    this.applyProjectHistory(data, project);
    this.store.write(data);
  }

  private applyProjectHistory(data: DevdashData, project: Pick<ProjectEntry, "name" | "path">): void {
    data.projectHistory = [
      {
        name: project.name,
        path: project.path,
        openedAt: new Date().toISOString()
      },
      ...data.projectHistory.filter((entry) => entry.path !== project.path)
    ].slice(0, 20);
  }
}

export function parsePriority(rawPriority: string | undefined): Priority {
  if (rawPriority !== "low" && rawPriority !== "medium" && rawPriority !== "high") {
    throw new Error("Priority must be one of: low, medium, high.");
  }

  return rawPriority;
}

export function parseDueDate(rawDate: string | undefined): string {
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new Error("Due date must be in YYYY-MM-DD format.");
  }

  return `${rawDate}T23:59:59.000Z`;
}

export function parseLimit(rawLimit: string | undefined, usage: string, fallback = 5): number {
  if (!rawLimit) {
    return fallback;
  }

  const limit = Number(rawLimit);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(usage);
  }

  return limit;
}

export function parseId(rawId: string | undefined, usage: string): number {
  const id = Number(rawId);

  if (!rawId || !Number.isInteger(id) || id <= 0) {
    throw new Error(usage);
  }

  return id;
}

export function formatRelativeDate(value: string): string {
  const timestamp = new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));

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

  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatDateOnly(value: string): string {
  return value.slice(0, 10);
}

export function formatDueLabel(todo: Todo): string {
  if (!todo.dueAt) {
    return "no due date";
  }

  const dueTime = new Date(todo.dueAt).getTime();
  const diffDays = Math.ceil((dueTime - Date.now()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return `overdue since ${formatDateOnly(todo.dueAt)}`;
  }

  if (diffDays <= 1) {
    return `due ${formatDateOnly(todo.dueAt)}`;
  }

  return `due in ${diffDays}d`;
}

function detectProjectStack(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, "build.gradle.kts"))) {
    return "android/kotlin";
  }

  if (
    fs.existsSync(path.join(projectPath, "next.config.js")) ||
    fs.existsSync(path.join(projectPath, "next.config.ts"))
  ) {
    return "nextjs";
  }

  if (fs.existsSync(path.join(projectPath, "package.json"))) {
    return "node/typescript";
  }

  if (fs.existsSync(path.join(projectPath, "Cargo.toml"))) {
    return "rust";
  }

  if (
    fs.existsSync(path.join(projectPath, "pyproject.toml")) ||
    fs.existsSync(path.join(projectPath, "requirements.txt"))
  ) {
    return "python";
  }

  return "generic";
}

function sortProjects(left: ProjectEntry, right: ProjectEntry): number {
  if (left.lastOpenedAt && right.lastOpenedAt) {
    return new Date(right.lastOpenedAt).getTime() - new Date(left.lastOpenedAt).getTime();
  }

  if (left.lastOpenedAt) {
    return -1;
  }

  if (right.lastOpenedAt) {
    return 1;
  }

  return left.name.localeCompare(right.name);
}

function hasAnyFile(projectPath: string, fileNames: string[]): boolean {
  return fileNames.some((fileName) => fs.existsSync(path.join(projectPath, fileName)));
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
}

function matchesTodoFilter(todo: Todo, filter: TodoFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "open") {
    return !todo.done;
  }

  if (filter === "done") {
    return todo.done;
  }

  return !todo.done && Boolean(todo.dueAt);
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

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export { PRIORITY_LABELS };
