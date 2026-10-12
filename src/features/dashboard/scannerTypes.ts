import type { BenchmarkId, Instrument, metrics } from '@/lib/scanner';

export type SortKey = 'ticker' | 'drawdown' | 'capture' | 'advantage' | 'recovery';
export type ScannerRow = Instrument & ReturnType<typeof metrics> & { usedBenchmark: BenchmarkId; rsRank: number };
export type ScannerDrawer = 'method' | 'connections' | null;
