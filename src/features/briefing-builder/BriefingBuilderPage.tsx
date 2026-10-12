import { useEffect, useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import { IMPORTED, type Snapshot } from '@/lib/scanner';
import { loadSnapshot } from '@/data/snapshotRepository';
import { BRIEFING_TOPICS, DEFAULT_BRIEFING_TOPICS, readBriefingTopics, saveBriefingTopics, type BriefingTopicSelection } from '@/lib/briefingTopics';
import MarketStrip from '@/features/market-context/MarketContextStrip';
import MorningBrief from '@/features/briefing/MorningBrief';
import ThemeToggle from '@/shared/ThemeToggle';

const formatDate = (date: string) => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));

export default function BriefingBuilder() {
  const [data, setData] = useState<Snapshot>(IMPORTED);
  const [topics, setTopics] = useState<BriefingTopicSelection>(DEFAULT_BRIEFING_TOPICS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTopics(readBriefingTopics() ?? DEFAULT_BRIEFING_TOPICS);
    const controller = new AbortController();
    loadSnapshot({ search: window.location.search, baseUrl: window.location.href, signal: controller.signal })
      .then((packet) => { setData(packet); setLoaded(true); })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'The snapshot could not be loaded.');
        setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const updateTopic = (id: keyof BriefingTopicSelection, checked: boolean) => {
    const next = { ...topics, [id]: checked };
    setTopics(next);
    saveBriefingTopics(next);
  };
  const selectAll = () => {
    setTopics(DEFAULT_BRIEFING_TOPICS);
    saveBriefingTopics(DEFAULT_BRIEFING_TOPICS);
  };
  const pageDate = data.sessionDate ? formatDate(data.sessionDate) : 'Current session';
  const params = new URLSearchParams(window.location.search);
  const backHref = `./index.html${params.toString() ? `?${params.toString()}` : ''}`;

  if (!loaded) return <main className="snapshot-load-state" role="status"><div className="snapshot-load-card"><span className="snapshot-load-mark">W</span><h1>Loading briefing builder</h1><p>Opening the current snapshot…</p></div></main>;

  return <div className="app-shell brief-builder-page">
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-leading"><a href={backHref} className="brand" aria-label="Return to the morning brief"><span className="brand-mark">W</span></a><a className="brief-builder-link" href={backHref}><ArrowLeft size={15}/> Morning brief</a><a className="brief-builder-link" href="./archive.html"><span>Archive</span></a></div>
        <time className="topbar-date" dateTime={error ? undefined : data.sessionDate}>{error ? 'Snapshot unavailable' : pageDate}</time>
        <ThemeToggle/>
      </div>
      {!error && <MarketStrip data={data}/>}
    </header>
    <main className="brief-builder-main">
      <section className="brief-builder-controls" aria-labelledby="brief-builder-title">
        <div className="builder-heading">
          <div className="eyebrow">YOUR PREMARKET BRIEF</div>
          <h1 id="brief-builder-title">Choose your topics<span className="title-dot">.</span></h1>
          <p>Pick the sections you want in your morning read. Your choices are saved in this browser and applied to the brief.</p>
        </div>
        <div className="builder-options" role="group" aria-label="Briefing topics">
          {BRIEFING_TOPICS.map(({ id, label, description }) => <label className="builder-option" key={id}>
            <input type="checkbox" checked={topics[id]} onChange={(event) => updateTopic(id, event.currentTarget.checked)} />
            <span className="builder-check" aria-hidden="true"><Check size={15}/></span>
            <span className="builder-option-copy"><strong>{label}</strong><small>{description}</small></span>
          </label>)}
        </div>
        <div className="builder-actions">
          <a className="primary-button" href={backHref}>Use this brief <ArrowLeft className="builder-forward-icon" size={15}/></a>
          <button className="secondary-button" type="button" onClick={selectAll}><RotateCcw size={14}/> Select all</button>
          <span className="builder-saved" role="status">Saved automatically</span>
        </div>
        <p className="builder-energy-note">Energy is ready as a section; it will show a placeholder until energy commentary is added to the snapshot.</p>
      </section>
      <section className="brief-builder-preview" aria-labelledby="brief-preview-title">
        <div className="builder-preview-heading"><div><div className="eyebrow">PREVIEW</div><h2 id="brief-preview-title">Your selected brief</h2></div><span>{Object.values(topics).filter(Boolean).length} of {BRIEFING_TOPICS.length} topics</span></div>
        {error ? <div className="brief-builder-error" role="alert"><strong>Brief preview unavailable</strong><p>{error}</p><p>Topic choices remain available and are saved in this browser.</p></div> : <MorningBrief data={data} error="" archived={Boolean(params.get('date'))} topics={topics} showJump={false}/>}
      </section>
    </main>
  </div>;
}
