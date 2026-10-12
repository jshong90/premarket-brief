import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot = resolve("dist");
const requiredFiles = [
  "index.html",
  "premarket.html",
  "archive.html",
  "briefing-builder.html",
  "data/snapshot.json",
  "data/archive-index.json",
];

for (const relativePath of requiredFiles) {
  const content = await readFile(resolve(outputRoot, relativePath), "utf8");
  if (!content.trim()) {
    throw new Error(`Built output is empty: dist/${relativePath}`);
  }
}

const snapshot = JSON.parse(
  await readFile(resolve(outputRoot, "data/snapshot.json"), "utf8"),
);
if (
  !snapshot ||
  Array.isArray(snapshot) ||
  typeof snapshot !== "object" ||
  !/^\\d{4}-\\d{2}-\\d{2}$/.test(snapshot.sessionDate ?? "")
) {
  throw new Error("Built snapshot JSON is missing a valid sessionDate.");
}

const archiveIndex = JSON.parse(
  await readFile(resolve(outputRoot, "data/archive-index.json"), "utf8"),
);
if (
  archiveIndex?.version !== 1 ||
  !Array.isArray(archiveIndex.entries)
) {
  throw new Error("Built archive index does not match the expected format.");
}

for (const entry of archiveIndex.entries) {
  if (
    !/^\\d{4}-\\d{2}-\\d{2}$/.test(entry.sessionDate ?? "") ||
    typeof entry.file !== "string" ||
    entry.file.includes("/") ||
    entry.file.includes("\\\\")
  ) {
    throw new Error("Built archive index contains an invalid entry.");
  }
  await readFile(resolve(outputRoot, "data", entry.file), "utf8");
}

console.log(
  `Smoke check passed: ${requiredFiles.length} required files and ${archiveIndex.entries.length} archive entries are present.`,
);
