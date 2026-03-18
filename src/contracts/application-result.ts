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
  logs?: string[];
}

export function successResult<T>(
  data: T,
  issues: AppIssue[] = [],
  logs: string[] = [],
): ApplicationResult<T> {
  return {
    ok: true,
    data,
    issues,
    logs,
  };
}

export function failResult<T = never>(
  issues: AppIssue[],
  logs: string[] = [],
): ApplicationResult<T> {
  return {
    ok: false,
    issues,
    logs,
  };
}
