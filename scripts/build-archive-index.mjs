import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public', 'data');
const files = (await readdir(dataDir)).filter((file) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file));
const entries = [];

for (const file of files) {
  try {
    const snapshot = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.sessionDate) || !['archived', 'partial', 'imported', 'frozen'].includes(snapshot.status)) continue;
    entries.push({ sessionDate: snapshot.sessionDate, file, status: snapshot.status });
  } catch (error) {
    throw new Error(`Could not read archive snapshot ${file}.`, { cause: error });
  }
}

entries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
await writeFile(path.join(dataDir, 'archive-index.json'), `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
console.log(`Indexed ${entries.length} dated snapshots.`);
