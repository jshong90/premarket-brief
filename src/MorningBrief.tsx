import type { Snapshot } from './lib/scanner';

const sections = [
  ['indices','Overnight movements on the indices'],
  ['bonds','Overnight movements on bonds'],
  ['macro','Upcoming macro events'],
  ['earnings','Upcoming earnings'],
  ['news','Overnight news'],
] as const;

type IndexQuoteRow = { label: string; fridayClose: number | null; scanPrice: number | null; changePercent: number | null };
type IndexQuoteNote = { indexQuotes?: IndexQuoteRow[] };
const formatPrice = (value: number | null) => value===null ? '—' : new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
const formatChange = (value: number | null) => value===null ? '—' : `${value>0?'+':''}${value.toFixed(2)}%`;

export default function MorningBrief({data,error}:{data:Snapshot;error:string}) {
  const imported=data.status==='imported';
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading"><div><div className="eyebrow">THE WARREN / THE MORNING READ</div><div className="section-heading-row"><h1 id="brief-title">Morning brief<span className="title-dot">.</span></h1><a className="primary-button section-jump" href="#relative-strength">Skip to relative strength ↓</a></div></div><div className="heading-meta"><span className="date-label">{new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.sessionDate+'T12:00:00Z'))}</span><span className="session-chip">{imported?'USER-PROVIDED NOTES':'09:20 ET SNAPSHOT'}</span></div></div>
    <div className="source-notice"><div><strong>{imported?'Your morning briefing':'Morning snapshot'}</strong><span>{error || (imported?'Figures and headlines supplied by you; not independently verified.':'Source times and coverage are recorded with each note.')}</span></div></div>
    <div className="morning-sections">{sections.map(([key,title],i)=><section className="briefing-section panel" key={key} aria-labelledby={'brief-'+key}>
      <div className="briefing-section-head"><span className="brief-section-number">0{i+1}</span><h2 id={'brief-'+key}>{title}</h2></div>
      <div className="briefing-notes">{(data.briefing?.[key] || []).length ? data.briefing![key].map((note,index)=>{const quotes=(note as typeof note & IndexQuoteNote).indexQuotes;return <article className="briefing-note" key={index}><h3>{note.title}</h3>{quotes?.length>0&&<div className="index-quotes-wrap"><table className="index-quotes"><thead><tr><th scope="col">Index futures</th><th scope="col">Friday close</th><th scope="col">6:20 AM PT</th><th scope="col">Change</th></tr></thead><tbody>{quotes.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td className="mono">{formatPrice(row.fridayClose)}</td><td className="mono">{formatPrice(row.scanPrice)}</td><td className={`mono ${row.changePercent===null?'':row.changePercent<0?'negative':row.changePercent>0?'positive':''}`}>{formatChange(row.changePercent)}</td></tr>)}</tbody></table></div>}<p>{note.body}</p><div className="briefing-source"><span><strong>{note.source}</strong>{(note.publishedAt || note.asOf) && <small>{new Date((note.publishedAt || note.asOf)!).toLocaleString('en-US',{timeZone:'America/New_York'})} ET</small>}</span><a href={note.url} target="_blank" rel="noreferrer">{imported?'Reference':'Source'} ↗</a></div></article>}):<div className="briefing-empty">No notes supplied for this section.</div>}</div>
    </section>)}</div>
  </section>;
}
