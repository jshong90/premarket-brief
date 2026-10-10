export const BRIEFING_TOPICS = [
  { id: 'equities', label: 'Equities', description: 'Overnight index table, equity commentary, and key levels.' },
  { id: 'bonds', label: 'Bonds', description: 'Treasury yield table and bond commentary.' },
  { id: 'energy', label: 'Energy', description: 'Energy commentary and related levels.' },
  { id: 'macro', label: 'Macro Events', description: 'Upcoming economic releases and scheduled events.' },
  { id: 'earnings', label: 'Earnings', description: 'Upcoming company earnings and timing.' },
] as const;

export type BriefingTopicId = (typeof BRIEFING_TOPICS)[number]['id'];
export type BriefingTopicSelection = Record<BriefingTopicId, boolean>;
export type BriefingSectionKey = 'indices' | 'bonds' | 'keyLevels' | 'energy' | 'macro' | 'earnings' | 'news';

export const DEFAULT_BRIEFING_TOPICS: BriefingTopicSelection = {
  equities: true,
  bonds: true,
  energy: true,
  macro: true,
  earnings: true,
};

export function visibleBriefingSectionKeys(selection: BriefingTopicSelection): BriefingSectionKey[] {
  return [
    ...(selection.equities || selection.bonds ? ['indices' as const] : []),
    ...(selection.bonds ? ['bonds' as const] : []),
    ...(selection.equities ? ['keyLevels' as const] : []),
    ...(selection.energy ? ['energy' as const] : []),
    ...(selection.macro ? ['macro' as const] : []),
    ...(selection.earnings ? ['earnings' as const] : []),
  ];
}

const STORAGE_KEY = 'warren-briefing-topics-v1';

export function readBriefingTopics(): BriefingTopicSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    return Object.fromEntries(BRIEFING_TOPICS.map(({ id }) => [id, value[id] === true])) as BriefingTopicSelection;
  } catch {
    return null;
  }
}

export function saveBriefingTopics(selection: BriefingTopicSelection) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // A storage restriction should not prevent the builder preview from working.
  }
}
