import { useEffect, useState } from 'react';
import { ArrowLeft, Archive, ChevronRight } from 'lucide-react';
import { loadArchiveCatalog, type ArchiveEntry } from '@/data/archiveCatalog';
import ThemeToggle from '@/shared/ThemeToggle';

const formatDate = (date: string) => new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));

const statusLabel: Record<ArchiveEntry['status'], string> = {
  archived: 'Archived', partial: 'Partial capture', imported: 'Legacy example', frozen: 'Frozen snapshot',
};

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadArchiveCatalog(window.location.href, controller.signal)
      .then((catalog) => setEntries(catalog.entries))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'The archive could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, []);

  return <div className="app-shell archive-page">
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-leading"><a href="./index.html" className="brand" aria-label="The Warren home"><span className="brand-mark">W</span></a><a className="brief-builder-link" href="./index.html"><ArrowLeft size={15}/> Morning brief</a><a className="brief-builder-link" href="./briefing-builder.html">Build your brief</a></div>
        <time className="topbar-date">Snapshot archive</time>
        <ThemeToggle/>
      </div>
    </header>
    <main className="archive-main">
      <section className="archive-heading"><div className="eyebrow">THE WARREN / DAILY BRIEFS</div><h1>Snapshot archive<span className="title-dot">.</span></h1><p>Each date opens the saved briefing and scanner packet from that session.</p></section>
      {error ? <div className="archive-state" role="alert"><strong>Archive unavailable</strong><span>{error}</span></div> : !loaded ? <div className="archive-state" role="status">Loading archived snapshots…</div> : entries.length ? <ol className="archive-list">{entries.map((entry) => <li key={`${entry.sessionDate}:${entry.file}`}><a className="archive-entry" href={`./index.html?date=${entry.sessionDate}`}><span className="archive-entry-icon"><Archive size={18}/></span><span className="archive-entry-copy"><strong>{formatDate(entry.sessionDate)}</strong><small>{entry.file}</small></span><span className={`archive-status archive-status-${entry.status}`}>{statusLabel[entry.status]}</span><ChevronRight className="archive-entry-arrow" size={18}/></a></li>)}</ol> : <div className="archive-state">No dated snapshots have been archived yet.</div>}
    </main>
  </div>;
}
