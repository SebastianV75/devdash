import { describe, expect, it } from "vitest";

import {
  formatDueLabel,
  parseDueDate,
  parseId,
  parseLimit,
  parsePriority
} from "../src/lib/service.js";

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
