import { collectDailyHighlightsFromGit, updateChangelog } from "../src/changelog.js";

async function main() {
  const workDir = process.cwd();
  const date = process.argv[2];
  const highlights = await collectDailyHighlightsFromGit(workDir, date);

  if (highlights.length === 0) {
    console.log("No core highlights inferred from git. Nothing changed.");
    return;
  }

  const result = await updateChangelog(workDir, highlights, date);
  console.log(`Updated ${result.filePath}`);
  console.log(`Date: ${result.date}`);
  console.log(`Added points: ${result.added}`);
  console.log(`Total points for date: ${result.totalForDate}`);
}

main().catch((err) => {
  console.error("Failed to update changelog:", err);
  process.exit(1);
});

