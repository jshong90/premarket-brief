export type ArchiveEntry = {
  sessionDate: string;
  file: string;
  status: 'archived' | 'partial' | 'imported' | 'frozen';
};

export type ArchiveCatalog = { version: 1; entries: ArchiveEntry[] };

export function archiveFileForDate(date: string, catalog: ArchiveCatalog): string | null {
  return catalog.entries.find((entry) => entry.sessionDate === date)?.file ?? null;
}

export function parseArchiveCatalog(input: unknown): ArchiveCatalog {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Archive catalog is malformed.');
  const candidate = input as Partial<ArchiveCatalog>;
  if (candidate.version !== 1 || !Array.isArray(candidate.entries)) throw new Error('Archive catalog is malformed.');
  const seen = new Set<string>();
  const entries = candidate.entries.map((entry): ArchiveEntry => {
    if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.sessionDate) || !Number.isFinite(Date.parse(entry.sessionDate)) || new Date(`${entry.sessionDate}T00:00:00Z`).toISOString().slice(0, 10) !== entry.sessionDate) throw new Error('Archive catalog contains an invalid session date.');
    if (seen.has(entry.sessionDate)) throw new Error('Archive catalog contains a duplicate session date.');
    if (!/^snapshot-[\w.-]+\.json$/.test(entry.file)) throw new Error('Archive catalog contains an unsafe file path.');
    if (!['archived', 'partial', 'imported', 'frozen'].includes(entry.status)) throw new Error('Archive catalog contains an invalid status.');
    seen.add(entry.sessionDate);
    return { sessionDate: entry.sessionDate, file: entry.file, status: entry.status };
  });
  return { version: 1, entries: entries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)) };
}

export async function loadArchiveCatalog(baseUrl: string, signal?: AbortSignal): Promise<ArchiveCatalog> {
  const response = await fetch(new URL('./data/archive-index.json', baseUrl), { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Archive index unavailable (${response.status}).`);
  return parseArchiveCatalog(await response.json());
}
