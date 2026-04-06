import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  type Capture,
  type DevdashData,
  type Note,
  type ProjectHistoryEntry,
  type Session,
  type Todo,
  EMPTY_DATA
} from "./types.js";

export class DataStore {
  read(): DevdashData {
    const filePath = this.getFilePath();

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
      captures: Array.isArray(parsed.captures)
        ? parsed.captures.map(normalizeCapture)
        : [],
      projectHistory: Array.isArray(parsed.projectHistory)
        ? parsed.projectHistory.map(normalizeProjectHistoryEntry)
        : [],
      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions.map(normalizeSession)
        : []
    };
  }

  write(data: DevdashData): void {
    const filePath = this.getFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  getFilePath(): string {
    const baseDirectory = process.env.XDG_DATA_HOME
      ? process.env.XDG_DATA_HOME
      : path.join(os.homedir(), ".local", "share");

    return path.join(baseDirectory, "devdash", "data.json");
  }
}

function normalizeTodo(raw: unknown): Todo {
  const todo = raw as Partial<Todo>;

  return {
    id: typeof todo.id === "number" ? todo.id : 0,
    text: typeof todo.text === "string" ? todo.text : "",
    done: Boolean(todo.done),
    priority:
      todo.priority === "low" || todo.priority === "medium" || todo.priority === "high"
        ? todo.priority
        : "medium",
    createdAt:
      typeof todo.createdAt === "string" ? todo.createdAt : new Date(0).toISOString(),
    dueAt: typeof todo.dueAt === "string" ? todo.dueAt : undefined,
    completedAt: typeof todo.completedAt === "string" ? todo.completedAt : undefined
  };
}

function normalizeNote(raw: unknown): Note {
  const note = raw as Partial<Note>;

  return {
    id: typeof note.id === "number" ? note.id : 0,
    text: typeof note.text === "string" ? note.text : "",
    createdAt:
      typeof note.createdAt === "string" ? note.createdAt : new Date(0).toISOString()
  };
}

function normalizeCapture(raw: unknown): Capture {
  const capture = raw as Partial<Capture>;

  return {
    id: typeof capture.id === "number" ? capture.id : 0,
    type:
      capture.type === "note" ||
      capture.type === "snippet" ||
      capture.type === "command"
        ? capture.type
        : "note",
    text: typeof capture.text === "string" ? capture.text : "",
    tag: typeof capture.tag === "string" ? capture.tag : undefined,
    createdAt:
      typeof capture.createdAt === "string"
        ? capture.createdAt
        : new Date(0).toISOString()
  };
}

function normalizeProjectHistoryEntry(raw: unknown): ProjectHistoryEntry {
  const entry = raw as Partial<ProjectHistoryEntry>;

  return {
    name: typeof entry.name === "string" ? entry.name : "unknown",
    path: typeof entry.path === "string" ? entry.path : "",
    openedAt:
      typeof entry.openedAt === "string" ? entry.openedAt : new Date(0).toISOString()
  };
}

function normalizeSession(raw: unknown): Session {
  const session = raw as Partial<Session>;

  return {
    id: typeof session.id === "number" ? session.id : 0,
    projectName:
      typeof session.projectName === "string" ? session.projectName : "unknown",
    projectPath: typeof session.projectPath === "string" ? session.projectPath : "",
    note: typeof session.note === "string" ? session.note : undefined,
    startedAt:
      typeof session.startedAt === "string"
        ? session.startedAt
        : new Date(0).toISOString(),
    endedAt: typeof session.endedAt === "string" ? session.endedAt : undefined
  };
}
