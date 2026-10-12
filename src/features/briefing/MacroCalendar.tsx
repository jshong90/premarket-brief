import type { Briefing } from '@/lib/scanner';
import { groupMacroCalendarRows, normalizeMacroCalendar } from '@/lib/macroCalendar';

export function MacroCalendarTable({ notes, sessionDate }: { notes: Briefing['macro']; sessionDate: string }) {
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
