import type { Briefing, Snapshot } from './lib/scanner';

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
const formatET = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  : null;

function KeyLevelsTable({ data }: { data: Snapshot }) {
  const keyLevelData = data as SnapshotKeyLevels;
  const byId = new Map((keyLevelData.keyLevels ?? []).map((row) => [row.id, row]));
  const date = new Date(`${data.sessionDate}T12:00:00Z`);
  const previousDate = new Date(date);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const formatDate = (value: Date) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric',
  }).format(value);
  const sessionLabel = `${formatDate(previousDate)} 6:00 PM–${formatDate(date)} 9:20 AM ET`;
  const retrievedAt = keyLevelData.keyLevels?.find((row) => row.retrievedAt)?.retrievedAt;

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
    <p className="key-levels-note">Futures session: {sessionLabel}; last complete one-minute bar ends at 9:19 AM ET. TradingView data may be delayed 15+ minutes.
      {retrievedAt && <> Retrieved {new Date(retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'short' })} PT.</>}
    </p>
  </>;
}

export default function MorningBrief({ data, error }: { data: Snapshot; error: string }) {
  const imported = data.status === 'imported';
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading"><div><div className="eyebrow">THE WARREN / THE MORNING READ</div><div className="section-heading-row"><h1 id="brief-title">Morning brief<span className="title-dot">.</span></h1><a className="primary-button section-jump" href="#relative-strength">Skip to relative strength ↓</a></div></div><div className="heading-meta"><span className="date-label">{new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(data.sessionDate + 'T12:00:00Z'))}</span><span className="session-chip">{imported ? 'USER-PROVIDED NOTES' : '09:20 ET SNAPSHOT'}</span></div></div>
    <div className="source-notice"><div><strong>{imported ? 'Your morning briefing' : 'Morning snapshot'}</strong><span>{error || (imported ? 'Figures and headlines supplied by you; not independently verified.' : 'Source times and coverage are recorded with each note.')}</span></div></div>
    <div className="morning-sections">{sections.map(({ key, title }, sectionIndex) => key === 'keyLevels'
      ? <section className="briefing-section panel key-levels-section" key={key} aria-labelledby="brief-key-levels">
        <div className="briefing-section-head"><span className="brief-section-number">0{sectionIndex + 1}</span><h2 id="brief-key-levels">{title}</h2></div>
        <div className="briefing-notes"><KeyLevelsTable data={data} /></div>
      </section>
      : <section className="briefing-section panel" key={key} aria-labelledby={'brief-' + key}>
      <div className="briefing-section-head"><span className="brief-section-number">0{sectionIndex + 1}</span><h2 id={'brief-' + key}>{title}</h2></div>
      <div className="briefing-notes">{(data.briefing?.[key] || []).length ? data.briefing![key].map((note, index) => {
        const quotes = (note as typeof note & IndexQuoteNote).indexQuotes;
        return <article className="briefing-note" key={index}><h3>{note.title}</h3>{quotes && quotes.length > 0 && <div className="index-quotes-wrap"><table className="index-quotes"><thead><tr><th scope="col">Index futures</th><th scope="col">Friday close</th><th scope="col">6:20 AM PT</th><th scope="col">Change</th></tr></thead><tbody>{quotes.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td className="mono">{formatPrice(row.fridayClose)}</td><td className="mono">{formatPrice(row.scanPrice)}</td><td className={`mono ${row.changePercent === null ? '' : row.changePercent < 0 ? 'negative' : row.changePercent > 0 ? 'positive' : ''}`}>{formatChange(row.changePercent)}</td></tr>)}</tbody></table></div>}<p>{note.body}</p><div className="briefing-source"><span><strong>{note.source}</strong>{(note.publishedAt || note.asOf) && <small>{new Date((note.publishedAt || note.asOf)!).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</small>}</span><a href={note.url} target="_blank" rel="noreferrer">{imported ? 'Reference' : 'Source'} ↗</a></div></article>;
      }) : <div className="briefing-empty">No notes supplied for this section.</div>}</div>
    </section>)}
    </div>
  </section>;
}
