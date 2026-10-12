import { useState } from 'react';
import { CommentaryNotes } from '@/components/brief/Commentary';
import { SectionHeading } from '@/components/brief/SectionHeading';
import type { Briefing, Snapshot, TreasuryYield } from '@/lib/scanner';
import { groupMacroCalendarRows, normalizeMacroCalendar } from '@/lib/macroCalendar';
import { eligibleEarningsSessions, hasStructuredEarnings } from '@/lib/earningsCalendar';
import { visibleBriefingSectionKeys, type BriefingSectionKey, type BriefingTopicSelection } from '@/lib/briefingTopics';

type KeyLevel = { id: 'ES' | 'NQ' | 'YM' | 'RTY'; label: string; high: number | null; low: number | null; highTime?: string | null; lowTime?: string | null; asOf: string | null; retrievedAt?: string | null; source: string; issue?: string };
type SnapshotKeyLevels = Snapshot & { keyLevels?: KeyLevel[] };

const sections: { key: keyof Briefing | 'keyLevels' | 'energy'; title: string }[] = [
  { key: 'indices', title: 'Overnight movements on the indices' },
  { key: 'bonds', title: 'Overnight movements on bonds' },
  { key: 'keyLevels', title: 'Key Levels' },
  { key: 'energy', title: 'Energy' },
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

function OvernightMovementsPanel({ data, showEquities = true, showBonds = true }: { data: Snapshot; showEquities?: boolean; showBonds?: boolean }) {
  const indexNotes = data.briefing?.indices ?? [];
  const bondNotes = data.briefing?.bonds ?? [];
  if (!showEquities && !showBonds) return null;
  return <section className="briefing-section panel overnight-combined-section" aria-labelledby="brief-overnight-movements">
    <SectionHeading id="brief-overnight-movements" number={1} title="Overnight movements" />
    <div className={`overnight-pair${showEquities && showBonds ? '' : ' is-single-topic'}${showEquities ? ' has-equities' : ''}${showBonds ? ' has-bonds' : ''}`}>
      {showEquities && <section className="overnight-column" aria-labelledby="brief-indices">
        <h3 id="brief-indices">Overnight movements on the indices</h3>
        <IndexOvernightTable data={data} />
        <div className="overnight-commentary"><CommentaryNotes notes={indexNotes} empty="No index commentary supplied." /></div>
      </section>}
      {showBonds && <section className="overnight-column" aria-labelledby="brief-bonds">
        <h3 id="brief-bonds">Overnight movements on bonds</h3>
        <TreasuryYieldsTable data={data} />
        <div className="overnight-commentary"><CommentaryNotes notes={bondNotes} empty="No bond commentary supplied." /></div>
      </section>}
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
  const groups = groupMacroCalendarRows(rows, sessionDate);
  return <div className="macro-calendar" aria-label="Upcoming economic events">
    <div className="macro-calendar-meta">All times Eastern</div>
    <div className="macro-days">{groups.map((group) => <article className="macro-day" key={group.key}>
      <header className="macro-day-header"><h3>{group.heading}</h3>{group.relative && <span className="macro-relative-day">{group.relative}</span>}</header>
      <ol className="macro-events">{group.rows.map((row, index) => <li className="macro-event" key={row.date + '-' + row.sortKey + '-' + index}>
        <time className="macro-event-time">{row.time}</time>
        <div className="macro-event-copy"><p>{row.event}</p><div className="macro-event-sources">{row.sources.map((source, sourceIndex) => <span key={source.url + '-' + sourceIndex}>{sourceIndex > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.source} ↗</a></span>)}</div></div>
      </li>)}</ol>
    </article>)}</div>
  </div>;
}

function EarningsTicker({ company }: { company: NonNullable<Briefing['earnings'][number]['sessions']>[number]['companies'][number] }) {
  const cap = (company.marketCap! / 1e9).toFixed(1);
  return <a className="earnings-ticker" href={company.marketCapUrl} target="_blank" rel="noreferrer" title={`${company.name} · $${cap}B market cap`} aria-label={`${company.ticker}, ${company.name}, market cap $${cap} billion`}>{company.ticker}</a>;
}

function EarningsCalendar({ notes }: { notes: Briefing['earnings'] }) {
  const days = notes.map((note) => ({ note, sessions: eligibleEarningsSessions(note) }))
    .filter(({ sessions }) => sessions.length > 0);
  const companies = days.flatMap(({ sessions }) => sessions.flatMap((session) => session.companies));
  const checkedDates = [...new Set(companies.map((company) => company.marketCapAsOf).filter((date): date is string => Boolean(date)))].sort();
  const capUrl = companies.find((company) => company.marketCapUrl)?.marketCapUrl;
  const capSource = companies.find((company) => company.marketCapSource)?.marketCapSource;
  const capDate = checkedDates.length === 1
    ? new Date(`${checkedDates[0]}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : checkedDates.length ? `${checkedDates[0]}–${checkedDates.at(-1)}` : null;

  return <div className="earnings-calendar">
    {days.length ? <div className="earnings-days">{days.map(({ note, sessions }) => {
      const before = sessions.find((session) => session.period === 'Before Open')?.companies ?? [];
      const after = sessions.find((session) => session.period === 'After Close')?.companies ?? [];
      return <article className="earnings-day" key={note.title}>
        <h3 className="earnings-day-title">{note.title}</h3>
        <div className="earnings-periods">
          {before.length > 0 && <div className="earnings-period"><span className="earnings-period-label">Before open</span><div className="earnings-tickers">{before.map((company) => <EarningsTicker company={company} key={company.ticker} />)}</div></div>}
          {after.length > 0 && <div className="earnings-period"><span className="earnings-period-label">After close</span><div className="earnings-tickers">{after.map((company) => <EarningsTicker company={company} key={company.ticker} />)}</div></div>}
        </div>
      </article>;
    })}</div> : <div className="briefing-empty">No companies above the market-cap threshold are listed.</div>}
    <p className="earnings-calendar-footnote">Companies over $25B market cap{capDate ? ` · checked ${capDate}` : ''}{capUrl && capSource ? <> · <a href={capUrl} target="_blank" rel="noreferrer">{capSource} ↗</a></> : ''}</p>
  </div>;
}

const sourceSections: { key: keyof Briefing; label: string }[] = [
  { key: 'indices', label: '01 · Overnight movements on the indices' },
  { key: 'bonds', label: '01 · Overnight movements on bonds' },
  { key: 'energy', label: '02 · Energy commentary' },
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
  const latestKeyLevelAsOf = keyLevels.map((row) => row.asOf).filter((value): value is string => Boolean(value)).sort().at(-1);
  const keyLevelsComplete = data.status === 'frozen' && keyLevels.length === 4 && keyLevels.every((row) => row.high !== null && row.low !== null);
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
            <small>Futures session: {formatFuturesSession(data.sessionDate)}; latest completed bar {latestKeyLevelAsOf ? `observed at ${formatET(latestKeyLevelAsOf)} ET` : 'time unavailable'}. {keyLevelsComplete ? 'The 09:20 ET bar is excluded.' : 'Partial range; the final 09:20 ET cutoff has not been reached.'} Provider timing is shown per row.</small>
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
            key: `${row.tenor}-latest`, label: `${row.tenor} latest available observation`, source: row.source, url: row.url, retrievedAt: row.retrievedAt,
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

export default function MorningBrief({ data, error, archived = false, topics, showJump = true }: { data: Snapshot; error: string; archived?: boolean; topics?: BriefingTopicSelection | null; showJump?: boolean }) {
  const imported = data.status === 'imported';
  const customized = topics !== undefined && topics !== null;
  const selectedTopics = topics ?? { equities: true, bonds: true, energy: true, macro: true, earnings: true, news: true };
  const visibleKeys: BriefingSectionKey[] = customized
    ? visibleBriefingSectionKeys(selectedTopics)
    : ['indices', 'bonds', 'keyLevels', 'energy', 'macro', 'earnings', 'news'];
  const sectionVisible = (key: keyof Briefing | 'keyLevels' | 'energy') => visibleKeys.includes(key);
  const renderSection = ({ key, title }: { key: keyof Briefing | 'keyLevels' | 'energy'; title: string }, sectionIndex: number) => key === 'keyLevels'
    ? <section className="briefing-section panel key-levels-section" key={key} aria-labelledby="brief-key-levels">
      <SectionHeading id="brief-key-levels" number={sectionIndex} title={title} />
      <div className="briefing-notes"><KeyLevelsTable data={data} /></div>
    </section>
    : key === 'indices' ? <OvernightMovementsPanel data={data} key="overnight-movements" showEquities={!customized || selectedTopics.equities} showBonds={!customized || selectedTopics.bonds} />
    : key === 'bonds' ? null
    : key === 'energy' ? <section className="briefing-section panel" key={key} aria-labelledby="brief-energy"><SectionHeading id="brief-energy" number={sectionIndex} title={title} /><div className="commentary-card-body"><CommentaryNotes notes={data.briefing?.energy ?? []} empty="No energy commentary supplied for this snapshot." /></div></section>
    : <section className="briefing-section panel" key={key} aria-labelledby={'brief-' + key}>
    <SectionHeading id={'brief-' + key} number={sectionIndex} title={title} />
    <div className="briefing-notes">{key === 'macro' ? <MacroCalendarTable notes={data.briefing?.macro || []} sessionDate={data.sessionDate} /> : key === 'earnings' && hasStructuredEarnings(data.briefing?.earnings ?? []) ? <EarningsCalendar notes={data.briefing?.earnings ?? []} /> : (data.briefing?.[key] || []).length ? data.briefing![key].map((note, index) => {
      return <article className="briefing-note" key={index}><h3>{note.title}</h3><p>{note.body}</p></article>;
    }) : <div className="briefing-empty">No notes supplied for this section.</div>}</div>
  </section>;
  const sectionIndex = (key: keyof Briefing | 'keyLevels') => sections.findIndex((section) => section.key === key);
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading centered-heading">
      <div className="heading-center"><div className="section-heading-row"><h1 id="brief-title">Your Morning Brief<span className="title-dot">.</span></h1></div></div>
      {showJump && <a className="primary-button section-jump" href="#relative-strength">Skip to relative strength <span className="jump-arrow" aria-hidden="true">↓</span></a>}
      <div className="heading-meta paper-meta"><span className="session-chip">{archived ? 'ARCHIVE COPY' : data.status==='draft' ? 'DRAFT BRIEF' : imported ? 'LEGACY EXAMPLE' : 'DAILY BRIEF'}</span></div>
    </div>
    <div className="morning-sections">{sections.filter((section) => sectionVisible(section.key) && section.key !== 'bonds').map((section, index) => renderSection(section, index + 1))}
      {!customized && <SourcesCard data={data}/>}
    </div>
  </section>;
}


