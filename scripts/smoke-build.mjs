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

const isSessionDate = (value) => {
  if (
    typeof value !== "string" ||
    value.length !== 10 ||
    value[4] !== "-" ||
    value[7] !== "-"
  ) {
    return false;
  }

  return [...value].every((character, index) => {
    if (index === 4 || index === 7) return true;
    const code = character.charCodeAt(0);
    return code >= 48 && code <= 57;
  });
};

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
  !isSessionDate(snapshot.sessionDate)
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
    !isSessionDate(entry.sessionDate) ||
    typeof entry.file !== "string" ||
    entry.file.includes("/") ||
    entry.file.includes(String.fromCharCode(92))
  ) {
    throw new Error("Built archive index contains an invalid entry.");
  }

  const archivedSnapshot = JSON.parse(
    await readFile(resolve(outputRoot, "data", entry.file), "utf8"),
  );
  if (archivedSnapshot.sessionDate !== entry.sessionDate) {
    throw new Error(
      `Archive date mismatch for dist/data/${entry.file}.`,
    );
  }
}

console.log(
  `Smoke check passed: ${requiredFiles.length} required files and ${archiveIndex.entries.length} archive entries are present.`,
);
