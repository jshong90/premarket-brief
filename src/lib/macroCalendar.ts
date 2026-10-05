type MacroNote = {
  title: string; body: string; source: string; url: string;
  sourceKey?: string; relatedSources?: { source: string; url: string }[];
};

export const MACRO_SOURCE_MAP = {
  economicCalendar: { source: 'Trading Economics · U.S. calendar', url: 'https://tradingeconomics.com/united-states/calendar' },
  federalReserveBoard: {
    source: 'Federal Reserve Board · monthly calendar',
    urlForDate: (date: string) => {
      const value = new Date(date + 'T00:00:00Z');
      const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(value).toLowerCase();
      return 'https://www.federalreserve.gov/newsevents/' + value.getUTCFullYear() + '-' + month + '.htm';
    },
  },
  newYorkFed: { source: 'Federal Reserve Bank of New York · events', url: 'https://www.newyorkfed.org/press' },
  kansasCityFed: { source: 'Federal Reserve Bank of Kansas City · speeches', url: 'https://www.kansascityfed.org/speeches/' },
  stLouisFed: { source: "Federal Reserve Bank of St. Louis · president's remarks", url: 'https://www.stlouisfed.org/from-the-president/remarks' },
  treasurySchedule: { source: 'U.S. Treasury · tentative auction schedule', url: 'https://home.treasury.gov/system/files/221/Tentative-Auction-Schedule.pdf' },
  treasuryUpcoming: { source: 'TreasuryDirect · upcoming auctions', url: 'https://www.treasurydirect.gov/auctions/upcoming/' },
  treasuryTiming: { source: 'TreasuryDirect · general auction timing', url: 'https://www.treasurydirect.gov/auctions/general-auction-timing/' },
  treasuryRefunding: { source: 'U.S. Treasury · quarterly refunding', url: 'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents/' },
} as const;

export const MACRO_SELECTION_POLICY = {
  economicReleases: 'Trading Economics is used only for U.S. releases explicitly requested or approved for the brief.',
  afterCloseMinuteET: 16 * 60,
} as const;

export type MacroCalendarRow = {
  date: string; time: string; event: string; sources: { source: string; url: string }[]; sortKey: number;
};

function resolveDate(title: string, sessionDate: string) {
  const match = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (!match) return { label: title, key: Number.MAX_SAFE_INTEGER };
  const reference = new Date(sessionDate + 'T00:00:00Z');
  let year = Number(match[3] ?? reference.getUTCFullYear());
  const month = new Date(match[1] + ' 1, 2000 UTC').getUTCMonth();
  if (!match[3]) {
    const delta = month - reference.getUTCMonth();
    if (delta > 6) year -= 1;
    if (delta < -6) year += 1;
  }
  return { label: title, key: Date.UTC(year, month, Number(match[2])) };
}

function getSources(note: MacroNote, sessionDate: string) {
  const key = note.sourceKey as keyof typeof MACRO_SOURCE_MAP | undefined;
  const configured = key ? MACRO_SOURCE_MAP[key] : undefined;
  const date = resolveDate(note.title, sessionDate);
  const eventDate = Number.isFinite(date.key) ? new Date(date.key).toISOString().slice(0, 10) : sessionDate;
  const fallback = configured
    ? { source: configured.source, url: 'urlForDate' in configured ? configured.urlForDate(eventDate) : configured.url }
    : { source: note.source, url: note.url };
  const primary = note.source && note.url ? { source: note.source, url: note.url } : fallback;
  const all = [primary, ...(note.relatedSources ?? [])];
  return all.filter((item, i) => item.source && item.url && all.findIndex(other => other.url === item.url) === i);
}

export function normalizeMacroCalendar(notes: MacroNote[], sessionDate: string): MacroCalendarRow[] {
  const rows: (MacroCalendarRow & { order: number })[] = [];
  notes.forEach((note, order) => {
    const sources = getSources(note, sessionDate);
    const date = resolveDate(note.title, sessionDate);
    const timed = note.body.split('\n').flatMap(line => {
      const match = line.match(/^\s*(\d{1,2}:\d{2}\s*[ap]\.m\.\s*ET)\s*[—–-]\s*(.+?)\s*$/i);
      if (!match) return [];
      const parts = match[1].match(/(\d{1,2}):(\d{2})\s*([ap])/i);
      if (!parts) return [];
      const minutes = ((Number(parts[1]) % 12) + (parts[3].toLowerCase() === 'p' ? 12 : 0)) * 60 + Number(parts[2]);
      if (minutes >= MACRO_SELECTION_POLICY.afterCloseMinuteET) return [];
      return [{
        date: date.label, time: match[1].replace(/\s*ET$/i, ''), event: match[2], sources,
        sortKey: date.key + minutes * 60_000, order,
      }];
    });
    if (timed.length) { rows.push(...timed); return; }
    if (/^\s*\d{1,2}:\d{2}\s*[ap]\.m\.\s*ET\s*[—–-]/im.test(note.body)) return;

    const weekdays = note.body.split(/(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday):)/i).flatMap(segment => {
      const item = segment.match(/^\s*(Monday|Tuesday|Wednesday|Thursday|Friday):\s*(.+?)\s*$/i);
      return item ? [{ date: item[1], time: '—', event: item[2].replace(/[.;]+$/, ''), sources, sortKey: date.key + 86_399_000, order }] : [];
    });
    if (weekdays.length) rows.push(...weekdays);
    else rows.push({ date: date.label, time: '—', event: note.body, sources, sortKey: date.key + 86_399_000, order });
  });
  return rows.sort((a, b) => a.sortKey - b.sortKey || a.order - b.order);
}