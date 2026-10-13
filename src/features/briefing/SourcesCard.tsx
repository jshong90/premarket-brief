import type { Briefing, Snapshot } from '@/lib/scanner';
import type { SnapshotKeyLevels } from './keyLevelsTypes';
import { SourcesDisclosure } from '@/components/brief/SourcesDisclosure';
import { formatET } from '@/components/brief/numericFormat';
import { formatFuturesSession } from './futuresSession';

const sourceSections: { key: keyof Briefing; label: string }[] = [
  { key: 'indices', label: '01 · Overnight movements on the indices' },
  { key: 'bonds', label: '01 · Overnight movements on bonds' },
  { key: 'energy', label: '02 · Energy commentary' },
  { key: 'macro', label: '03 · Upcoming macro events' },
  { key: 'earnings', label: '04 · Upcoming earnings' },
  { key: 'news', label: '05 · Overnight news' },
];
export function SourcesCard({ data }: { data: Snapshot }) {
  const references = sourceSections.flatMap((section) => (data.briefing?.[section.key] ?? []).flatMap((note) => [
    ...(note.source && note.url && note.source !== 'Desk commentary'
      ? [{ section: section.label, note, source: note.source, url: note.url }]
      : []),
    ...(note.relatedSources ?? []).filter((item) => item.source && item.url)
      .map((item) => ({ section: section.label, note, source: item.source, url: item.url })),
  ]));
  const treasuryReferences = (data.treasuryYields ?? []).filter((row) =>
    row.previousClose !== null && row.previousCloseSource && row.previousCloseUrl
      || row.value !== null && row.source && row.url);
  const indexQuoteReferences = (data.indexQuotes ?? []).filter((row) => row.url && (row.previousClose!==null || row.value!==null));
  const treasuryCitationCount = treasuryReferences.reduce((count, row) =>
    count + Number(row.previousClose !== null && Boolean(row.previousCloseSource && row.previousCloseUrl))
      + Number(row.value !== null && Boolean(row.source && row.url)), 0);
  const tradingViewRefs = references.filter(({ source }) => source.startsWith('TradingView Official MCP'));
  const otherRefs = references.filter(({ source }) => !source.startsWith('TradingView Official MCP'));
  const keyLevelData = data as SnapshotKeyLevels;
  const keyLevels = keyLevelData.keyLevels ?? [];
  const capturedKeyLevels = keyLevels.filter((row) => row.high!==null && row.low!==null);
  const referenceCount = references.length + treasuryCitationCount + indexQuoteReferences.length + capturedKeyLevels.length;
  if (!referenceCount) return null;

  return <SourcesDisclosure count={referenceCount}>
      {Boolean(tradingViewRefs.length) && <section className="sources-group">
        <h3>TradingView Official MCP</h3>
        <p className="sources-intro">Timestamped market data; provider delay may exceed 15 minutes.</p>
        <ul className="sources-list">
          {tradingViewRefs.map(({ section, note, source, url }) => {
            const detail = source.replace(/^TradingView Official MCP\s*·?\s*/, '');
            const observedAt = note.asOf || note.publishedAt;
            return <li key={section + note.title + source}>
              <a href={url} target="_blank" rel="noreferrer">{note.title} ↗</a>
              <small>{section} · {detail}</small>
              {observedAt && <small>Observed {new Date(observedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.</small>}
            </li>;
          })}

        </ul>
      </section>}
      {capturedKeyLevels.length > 0 && <section className="sources-group">
        <h3>Key Levels data</h3>
        <ul className="sources-list">{capturedKeyLevels.map((row) => <li key={row.id}>
          <a href={row.url ?? 'https://www.tradingview.com/markets/futures/quotes/'} target="_blank" rel="noreferrer">{row.label} key levels ↗</a>
          <small>{row.source} · Window: {formatFuturesSession(data.sessionDate)}; the 09:20 ET bar is excluded.</small>
          {row.asOf && <small>Latest bar {formatET(row.asOf)} ET. {row.issue}</small>}
          {row.retrievedAt && <small>Retrieved {new Date(row.retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</small>}
        </li>)}</ul>
      </section>}
      {indexQuoteReferences.length > 0 && <section className="sources-group">
        <h3>Index quote data</h3>
        <ul className="sources-list">{indexQuoteReferences.map((row) => <li key={row.id}>
          <a href={row.url} target="_blank" rel="noreferrer">{row.label ?? row.id} {row.value!==null?'quote':'previous close'} ↗</a>
          <small>01 · Overnight movements on the indices · {row.source}</small>
          {row.asOf && <small>Observed {new Date(row.asOf).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.</small>}
          {row.retrievedAt && <small>Retrieved {new Date(row.retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</small>}
        </li>)}</ul>
      </section>}
      {otherRefs.length > 0 && <section className="sources-group">
        <h3>Other briefing sources</h3>
        <ul className="sources-list">
          {otherRefs.map(({ section, note, source, url }) => <li key={section + note.title + source}>
            <a href={url} target="_blank" rel="noreferrer">{note.title} ↗</a>
            <small>{section} · {source}</small>
            {(note.publishedAt || note.asOf) && <small>Published or observed {new Date((note.publishedAt || note.asOf)!).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET.</small>}
          </li>)}
        </ul>
      </section>}
      {treasuryReferences.length > 0 && <section className="sources-group">
        <h3>Treasury yield data</h3>
        <ul className="sources-list">{treasuryReferences.flatMap((row) => [
          ...(row.previousClose !== null && row.previousCloseSource && row.previousCloseUrl ? [{
            key: `${row.tenor}-previous`, label: `${row.tenor} previous session close`, source: row.previousCloseSource, url: row.previousCloseUrl, retrievedAt: row.retrievedAt,
          }] : []),
          ...(row.value !== null && row.source && row.url ? [{
            key: `${row.tenor}-latest`, label: `${row.tenor} latest available observation`, source: row.source, url: row.url, retrievedAt: row.retrievedAt,
          }] : []),
        ]).map((citation) => <li key={citation.key}>
          <a href={citation.url} target="_blank" rel="noreferrer">{citation.label} ↗</a>
          <small>01 · Overnight movements on bonds · {citation.source}</small>
          {citation.retrievedAt && <small>Retrieved {new Date(citation.retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</small>}
        </li>)}</ul>
      </section>}
  </SourcesDisclosure>;
}
