import type { ReactNode } from 'react';
import { SectionHeading } from './SectionHeading';

const cardRoles = {
  notes: { surface: 'briefing-section panel', body: 'briefing-notes' },
  commentary: { surface: 'briefing-section panel', body: 'commentary-card-body' },
  levels: { surface: 'briefing-section panel key-levels-section', body: 'briefing-notes' },
  overnight: { surface: 'briefing-section panel overnight-combined-section', body: null },
} as const;

/** Card roles preserve the existing inset and motion hooks, without style overrides. */
export function BriefCard({ id, number, title, role = 'notes', children }: {
  id: string;
  number: number;
  title: string;
  role?: keyof typeof cardRoles;
  children: ReactNode;
}) {
  const classes = cardRoles[role];
  return <section className={classes.surface} aria-labelledby={id}>
    <SectionHeading id={id} number={number} title={title} />
    {classes.body ? <div className={classes.body}>{children}</div> : children}
  </section>;
}
