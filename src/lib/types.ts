export type UserRole = "master" | "editor" | "viewer" | "none";

export type TaskStatus = "todo" | "in_progress" | "done";

export type DisplayStatus = "todo" | "in_progress" | "done" | "warning" | "delayed";

export type ViewMode = "day" | "week" | "month";

export type NavPage = "dashboard" | "gantt" | "board" | "calendar" | "alerts" | "reports" | "files" | "settings";

export type Project = {
  id: string;
  advertiser: string;
  name: string;
  campaign: string;
  vehicleCount: number;
  memo: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

export type BoardTask = {
  id: string;
  projectId: string;
  title: string;
  department: string;
  assignee: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type RoleEntry = {
  email: string;
  role: UserRole;
};

export type ProjectDraft = {
  id?: string;
  advertiser: string;
  name: string;
  campaign: string;
  vehicleCount: number;
  memo: string;
  startDate: string;
  endDate: string;
};

export type TaskDraft = {
  id?: string;
  projectId: string;
  title: string;
  department: string;
  assignee: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  memo: string;
};

export type Filters = {
  advertiser: string;
  department: string;
  assignee: string;
  status: "" | DisplayStatus;
  startDate: string;
  endDate: string;
};
