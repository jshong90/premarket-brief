import type { Snapshot } from '@/lib/scanner';

export type KeyLevel = { id: 'ES' | 'NQ' | 'YM' | 'RTY'; label: string; url?: string; high: number | null; low: number | null; highTime?: string | null; lowTime?: string | null; asOf: string | null; retrievedAt?: string | null; source: string; issue?: string };
export type SnapshotKeyLevels = Snapshot & { keyLevels?: KeyLevel[] };
