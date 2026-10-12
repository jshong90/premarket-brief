import type { Briefing } from '@/lib/scanner';
import { eligibleEarningsSessions } from '@/lib/earningsCalendar';

function EarningsTicker({ company }: { company: NonNullable<Briefing['earnings'][number]['sessions']>[number]['companies'][number] }) {
  const cap = (company.marketCap! / 1e9).toFixed(1);
  return <a className="earnings-ticker" href={company.marketCapUrl} target="_blank" rel="noreferrer" title={`${company.name} · $${cap}B market cap`} aria-label={`${company.ticker}, ${company.name}, market cap $${cap} billion`}>{company.ticker}</a>;
}

export function EarningsCalendar({ notes }: { notes: Briefing['earnings'] }) {
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
