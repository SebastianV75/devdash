import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  DevdashService,
  formatDueLabel,
  parseDueDate,
  parseId,
  parseLimit,
  parsePriority
} from "../src/lib/service.js";
import { DataStore } from "../src/lib/storage.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  delete process.env.XDG_DATA_HOME;
});

describe("service helpers", () => {
  it("returns the fallback limit when input is missing", () => {
    expect(parseLimit(undefined, "usage", 7)).toBe(7);
  });

  it("parses valid numeric limits", () => {
    expect(parseLimit("3", "usage")).toBe(3);
  });

  it("rejects invalid limits", () => {
    expect(() => parseLimit("0", "usage")).toThrow("usage");
    expect(() => parseLimit("1.5", "usage")).toThrow("usage");
    expect(() => parseLimit("abc", "usage")).toThrow("usage");
  });

  it("parses valid ids", () => {
    expect(parseId("4", "usage")).toBe(4);
  });

  it("rejects invalid ids", () => {
    expect(() => parseId(undefined, "usage")).toThrow("usage");
    expect(() => parseId("-2", "usage")).toThrow("usage");
  });

  it("parses valid priorities", () => {
    expect(parsePriority("low")).toBe("low");
    expect(parsePriority("medium")).toBe("medium");
    expect(parsePriority("high")).toBe("high");
  });

  it("rejects invalid priorities", () => {
    expect(() => parsePriority(undefined)).toThrow(
      "Priority must be one of: low, medium, high."
    );
    expect(() => parsePriority("urgent" as never)).toThrow(
      "Priority must be one of: low, medium, high."
    );
  });

  it("parses due dates into end-of-day UTC timestamps", () => {
    expect(parseDueDate("2026-04-10")).toBe("2026-04-10T23:59:59.000Z");
  });

  it("rejects malformed due dates", () => {
    expect(() => parseDueDate(undefined)).toThrow(
      "Due date must be in YYYY-MM-DD format."
    );
    expect(() => parseDueDate("04-10-2026")).toThrow(
      "Due date must be in YYYY-MM-DD format."
    );
  });

  it("formats due labels for overdue and upcoming todos", () => {
    const now = Date.now;

    Date.now = () => new Date("2026-04-06T12:00:00.000Z").getTime();

    expect(
      formatDueLabel({
        id: 1,
        text: "late",
        done: false,
        priority: "medium",
        createdAt: "2026-04-01T00:00:00.000Z",
        dueAt: "2026-04-04T23:59:59.000Z"
      })
    ).toBe("overdue since 2026-04-04");

    expect(
      formatDueLabel({
        id: 2,
        text: "soon",
        done: false,
        priority: "high",
        createdAt: "2026-04-01T00:00:00.000Z",
        dueAt: "2026-04-06T23:59:59.000Z"
      })
    ).toBe("due 2026-04-06");

    expect(
      formatDueLabel({
        id: 3,
        text: "later",
        done: false,
        priority: "low",
        createdAt: "2026-04-01T00:00:00.000Z",
        dueAt: "2026-04-10T23:59:59.000Z"
      })
    ).toBe("due in 5d");

    Date.now = now;
  });
});

describe("todo workspace service behavior", () => {
  it("reopens completed todos and clears completedAt", () => {
    const service = createService();
    const todo = service.addTodo({ text: "write notes", priority: "medium" });
    service.completeTodo(todo.id);

    const reopened = service.reopenTodo(todo.id);

    expect(reopened.done).toBe(false);
    expect(reopened.completedAt).toBeUndefined();
  });

  it("updates todo text and can clear due dates", () => {
    const service = createService();
    const todo = service.addTodo({
      text: "study",
      priority: "high",
      dueAt: "2026-04-20T23:59:59.000Z"
    });

    const updated = service.updateTodo(todo.id, {
      text: "study hard",
      priority: "low",
      dueAt: ""
    });

    expect(updated.text).toBe("study hard");
    expect(updated.priority).toBe("low");
    expect(updated.dueAt).toBeUndefined();
  });

  it("rejects empty todo text on update", () => {
    const service = createService();
    const todo = service.addTodo({ text: "study", priority: "medium" });

    expect(() => service.updateTodo(todo.id, { text: "   " })).toThrow(
      "Todo text cannot be empty."
    );
  });

  it("supports all todo filters after state changes", () => {
    const service = createService();
    const openTodo = service.addTodo({ text: "open task", priority: "medium" });
    const dueTodo = service.addTodo({
      text: "due task",
      priority: "high",
      dueAt: "2026-04-10T23:59:59.000Z"
    });
    const doneTodo = service.addTodo({ text: "done task", priority: "low" });
    service.completeTodo(doneTodo.id);

    expect(service.listTodos("open").map((todo) => todo.id)).toEqual([
      dueTodo.id,
      openTodo.id
    ]);
    expect(service.listTodos("due").map((todo) => todo.id)).toEqual([dueTodo.id]);
    expect(service.listTodos("done").map((todo) => todo.id)).toEqual([doneTodo.id]);
    expect(service.listTodos("all").map((todo) => todo.id)).toEqual([
      dueTodo.id,
      openTodo.id,
      doneTodo.id
    ]);
  });

  it("removes todos permanently", () => {
    const service = createService();
    const todo = service.addTodo({ text: "trash me", priority: "medium" });

    const removed = service.removeTodo(todo.id);

    expect(removed.id).toBe(todo.id);
    expect(service.listTodos("all")).toHaveLength(0);
  });
});

function createService(): DevdashService {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "devdash-service-test-"));
  tempDirs.push(tempDir);
  process.env.XDG_DATA_HOME = tempDir;
  return new DevdashService(new DataStore());
}
