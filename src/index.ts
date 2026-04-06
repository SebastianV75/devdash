#!/usr/bin/env node

import { DataStore } from "./lib/storage.js";
import {
  DevdashService,
  PRIORITY_LABELS,
  formatDateOnly,
  formatDueLabel,
  formatRelativeDate,
  parseId,
  parseLimit
} from "./lib/service.js";
import {
  parseCaptureAddArgs,
  parseCaptureListArgs,
  parseOpenArgs,
  parseSessionStartArgs,
  parseTodoAddArgs,
  parseTodoFilter
} from "./lib/parsing.js";
import { startTui } from "./lib/tui.js";
import type { CaptureType } from "./lib/types.js";

const service = new DevdashService(new DataStore());

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const [command, ...rest] = args;

    switch (command) {
      case undefined:
        if (process.stdin.isTTY && process.stdout.isTTY) {
          startTui(service);
          return;
        }
        printHelp();
        return;
      case "note":
        handleNote(rest);
        return;
      case "capture":
        handleCapture(rest);
        return;
      case "recent":
        handleRecent(rest);
        return;
      case "doctor":
        handleDoctor();
        return;
      case "open":
        handleOpen(rest);
        return;
      case "project":
        handleProject(rest);
        return;
      case "projects":
        handleProjects(rest);
        return;
      case "recent-projects":
        handleRecentProjects(rest);
        return;
      case "session":
        handleSession(rest);
        return;
      case "todo":
        handleTodo(rest);
        return;
      case "today":
        handleToday();
        return;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        return;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unknown error.");
    process.exit(1);
  }
}

function handleNote(args: string[]): void {
  const note = service.addNote(args.join(" "));
  console.log(`Saved note #${note.id}: ${note.text}`);
}

function handleCapture(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "add": {
      const { type, tag, text } = parseCaptureAddArgs(rest);
      const capture = service.addCapture({ type, tag, text });
      const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
      console.log(`Saved ${capture.type}${tagLabel} #${capture.id}: ${capture.text}`);
      return;
    }
    case "list": {
      const { type, limit } = parseCaptureListArgs(rest);
      const captures = service.listCaptures(limit, type);

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
      return;
    }
    case "search": {
      const results = service.searchCaptures(rest.join(" "));

      if (results.length === 0) {
        console.log(`No captures found for "${rest.join(" ").trim().toLowerCase()}".`);
        return;
      }

      for (const capture of results.slice(0, 20)) {
        const tagLabel = capture.tag ? ` [${capture.tag}]` : "";
        console.log(
          `${formatRelativeDate(capture.createdAt)} ${capture.type}${tagLabel} #${capture.id}: ${capture.text}`
        );
      }
      return;
    }
    default:
      throw new Error("Usage: devdash capture <add|list|search>");
  }
}

function handleRecent(args: string[]): void {
  const limit = parseLimit(args[0], "Usage: devdash recent [limit]");
  const activity = service.getRecentActivity(limit);

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

function handleDoctor(): void {
  console.log("devdash doctor");
  console.log("");
  for (const result of service.getDoctorResults()) {
    console.log(`${result.level.padEnd(4)} ${result.label}: ${result.detail}`);
  }
  console.log("");
  console.log(`Projects root: ${service.getProjectsRoot()}`);
  console.log(`Data file: ${service.getDataFilePath()}`);
}

function handleOpen(args: string[]): void {
  const { query, printPath } = parseOpenArgs(args);
  const project = service.openProject(query);

  if (printPath) {
    console.log(project.path);
    return;
  }

  service.launchProject(project.path);
  console.log(`Opened ${project.name}: ${project.path}`);
}

function handleProject(args: string[]): void {
  const [subcommand, ...rest] = args;
  const query = rest.join(" ").trim();

  switch (subcommand) {
    case "info": {
      if (!query) {
        throw new Error("Usage: devdash project info <project-name>");
      }

      const project = service.getProjectInfo(query);
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
      console.log(`Folders: ${project.folders.length > 0 ? project.folders.join(", ") : "none"}`);
      return;
    }
    case "stack":
      if (!query) {
        throw new Error("Usage: devdash project stack <project-name>");
      }
      console.log(`${query}: ${service.getProjectStack(query)}`);
      return;
    default:
      throw new Error("Usage: devdash project <info|stack> <project-name>");
  }
}

function handleProjects(args: string[]): void {
  const projects = service.getProjects(args.join(" "));

  if (projects.length === 0) {
    console.log(args.length ? `No projects found for "${args.join(" ").trim().toLowerCase()}".` : "No projects found.");
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

function handleRecentProjects(args: string[]): void {
  const limit = parseLimit(args[0], "Usage: devdash recent-projects [limit]");
  const projects = service.getRecentProjects(limit);

  if (projects.length === 0) {
    console.log("No recent projects yet.");
    return;
  }

  for (const project of projects) {
    console.log(`${formatRelativeDate(project.lastOpenedAt ?? new Date(0).toISOString())} ${project.name} -> ${project.path}`);
  }
}

function handleSession(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "start": {
      const { query, note } = parseSessionStartArgs(rest);
      const session = service.startSession({ query, note });
      const noteLabel = session.note ? ` (${session.note})` : "";
      console.log(`Started session #${session.id}: ${session.projectName}${noteLabel}`);
      return;
    }
    case "stop": {
      const session = service.stopSession();
      console.log(session ? `Stopped session #${session.id}: ${session.projectName}` : "No active session.");
      return;
    }
    case "list": {
      const limit = parseLimit(rest[0], "Usage: devdash session list [limit]");
      const sessions = service.getSessions(limit);

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
      return;
    }
    default:
      throw new Error("Usage: devdash session <start|stop|list>");
  }
}

function handleTodo(args: string[]): void {
  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case "add": {
      const todo = service.addTodo(parseTodoAddArgs(rest));
      const dueLabel = todo.dueAt ? ` due ${formatDateOnly(todo.dueAt)}` : "";
      console.log(`Added todo #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel}: ${todo.text}`);
      return;
    }
    case "due":
      printTodos(service.listTodos("due"), "No due todos found.");
      return;
    case "list": {
      const filter = parseTodoFilter(rest[0]);
      printTodos(service.listTodos(filter), `No ${filter === "all" ? "" : `${filter} `}todos found.`.trim());
      return;
    }
    case "done": {
      const todo = service.completeTodo(parseId(rest[0], "Usage: devdash todo done <id>"));
      console.log(`Completed todo #${todo.id}: ${todo.text}`);
      return;
    }
    case "remove": {
      const todo = service.removeTodo(parseId(rest[0], "Usage: devdash todo remove <id>"));
      console.log(`Removed todo #${todo.id}: ${todo.text}`);
      return;
    }
    default:
      throw new Error("Usage: devdash todo <add|due|list|done|remove>");
  }
}

function handleToday(): void {
  const today = service.getTodayData();

  console.log("devdash today");
  console.log("");

  if (today.activeSession) {
    console.log(
      `Active session: ${today.activeSession.projectName} (${formatRelativeDate(today.activeSession.startedAt)})`
    );
    console.log("");
  }

  console.log(`Pending tasks: ${today.pendingTodos.length}`);
  if (today.pendingTodos.length === 0) {
    console.log("- No pending tasks.");
  } else {
    for (const todo of today.pendingTodos) {
      const dueLabel = todo.dueAt ? ` ${formatDueLabel(todo)}` : "";
      console.log(`- #${todo.id} [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`);
    }
  }

  console.log("");
  console.log("Recent notes:");
  if (today.notes.length === 0) {
    console.log("- No notes yet.");
  } else {
    for (const note of today.notes) {
      console.log(`- #${note.id} ${note.text}`);
    }
  }

  console.log("");
  console.log("Recent captures:");
  if (today.captures.length === 0) {
    console.log("- No captures yet.");
  } else {
    for (const capture of today.captures) {
      console.log(`- ${capture.type}: ${capture.text}`);
    }
  }

  console.log("");
  console.log("Recent projects:");
  if (today.projects.length === 0) {
    console.log("- No projects opened yet.");
  } else {
    for (const project of today.projects) {
      console.log(
        `- ${project.name} (${formatRelativeDate(project.lastOpenedAt ?? new Date(0).toISOString())})`
      );
    }
  }
}

function printTodos(todos: ReturnType<typeof service.listTodos>, emptyMessage: string): void {
  if (todos.length === 0) {
    console.log(emptyMessage);
    return;
  }

  for (const todo of todos) {
    const status = todo.done ? "x" : " ";
    const dueLabel = todo.dueAt ? ` due:${formatDateOnly(todo.dueAt)}` : "";
    console.log(`[${status}] ${todo.id}. [${PRIORITY_LABELS[todo.priority]}]${dueLabel} ${todo.text}`);
  }
}

function printHelp(): void {
  console.log(`devdash

Usage:
  devdash
  devdash note "text"
  devdash capture add [--type note|snippet|command] [--tag name] "text"
  devdash capture list [--type kind] [limit]
  devdash capture search "query"
  devdash recent [limit]
  devdash doctor
  devdash open <project-name> [--print-path]
  devdash project info <project-name>
  devdash project stack <project-name>
  devdash projects [query]
  devdash recent-projects [limit]
  devdash session start <project-name> [--note "text"]
  devdash session stop
  devdash session list [limit]
  devdash todo add [--priority low|medium|high] [--due YYYY-MM-DD] "task"
  devdash todo due
  devdash todo list [all|open|done|due]
  devdash todo done <id>
  devdash todo remove <id>
  devdash today`);
}

void main();
