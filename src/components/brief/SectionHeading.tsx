/** The id belongs on the heading so its parent section can use aria-labelledby. */
export function SectionHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return <div className="briefing-section-head">
    <span className="brief-section-number">{String(number).padStart(2, '0')}</span>
    <h2 id={id}>{title}</h2>
  </div>;
}
