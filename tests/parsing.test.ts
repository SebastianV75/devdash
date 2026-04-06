import { describe, expect, it } from "vitest";

import {
  parseCaptureAddArgs,
  parseCaptureListArgs,
  parseOpenArgs,
  parseSessionStartArgs,
  parseTodoAddArgs,
  parseTodoFilter
} from "../src/lib/parsing.js";

describe("CLI parsing helpers", () => {
  it("parses capture add arguments with type and tag", () => {
    expect(
      parseCaptureAddArgs(["--type", "command", "--tag", "git", "git", "status"])
    ).toEqual({
      type: "command",
      tag: "git",
      text: "git status"
    });
  });

  it("rejects invalid capture types", () => {
    expect(() => parseCaptureAddArgs(["--type", "weird", "hello"])).toThrow(
      "Capture type must be one of: note, snippet, command."
    );
    expect(() => parseCaptureListArgs(["--type", "weird"])).toThrow(
      "Capture type must be one of: note, snippet, command."
    );
  });

  it("parses capture list arguments", () => {
    expect(parseCaptureListArgs(["--type", "snippet", "5"])).toEqual({
      type: "snippet",
      limit: 5
    });
  });

  it("parses todo add arguments", () => {
    expect(
      parseTodoAddArgs(["--priority", "high", "--due", "2026-04-10", "finish", "project"])
    ).toEqual({
      priority: "high",
      dueAt: "2026-04-10T23:59:59.000Z",
      text: "finish project"
    });
  });

  it("parses open arguments and rejects missing project names", () => {
    expect(parseOpenArgs(["devdash", "--print-path"])).toEqual({
      query: "devdash",
      printPath: true
    });
    expect(() => parseOpenArgs(["--print-path"])).toThrow(
      "Usage: devdash open <project-name> [--print-path]"
    );
  });

  it("parses session start arguments and rejects missing names", () => {
    expect(parseSessionStartArgs(["devdash", "--note", "working"])).toEqual({
      query: "devdash",
      note: "working"
    });
    expect(() => parseSessionStartArgs(["--note", "working"])).toThrow(
      'Usage: devdash session start <project-name> [--note "text"]'
    );
  });

  it("parses todo filters", () => {
    expect(parseTodoFilter(undefined)).toBe("all");
    expect(parseTodoFilter("open")).toBe("open");
    expect(parseTodoFilter("done")).toBe("done");
    expect(parseTodoFilter("due")).toBe("due");
  });

  it("rejects invalid todo filters", () => {
    expect(() => parseTodoFilter("active")).toThrow(
      "Usage: devdash todo list [all|open|done|due]"
    );
  });
});
