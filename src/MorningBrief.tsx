import type { Snapshot } from './lib/scanner';

const sections = [
  ['indices','Overnight movements on the indices'],
  ['bonds','Overnight movements on bonds'],
  ['macro','Upcoming macro events'],
  ['earnings','Upcoming earnings'],
  ['news','Overnight news'],
] as const;

export default function MorningBrief({data,error}:{data:Snapshot;error:string}) {
  const imported=data.status==='imported';
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading"><div><div className="eyebrow">THE WARREN / THE MORNING READ</div><div className="section-heading-row"><h1 id="brief-title">Morning brief<span className="title-dot">.</span></h1><a className="primary-button section-jump" href="#relative-strength">Skip to relative strength ↓</a></div></div><div className="heading-meta"><span className="date-label">{new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.sessionDate+'T12:00:00Z'))}</span><span className="session-chip">{imported?'USER-PROVIDED NOTES':'09:20 ET SNAPSHOT'}</span></div></div>
    <div className="source-notice"><div><strong>{imported?'Your morning briefing':'Morning snapshot'}</strong><span>{error || (imported?'Figures and headlines supplied by you; not independently verified.':'Source times and coverage are recorded with each note.')}</span></div></div>
    <div className="morning-sections">{sections.map(([key,title],i)=><section className="briefing-section panel" key={key} aria-labelledby={'brief-'+key}>
      <div className="briefing-section-head"><span className="brief-section-number">0{i+1}</span><h2 id={'brief-'+key}>{title}</h2></div>
      <div className="briefing-notes">{(data.briefing?.[key] || []).length ? data.briefing![key].map((note,index)=><article className="briefing-note" key={index}><h3>{note.title}</h3><p>{note.body}</p><div className="briefing-source"><span><strong>{note.source}</strong>{(note.publishedAt || note.asOf) && <small>{new Date((note.publishedAt || note.asOf)!).toLocaleString('en-US',{timeZone:'America/New_York'})} ET</small>}</span><a href={note.url} target="_blank" rel="noreferrer">{imported?'Reference':'Source'} ↗</a></div></article>):<div className="briefing-empty">No notes supplied for this section.</div>}</div>
    </section>)}</div>
  </section>;
}
