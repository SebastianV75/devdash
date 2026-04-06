export type Priority = "low" | "medium" | "high";
export type TodoFilter = "all" | "open" | "done" | "due";
export type CaptureType = "note" | "snippet" | "command";
export type TuiScreen = "home" | "todos" | "projects" | "captures" | "sessions";

export type Todo = {
  id: number;
  text: string;
  done: boolean;
  priority: Priority;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
};

export type Note = {
  id: number;
  text: string;
  createdAt: string;
};

export type Capture = {
  id: number;
  type: CaptureType;
  text: string;
  tag?: string;
  createdAt: string;
};

export type ProjectHistoryEntry = {
  name: string;
  path: string;
  openedAt: string;
};

export type Session = {
  id: number;
  projectName: string;
  projectPath: string;
  note?: string;
  startedAt: string;
  endedAt?: string;
};

export type DevdashData = {
  notes: Note[];
  todos: Todo[];
  captures: Capture[];
  projectHistory: ProjectHistoryEntry[];
  sessions: Session[];
};

export type ProjectEntry = {
  name: string;
  path: string;
  isGitRepo: boolean;
  hasReadme: boolean;
  hasPackageJson: boolean;
  hasGitIgnore: boolean;
  stack: string;
  lastOpenedAt?: string;
};

export type RecentActivity = {
  type:
    | "note"
    | "capture"
    | "todo-created"
    | "todo-completed"
    | "session-started";
  id: number;
  text: string;
  timestamp: string;
  priority?: Priority;
};

export type DoctorCheckResult = {
  label: string;
  level: "OK" | "WARN" | "ERR";
  detail: string;
};

export type TodoAddInput = {
  text: string;
  priority: Priority;
  dueAt?: string;
};

export type CaptureAddInput = {
  type: CaptureType;
  text: string;
  tag?: string;
};

export type SessionStartInput = {
  query: string;
  note?: string;
};

export const EMPTY_DATA: DevdashData = {
  notes: [],
  todos: [],
  captures: [],
  projectHistory: [],
  sessions: []
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH"
};

export const CAPTURE_TYPES: CaptureType[] = ["note", "snippet", "command"];
