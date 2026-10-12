import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest } from './collection.mjs';
import { validatePacket } from './snapshot.mjs';

export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}
export async function archiveIndex(dataDir) {
  const entries = [];
  for (const file of await fs.readdir(dataDir)) {
    if (!/^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(file)) continue;
    const packet = await readJson(path.join(dataDir, file));
    if (!['archived', 'partial', 'imported', 'frozen'].includes(packet.status)) continue;
    entries.push({ sessionDate: packet.sessionDate, file, status: packet.status });
  }
  entries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  await writeJson(path.join(dataDir, 'archive-index.json'), { version: 1, entries });
}
export async function applyCandidate(dataDir, candidate, expectedHash) {
  await fs.mkdir(dataDir, { recursive: true });
  const lockPath = path.join(dataDir, '.snapshot.lock');
  const lock = await fs.open(lockPath, 'wx');
  let archivePath, createdArchive = false;
  const currentPath = path.join(dataDir, 'snapshot.json');
  const indexPath = path.join(dataDir, 'archive-index.json');
  let original, originalIndex;
  try {
    original = await fs.readFile(currentPath);
    originalIndex = await fs.readFile(indexPath).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
    const current = JSON.parse(original);
    if (!expectedHash || digest(current) !== expectedHash) throw new Error('Snapshot changed since preparation; regenerate the candidate');
    const next = candidate.draft ?? candidate;
    validatePacket(next);
    if (candidate.archive) {
      validatePacket(candidate.archive);
      if (candidate.archive.sessionDate !== current.sessionDate || next.sessionDate <= current.sessionDate || next.previousArchiveDate !== current.sessionDate) throw new Error('Invalid rollover linkage');
      const expectedArchive = { ...current, status: current.status === 'draft' ? 'archived' : current.status };
      if (digest(candidate.archive) !== digest(expectedArchive)) throw new Error('Archive must preserve the current packet');
      archivePath = path.join(dataDir, `snapshot-${current.sessionDate}.json`);
      try {
        await fs.writeFile(archivePath, `${JSON.stringify(candidate.archive, null, 2)}\n`, { flag: 'wx' });
        createdArchive = true;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (digest(await readJson(archivePath)) !== digest(candidate.archive)) throw new Error('Refusing to overwrite a different dated archive');
      }
    } else if (next.sessionDate !== current.sessionDate) throw new Error('New dates require a rollover transaction');
    await writeJson(currentPath, next);
    await archiveIndex(dataDir);
  } catch (e) {
    if (original) await fs.writeFile(currentPath, original);
    if (originalIndex) await fs.writeFile(indexPath, originalIndex);
    else if (original) await fs.rm(indexPath, { force: true });
    if (createdArchive) await fs.rm(archivePath);
    throw e;
  } finally { await lock.close(); await fs.rm(lockPath, { force: true }); }
}

export function replayAdapter(responses) {
  if (!Array.isArray(responses)) throw new Error('Response file must contain an array or {responses:[]}');
  return { async fetchBatch(provider, requests) {
    return requests.map(request => responses.find(r => r.id === request.id && r.provider === provider && r.kind === request.kind)
      ?? { id: request.id, error: { code: 'unavailable', message: 'No response saved for this provider and field' } });
  } };
}
