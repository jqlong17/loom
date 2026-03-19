export type IssueLevel = "error" | "warn" | "info";

export interface AppIssue {
  level: IssueLevel;
  code: string;
  message: string;
  suggestion?: string;
}

export interface ApplicationResult<T> {
  ok: boolean;
  data?: T;
  issues: AppIssue[];
  artifacts?: string[];
  gate?: {
    shouldFail: boolean;
    reason?: string;
    level?: IssueLevel;
  };
  logs?: string[];
}

export function successResult<T>(
  data: T,
  issues: AppIssue[] = [],
  artifacts: string[] = [],
  gate: ApplicationResult<T>["gate"] = {
    shouldFail: false,
  },
  logs: string[] = [],
): ApplicationResult<T> {
  return {
    ok: true,
    data,
    issues,
    artifacts,
    gate,
    logs,
  };
}

export function failResult<T = never>(
  issues: AppIssue[],
  artifacts: string[] = [],
  gate: ApplicationResult<T>["gate"] = {
    shouldFail: true,
    level: "error",
    reason: "operation_failed",
  },
  logs: string[] = [],
): ApplicationResult<T> {
  return {
    ok: false,
    issues,
    artifacts,
    gate,
    logs,
  };
}
