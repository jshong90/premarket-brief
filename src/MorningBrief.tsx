import { useState } from 'react';
import type { Briefing, Snapshot, TreasuryYield } from './lib/scanner';
import { normalizeMacroCalendar } from './lib/macroCalendar';

type KeyLevel = { id: 'ES' | 'NQ' | 'YM' | 'RTY'; label: string; high: number | null; low: number | null; highTime?: string | null; lowTime?: string | null; asOf: string | null; retrievedAt?: string | null; source: string; issue?: string };
type SnapshotKeyLevels = Snapshot & { keyLevels?: KeyLevel[] };

const sections: { key: keyof Briefing | 'keyLevels'; title: string }[] = [
  { key: 'indices', title: 'Overnight movements on the indices' },
  { key: 'bonds', title: 'Overnight movements on bonds' },
  { key: 'keyLevels', title: 'Key Levels' },
  { key: 'macro', title: 'Upcoming macro events' },
  { key: 'earnings', title: 'Upcoming earnings' },
  { key: 'news', title: 'Overnight news' },
];

const majorIndices: KeyLevel['id'][] = ['ES', 'NQ', 'YM', 'RTY'];
const indexNames: Record<KeyLevel['id'], string> = {
  ES: 'S&P 500 (ES)',
  NQ: 'Nasdaq-100 (NQ)',
  YM: 'Dow (YM)',
  RTY: 'Russell 2000 (RTY)',
};
const tvSymbols: Record<KeyLevel['id'], string> = {
  ES: 'CME_MINI:ES1!',
  NQ: 'CME_MINI:NQ1!',
  YM: 'CBOT_MINI:YM1!',
  RTY: 'CME_MINI:RTY1!',
};

type IndexQuoteRow = { label: string; fridayClose: number | null; scanPrice: number | null; changePercent: number | null };
type IndexQuoteNote = { indexQuotes?: IndexQuoteRow[] };

const formatPrice = (value: number | null | undefined) => value == null
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const formatChange = (value: number | null) => value === null
  ? '—'
  : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

function IndexOvernightTable({ data }: { data: Snapshot }) {
  const legacyQuotes = (data.briefing?.indices ?? []).flatMap((note) => (note as typeof note & IndexQuoteNote).indexQuotes ?? []);
  const getLegacyQuote = (symbol: 'NQ' | 'ES') => legacyQuotes.find((row) =>
    symbol === 'NQ' ? /nasdaq|\bNQ\b/i.test(row.label) : /s\s*&?p|\bES\b/i.test(row.label),
  );
  const quoteFor = (symbol: 'NQ' | 'ES') => {
    const quote = data.indexQuotes?.find((row) => row.id === symbol);
    const legacy = getLegacyQuote(symbol);
    const previous = quote ? quote.previousClose : legacy?.fridayClose ?? null;
    const current = quote ? quote.value : legacy?.scanPrice ?? null;
    return { id: symbol, label: symbol, previous, current,
      change: previous !== null && current !== null && previous > 0 ? (current / previous - 1) * 100 : quote ? null : legacy?.changePercent ?? null,
      approximate: false, asOf: quote?.asOf ?? null };
  };
  const vix = data.marketContext?.find((row) => row.id === 'VIX');
  const rows = [
    quoteFor('NQ'),
    quoteFor('ES'),
    {
      id: 'VIX', label: 'VIX', previous: vix?.previousClose ?? null, current: vix?.value ?? null,
      change: vix?.value != null && vix.previousClose != null && vix.previousClose !== 0
        ? (vix.value / vix.previousClose - 1) * 100
        : null,
      approximate: vix?.approximate ?? false,
      asOf: vix?.asOf ?? null,
    },
  ];

  return <div className="index-quotes-wrap"><table className="index-quotes">
    <thead><tr><th scope="col">Market</th><th scope="col">Prev. Session Close</th><th scope="col">Premarket</th><th scope="col">Change (%)</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <th scope="row">{row.label}</th>
      <td className="mono">{row.previous == null ? '—' : `${row.approximate ? '~' : ''}${formatPrice(row.previous)}`}</td>
      <td className="mono">{row.current == null ? '—' : <>{row.approximate ? '~' : ''}{formatPrice(row.current)}{row.asOf && <small>{formatET(row.asOf)} ET</small>}</>}</td>
      <td className={`mono ${row.change == null ? '' : row.change < 0 ? 'negative' : row.change > 0 ? 'positive' : ''}`}>{row.change == null ? '—' : `${row.approximate ? '~' : ''}${formatChange(row.change)}`}</td>
    </tr>)}</tbody>
  </table></div>;
}

function OvernightMovementsPanel({ data }: { data: Snapshot }) {
  const indexNotes = data.briefing?.indices ?? [];
  const bondNotes = data.briefing?.bonds ?? [];
  return <section className="briefing-section panel overnight-combined-section" aria-labelledby="brief-overnight-movements">
    <div className="briefing-section-head"><span className="brief-section-number">01</span><h2 id="brief-overnight-movements">Overnight movements</h2></div>
    <div className="overnight-pair">
      <section className="overnight-column" aria-labelledby="brief-indices">
        <h3 id="brief-indices">Overnight movements on the indices</h3>
        <IndexOvernightTable data={data} />
        <div className="overnight-commentary">{indexNotes.length ? indexNotes.map((note, index) => <article key={index}>
          <h4>{note.title}</h4><p>{note.body}</p>
        </article>) : <p className="briefing-empty">No index commentary supplied.</p>}</div>
      </section>
      <section className="overnight-column" aria-labelledby="brief-bonds">
        <h3 id="brief-bonds">Overnight movements on bonds</h3>
        <TreasuryYieldsTable data={data} />
        <div className="overnight-commentary">{bondNotes.length ? bondNotes.map((note, index) => <article key={index}>
          <h4>{note.title}</h4><p>{note.body}</p>
        </article>) : <p className="briefing-empty">No bond commentary supplied.</p>}</div>
      </section>
    </div>
  </section>;
}

const treasuryTenors = ['5Y', '10Y', '30Y'] as const;
function TreasuryYieldsTable({ data }: { data: Snapshot }) {
  const yields = data.marketContext?.find((row) => row.id === 'US10Y');
  const yieldRows = data.treasuryYields ?? [];
  const rows = treasuryTenors.map((tenor) => {
    const supplied = yieldRows.find((row) => row.tenor === tenor);
    return {
      tenor,
      value: supplied?.value ?? (tenor === '10Y' ? yields?.value : null) ?? null,
      previousClose: supplied?.previousClose ?? (tenor === '10Y' ? yields?.previousClose : null) ?? null,
      asOf: supplied?.asOf ?? (tenor === '10Y' ? yields?.asOf : null),
      approximate: supplied?.approximate ?? (tenor === '10Y' ? yields?.approximate : false),
    };
  });
  const missing = rows.flatMap((row) => [
    ...(row.previousClose === null ? [`${row.tenor} previous session close`] : []),
    ...(row.value === null ? [`${row.tenor} premarket quote`] : []),
  ]);
  return <>
    <div className="treasury-yields-wrap">
      <table className="treasury-yields-table">
        <thead><tr><th scope="col">Treasury</th><th scope="col">Prev. Session Close</th><th scope="col">Premarket</th><th scope="col">Change</th></tr></thead>
        <tbody>{rows.map((row) => {
          const { tenor } = row;
          const current = row.value;
          const previous = row.previousClose;
          const changeBps = current !== null && previous !== null ? (current - previous) * 100 : null;
          const asOf = formatET(row.asOf);
          const approximate = row.approximate;
          return <tr key={tenor}>
            <th scope="row">{tenor}</th>
            <td className="mono">{previous === null ? '—' : `${approximate ? '~' : ''}${previous.toFixed(3)}%`}</td>
            <td className="mono">{current === null ? '—' : <>{approximate ? '~' : ''}{current.toFixed(3)}%{asOf && <small>{asOf} ET</small>}</>}</td>
            <td className={`mono ${changeBps === null ? '' : changeBps > 0 ? 'negative' : changeBps < 0 ? 'positive' : ''}`}>{changeBps === null ? '—' : `${changeBps > 0 ? '+' : ''}${changeBps.toFixed(1)} bp`}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {missing.length > 0 && <p className="treasury-yields-note">Unavailable: {missing.join(', ')}. Blank values are not estimated.</p>}
  </>;
}

function MacroCalendarTable({ notes, sessionDate }: { notes: Briefing['macro']; sessionDate: string }) {
  const rows = normalizeMacroCalendar(notes, sessionDate);
  if (!rows.length) return <div className="briefing-empty">No macro events supplied.</div>;
  return <div className="macro-calendar-wrap"><table className="macro-calendar">
    <thead><tr><th scope="col">Date</th><th scope="col">Time (ET)</th><th scope="col">Event</th><th scope="col">Source</th></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.date + '-' + row.sortKey + '-' + index}>
      <td>{row.date.replace(/,\\s*\\d{4}$/, '')}</td><td className="mono">{row.time}</td><td>{row.event}</td>
      <td>{row.sources.map((source, sourceIndex) => <span key={source.url + '-' + sourceIndex}>{sourceIndex > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.source} ↗</a></span>)}</td>
    </tr>)}</tbody>
  </table></div>;
}

const sourceSections: { key: keyof Briefing; label: string }[] = [
  { key: 'indices', label: '01 · Overnight movements on the indices' },
  { key: 'bonds', label: '01 · Overnight movements on bonds' },
  { key: 'macro', label: '03 · Upcoming macro events' },
  { key: 'earnings', label: '04 · Upcoming earnings' },
  { key: 'news', label: '05 · Overnight news' },
];

function formatFuturesSession(sessionDate: string) {
  const date = new Date(`${sessionDate}T12:00:00Z`);
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const formatDate = (value: Date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(value);
  return `${formatDate(previousDate)} 6:00 PM–${formatDate(date)} 9:20 AM ET`;
}

const formatET = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  : null;

function KeyLevelsTable({ data }: { data: Snapshot }) {
  const keyLevelData = data as SnapshotKeyLevels;
  const keyLevels = keyLevelData.keyLevels ?? [];
  const byId = new Map(keyLevels.map((row) => [row.id, row]));
  const coverageIssues = keyLevels.filter((row) => row.issue);
  return <>
    <div className="key-levels-wrap">
      <table className="key-levels-table">
        <thead><tr><th scope="col">Index futures</th><th scope="col">Premarket high</th><th scope="col">Premarket low</th></tr></thead>
        <tbody>{majorIndices.map((id) => {
          const row = byId.get(id);
          const highTime = formatET(row?.highTime);
          const lowTime = formatET(row?.lowTime);
          return <tr key={id}>
            <th scope="row"><a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbols[id])}`} target="_blank" rel="noreferrer">{indexNames[id]} ↗</a></th>
            <td className="mono">{formatPrice(row?.high)}{highTime && <small>{highTime} ET</small>}</td>
            <td className="mono">{formatPrice(row?.low)}{lowTime && <small>{lowTime} ET</small>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="key-levels-note">Window: {formatFuturesSession(data.sessionDate)}; the 9:20 AM ET bar is excluded. {coverageIssues.length > 0 ? coverageIssues.map((row) => `${row.id}: ${row.issue}`).join(' ') : 'All four rows have complete returned-bar coverage.'}</p>
  </>;
}


function SourcesCard({ data }: { data: Snapshot }) {
  const [open, setOpen] = useState(false);
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
  const retrievedAt = capturedKeyLevels.find((row) => row.retrievedAt)?.retrievedAt;
  const referenceCount = references.length + treasuryCitationCount + indexQuoteReferences.length + (capturedKeyLevels.length ? 1 : 0);
  if (!referenceCount) return null;

  return <section className={`sources-card panel ${open ? 'is-open' : ''}`}>
    <button className="sources-summary" type="button" aria-expanded={open} aria-controls="sources-content" onClick={() => setOpen((value) => !value)}><span className="sources-title">Sources</span><span className="sources-count">{referenceCount} references</span></button>
    <div className="sources-reveal" aria-hidden={!open} inert={!open}>
    <div className="sources-content" id="sources-content">
      {Boolean(tradingViewRefs.length || capturedKeyLevels.length) && <section className="sources-group">
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
          {capturedKeyLevels.length > 0 && <li>
            <a href="https://www.tradingview.com/markets/futures/quotes/" target="_blank" rel="noreferrer">Premarket key levels ↗</a>
            <small>Futures session: {formatFuturesSession(data.sessionDate)}; last complete one-minute bar ends at 9:19 AM ET. Provider delay may exceed 15 minutes.</small>
            {retrievedAt && <small>Retrieved {new Date(retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</small>}
          </li>}
        </ul>
      </section>}
      {indexQuoteReferences.length > 0 && <section className="sources-group">
        <h3>Index quote data</h3>
        <ul className="sources-list">{indexQuoteReferences.map((row) => <li key={row.id}>
          <a href={row.url} target="_blank" rel="noreferrer">{row.id} {row.value!==null?'quote':'previous close'} ↗</a>
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
            key: `${row.tenor}-premarket`, label: `${row.tenor} premarket quote`, source: row.source, url: row.url, retrievedAt: row.retrievedAt,
          }] : []),
        ]).map((citation) => <li key={citation.key}>
          <a href={citation.url} target="_blank" rel="noreferrer">{citation.label} ↗</a>
          <small>01 · Overnight movements on bonds · {citation.source}</small>
          {citation.retrievedAt && <small>Retrieved {new Date(citation.retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</small>}
        </li>)}</ul>
      </section>}
    </div>
    </div>
  </section>;
}

export default function MorningBrief({ data, error, archived = false }: { data: Snapshot; error: string; archived?: boolean }) {
  const imported = data.status === 'imported';
  const userSuppliedBriefing = Object.values(data.briefing || {}).flat().some((note) => note.source === 'Desk commentary');
  const renderSection = ({ key, title }: { key: keyof Briefing | 'keyLevels'; title: string }, sectionIndex: number) => key === 'keyLevels'
    ? <section className="briefing-section panel key-levels-section" key={key} aria-labelledby="brief-key-levels">
      <div className="briefing-section-head"><span className="brief-section-number">0{sectionIndex}</span><h2 id="brief-key-levels">{title}</h2></div>
      <div className="briefing-notes"><KeyLevelsTable data={data} /></div>
    </section>
    : key === 'indices' ? <OvernightMovementsPanel data={data} key="overnight-movements" />
    : key === 'bonds' ? null
    : <section className="briefing-section panel" key={key} aria-labelledby={'brief-' + key}>
    <div className="briefing-section-head"><span className="brief-section-number">0{sectionIndex}</span><h2 id={'brief-' + key}>{title}</h2></div>
    <div className="briefing-notes">{key === 'macro' ? <MacroCalendarTable notes={data.briefing?.macro || []} sessionDate={data.sessionDate} /> : (data.briefing?.[key] || []).length ? data.briefing![key].map((note, index) => {
      return <article className="briefing-note" key={index}><h3>{note.title}</h3><p>{note.body}</p></article>;
    }) : <div className="briefing-empty">No notes supplied for this section.</div>}</div>
  </section>;
  const sectionIndex = (key: keyof Briefing | 'keyLevels') => sections.findIndex((section) => section.key === key);
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading centered-heading">
      <div className="heading-center"><div className="section-heading-row"><h1 id="brief-title">Your Morning Brief<span className="title-dot">.</span></h1></div></div>
      <a className="primary-button section-jump" href="#relative-strength">Skip to relative strength <span className="jump-arrow" aria-hidden="true">↓</span></a>
      <div className="heading-meta paper-meta"><span className="session-chip">{archived ? 'ARCHIVE COPY' : data.status==='draft' ? 'DRAFT BRIEF' : imported ? 'LEGACY EXAMPLE' : 'DAILY BRIEF'}</span></div>
    </div>
    <div className="source-notice"><div><strong>{userSuppliedBriefing ? 'Morning commentary' : imported ? 'Your morning briefing' : 'Morning snapshot'}</strong><span>{error || data.messages[0] || 'Source times and coverage are recorded with each note.'}</span></div></div>
    <div className="morning-sections">{sections.map((section, index) => renderSection(section, index))}
      <SourcesCard data={data}/>
    </div>
  </section>;
}
