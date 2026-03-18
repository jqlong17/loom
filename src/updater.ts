import * as fs from "fs/promises";
import * as path from "path";
import { simpleGit } from "simple-git";

export interface UpgradeResult {
  success: boolean;
  message: string;
  details: string[];
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function upgradeFromGit(
  installRoot: string,
  dryRun: boolean,
): Promise<UpgradeResult> {
  const details: string[] = [];
  const gitDir = path.join(installRoot, ".git");
  if (!(await pathExists(gitDir))) {
    return {
      success: false,
      message: "Loom installation is not a Git repository.",
      details: [
        `Checked path: ${installRoot}`,
        "Tip: If you installed Loom via npm, use npm update instead.",
      ],
    };
  }

  const git = simpleGit(installRoot);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return {
      success: false,
      message: "Install path exists but is not a valid Git repo.",
      details: [`Path: ${installRoot}`],
    };
  }

  const status = await git.status();
  if (status.files.length > 0) {
    return {
      success: false,
      message: "Local changes detected. Aborting auto-upgrade to avoid overwrite.",
      details: [
        `Path: ${installRoot}`,
        "Please commit/stash local changes first, then retry.",
      ],
    };
  }

  const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
  const remotes = await git.getRemotes(true);
  if (remotes.length === 0) {
    return {
      success: false,
      message: "No git remote configured for Loom install.",
      details: [`Path: ${installRoot}`, "Expected remote: origin"],
    };
  }

  const before = (await git.revparse(["HEAD"])).trim();
  details.push(`Install path: ${installRoot}`);
  details.push(`Branch: ${branch}`);
  details.push(`Current commit: ${before.slice(0, 12)}`);

  if (dryRun) {
    return {
      success: true,
      message: "Dry-run completed. Loom can be upgraded via git pull.",
      details,
    };
  }

  await git.fetch("origin");
  await git.pull("origin", branch);
  const after = (await git.revparse(["HEAD"])).trim();

  details.push(`Updated commit: ${after.slice(0, 12)}`);
  if (before === after) {
    return {
      success: true,
      message: "Loom is already up to date.",
      details,
    };
  }

  return {
    success: true,
    message: "Loom upgraded successfully from GitHub.",
    details,
  };
}
