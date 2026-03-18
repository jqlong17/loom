import { simpleGit, type SimpleGit } from "simple-git";
import * as path from "path";
import type { LoomConfig } from "./config.js";

export interface GitResult {
  success: boolean;
  message: string;
  hash?: string;
}

export class GitManager {
  private git: SimpleGit;
  private config: LoomConfig;
  private workDir: string;

  constructor(workDir: string, config: LoomConfig) {
    this.git = simpleGit(workDir);
    this.config = config;
    this.workDir = workDir;
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async initIfNeeded(): Promise<void> {
    if (!(await this.isRepo())) {
      await this.git.init();
    }
  }

  async commitChanges(
    filePaths: string[],
    subject: string,
  ): Promise<GitResult> {
    if (!this.config.autoCommit) {
      return { success: true, message: "Auto-commit disabled, skipped." };
    }

    try {
      await this.initIfNeeded();

      const relativePaths = filePaths.map((fp) =>
        path.isAbsolute(fp) ? path.relative(this.workDir, fp) : fp,
      );

      await this.git.add(relativePaths);

      const status = await this.git.status();
      if (status.staged.length === 0) {
        return { success: true, message: "No staged changes to commit." };
      }

      const msg = `${this.config.commitPrefix}: ${subject}`;
      const result = await this.git.commit(msg);

      return {
        success: true,
        message: `Committed: ${msg}`,
        hash: result.commit,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Git commit failed: ${errMsg}` };
    }
  }

  async push(): Promise<GitResult> {
    if (!this.config.autoPush) {
      return { success: true, message: "Auto-push disabled, skipped." };
    }

    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length === 0) {
        return {
          success: false,
          message: "No remote configured. Skipping push.",
        };
      }

      await this.git.push("origin", this.config.branch);
      return { success: true, message: `Pushed to origin/${this.config.branch}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Git push failed: ${errMsg}` };
    }
  }

  async pull(): Promise<GitResult> {
    try {
      const remotes = await this.git.getRemotes(true);
      if (remotes.length === 0) {
        return { success: true, message: "No remote configured. Nothing to pull." };
      }

      await this.git.pull("origin", this.config.branch);
      return { success: true, message: `Pulled from origin/${this.config.branch}` };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Git pull failed: ${errMsg}` };
    }
  }

  async sync(): Promise<GitResult> {
    const pullResult = await this.pull();
    if (!pullResult.success) return pullResult;

    const pushResult = await this.push();
    return {
      success: pushResult.success,
      message: `${pullResult.message} | ${pushResult.message}`,
    };
  }

  async log(limit = 10): Promise<string> {
    try {
      const log = await this.git.log({
        maxCount: limit,
        "--grep": this.config.commitPrefix,
      });
      if (log.total === 0) return "No Loom commits found.";
      return log.all
        .map((c) => `[${c.hash.slice(0, 7)}] ${c.date} — ${c.message}`)
        .join("\n");
    } catch {
      return "Git log unavailable.";
    }
  }
}
