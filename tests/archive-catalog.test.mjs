import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const source = await readFile('src/data/archiveCatalog.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { archiveFileForDate, parseArchiveCatalog } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const raw = JSON.parse(await readFile('public/data/archive-index.json', 'utf8'));
const catalog = parseArchiveCatalog(raw);
assert.equal(catalog.version, 1);
assert.equal(archiveFileForDate('2026-09-28', catalog), 'snapshot-2026-09-27.json');
assert.deepEqual(catalog.entries.map((entry) => entry.sessionDate), [...catalog.entries.map((entry) => entry.sessionDate)].sort().reverse());
const files = new Set(await readdir('public/data'));
for (const entry of catalog.entries) {
  assert.ok(files.has(entry.file), `archive entry points to existing file: ${entry.file}`);
  const packet = JSON.parse(await readFile(path.join('public/data', entry.file), 'utf8'));
  assert.equal(packet.sessionDate, entry.sessionDate);
  assert.equal(packet.status, entry.status);
}
assert.throws(() => parseArchiveCatalog({ version: 1, entries: [{ sessionDate: '2026-10-07', file: '../snapshot.json', status: 'archived' }] }), /unsafe file path/);
assert.throws(() => parseArchiveCatalog({ version: 1, entries: [{ sessionDate: '2026-10-07', file: 'snapshot-1.json', status: 'archived' }, { sessionDate: '2026-10-07', file: 'snapshot-2.json', status: 'archived' }] }), /duplicate/);
console.log('PASS: archive index is safe, sorted, and points to matching dated snapshots.');
