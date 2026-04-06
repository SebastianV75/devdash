import {
  parseDueDate,
  parseLimit,
  parsePriority
} from "./service.js";
import type { CaptureType, TodoFilter } from "./types.js";

export function parseCaptureAddArgs(args: string[]): {
  type: CaptureType;
  text: string;
  tag?: string;
} {
  let type: CaptureType = "note";
  let tag: string | undefined;
  const textParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--type") {
      const value = args[index + 1];
      if (value === "snippet" || value === "command" || value === "note") {
        type = value;
        index += 1;
        continue;
      }
      throw new Error("Capture type must be one of: note, snippet, command.");
    }

    if (token === "--tag") {
      tag = args[index + 1];
      index += 1;
      continue;
    }

    textParts.push(token);
  }

  return {
    type,
    tag,
    text: textParts.join(" ").trim()
  };
}

export function parseCaptureListArgs(args: string[]): { limit: number; type?: CaptureType } {
  let type: CaptureType | undefined;
  let limit = 10;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--type") {
      const value = args[index + 1];
      if (value === "snippet" || value === "command" || value === "note") {
        type = value;
        index += 1;
        continue;
      }
      throw new Error("Capture type must be one of: note, snippet, command.");
    }

    limit = parseLimit(token, "Usage: devdash capture list [--type kind] [limit]", 10);
  }

  return { limit, type };
}

export function parseTodoAddArgs(args: string[]) {
  let priority: ReturnType<typeof parsePriority> = "medium";
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

  return {
    priority,
    dueAt,
    text: textParts.join(" ").trim()
  };
}

export function parseOpenArgs(args: string[]): { query: string; printPath: boolean } {
  const textParts: string[] = [];
  let printPath = false;

  for (const token of args) {
    if (token === "--print-path") {
      printPath = true;
      continue;
    }
    textParts.push(token);
  }

  const query = textParts.join(" ").trim();

  if (!query) {
    throw new Error("Usage: devdash open <project-name> [--print-path]");
  }

  return { query, printPath };
}

export function parseSessionStartArgs(args: string[]): { query: string; note?: string } {
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
    throw new Error('Usage: devdash session start <project-name> [--note "text"]');
  }

  return { query, note };
}

export function parseTodoFilter(rawFilter: string | undefined): TodoFilter {
  if (!rawFilter) {
    return "all";
  }

  if (rawFilter === "all" || rawFilter === "open" || rawFilter === "done" || rawFilter === "due") {
    return rawFilter;
  }

  throw new Error("Usage: devdash todo list [all|open|done|due]");
}
