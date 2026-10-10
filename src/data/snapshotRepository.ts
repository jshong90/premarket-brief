import { archiveFileForDate, loadArchiveCatalog } from './archiveCatalog';
import { readSnapshot } from '@/lib/snapshot';
import type { Snapshot } from '@/lib/scanner';

export type SnapshotRequest = { search: string; baseUrl: string; signal?: AbortSignal };

export function snapshotFileFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const date = params.get('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid snapshot date.');
    }
    return `snapshot-${date}.json`;
  }
  if (params.get('scan') === '0635') return 'snapshot-opening-0635.json';
  return 'snapshot.json';
}

export async function loadSnapshot({ search, baseUrl, signal }: SnapshotRequest): Promise<Snapshot> {
  const params = new URLSearchParams(search);
  const date = params.get('date');
  let filename = snapshotFileFromSearch(search);
  if (date) {
    try {
      const catalog = await loadArchiveCatalog(baseUrl, signal);
      filename = archiveFileForDate(date, catalog) ?? filename;
    } catch (error) {
      if (signal?.aborted) throw error;
      // Keep direct dated-file URLs working during a catalog rollout.
    }
  }
  const response = await fetch(new URL(`./data/${filename}`, baseUrl), { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Snapshot file unavailable (${response.status}).`);
  return readSnapshot(await response.json());
}
