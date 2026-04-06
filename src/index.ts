#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Todo = {
  id: number;
  text: string;
  done: boolean;
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
};

const EMPTY_DATA: DevdashData = {
  notes: [],
  todos: []
};

function main(): void {
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  switch (command) {
    case "note":
      addNote(rest);
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
      listTodos();
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
  const text = args.join(" ").trim();

  if (!text) {
    fail('Usage: devdash todo add "task"');
  }

  const data = readData();
  const todo: Todo = {
    id: nextId(data.todos),
    text,
    done: false,
    createdAt: new Date().toISOString()
  };

  data.todos.push(todo);
  writeData(data);

  console.log(`Added todo #${todo.id}: ${todo.text}`);
}

function listTodos(): void {
  const data = readData();

  if (data.todos.length === 0) {
    console.log("No todos yet.");
    return;
  }

  for (const todo of data.todos) {
    const status = todo.done ? "x" : " ";
    console.log(`[${status}] ${todo.id}. ${todo.text}`);
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
  const pendingTodos = data.todos.filter((todo) => !todo.done);
  const recentNotes = data.notes.slice(0, 3);

  console.log("devdash today");
  console.log("");
  console.log(`Pending tasks: ${pendingTodos.length}`);

  if (pendingTodos.length > 0) {
    for (const todo of pendingTodos) {
      console.log(`- #${todo.id} ${todo.text}`);
    }
  }

  console.log("");
  console.log("Recent notes:");

  if (recentNotes.length === 0) {
    console.log("- No notes yet.");
    return;
  }

  for (const note of recentNotes) {
    console.log(`- #${note.id} ${note.text}`);
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
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    todos: Array.isArray(parsed.todos) ? parsed.todos : []
  };
}

function writeData(data: DevdashData): void {
  const filePath = getDataFilePath();
  const directory = path.dirname(filePath);

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

function printHelp(): void {
  console.log(`devdash

Usage:
  devdash note "text"
  devdash todo add "task"
  devdash todo list
  devdash todo done <id>
  devdash todo remove <id>
  devdash today`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
