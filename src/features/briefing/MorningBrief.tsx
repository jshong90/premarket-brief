import { SectionJump } from '@/components/brief/SectionJump';
import { CommentaryNotes } from '@/components/brief/Commentary';
import { BriefCard } from '@/components/brief/BriefCard';
import { BriefStack } from '@/components/brief/BriefLayout';
import type { Briefing, Snapshot } from '@/lib/scanner';
import { hasStructuredEarnings } from '@/lib/earningsCalendar';
import { visibleBriefingSectionKeys, type BriefingSectionKey, type BriefingTopicSelection } from '@/lib/briefingTopics';
import { OvernightMovementsPanel } from './OvernightMovements';
import { MacroCalendarTable } from './MacroCalendar';
import { EarningsCalendar } from './EarningsCalendar';
import { KeyLevelsTable } from './KeyLevelsTable';
import { SourcesCard } from './SourcesCard';

const sections: { key: keyof Briefing | 'keyLevels' | 'energy'; title: string }[] = [
  { key: 'indices', title: 'Overnight movements on the indices' },
  { key: 'bonds', title: 'Overnight movements on bonds' },
  { key: 'keyLevels', title: 'Key Levels' },
  { key: 'energy', title: 'Energy' },
  { key: 'macro', title: 'Upcoming macro events' },
  { key: 'earnings', title: 'Upcoming earnings' },
  { key: 'news', title: 'Overnight news' },
];
export default function MorningBrief({ data, error, archived = false, topics, showJump = true }: { data: Snapshot; error: string; archived?: boolean; topics?: BriefingTopicSelection | null; showJump?: boolean }) {
  const imported = data.status === 'imported';
  const customized = topics !== undefined && topics !== null;
  const selectedTopics = topics ?? { equities: true, bonds: true, energy: true, macro: true, earnings: true, news: true };
  const visibleKeys: BriefingSectionKey[] = customized
    ? visibleBriefingSectionKeys(selectedTopics)
    : ['indices', 'bonds', 'keyLevels', 'energy', 'macro', 'earnings', 'news'];
  const sectionVisible = (key: keyof Briefing | 'keyLevels' | 'energy') => visibleKeys.includes(key);
  const renderSection = ({ key, title }: { key: keyof Briefing | 'keyLevels' | 'energy'; title: string }, sectionIndex: number) => key === 'keyLevels'
    ? <BriefCard id="brief-key-levels" number={sectionIndex} title={title} role="levels" key={key}>
      <KeyLevelsTable data={data} />
    </BriefCard>
    : key === 'indices' ? <OvernightMovementsPanel data={data} key="overnight-movements" showEquities={!customized || selectedTopics.equities} showBonds={!customized || selectedTopics.bonds} />
    : key === 'bonds' ? null
    : key === 'energy' ? <BriefCard id="brief-energy" number={sectionIndex} title={title} role="commentary" key={key}><CommentaryNotes notes={data.briefing?.energy ?? []} empty="No energy commentary supplied for this snapshot." /></BriefCard>
    : <BriefCard id={'brief-' + key} number={sectionIndex} title={title} key={key}>
    {key === 'macro' ? <MacroCalendarTable notes={data.briefing?.macro || []} sessionDate={data.sessionDate} /> : key === 'earnings' && hasStructuredEarnings(data.briefing?.earnings ?? []) ? <EarningsCalendar notes={data.briefing?.earnings ?? []} /> : (data.briefing?.[key] || []).length ? data.briefing![key].map((note, index) => {
      return <article className="briefing-note" key={index}><h3>{note.title}</h3><p>{note.body}</p></article>;
    }) : <div className="briefing-empty">No notes supplied for this section.</div>}
  </BriefCard>;
  return <section id="morning-brief" className="dashboard-section morning-section" aria-labelledby="brief-title" tabIndex={-1}>
    <div className="page-heading centered-heading">
      <div className="heading-center"><div className="section-heading-row"><h1 id="brief-title">Your Morning Brief<span className="title-dot">.</span></h1></div></div>
      {showJump && <SectionJump target="relative-strength">Skip to relative strength <span className="jump-arrow" aria-hidden="true">↓</span></SectionJump>}
      <div className="heading-meta paper-meta"><span className="session-chip">{archived ? 'ARCHIVE COPY' : data.status==='draft' ? 'DRAFT BRIEF' : imported ? 'LEGACY EXAMPLE' : 'DAILY BRIEF'}</span></div>
    </div>
    <BriefStack>{sections.filter((section) => sectionVisible(section.key) && section.key !== 'bonds').map((section, index) => renderSection(section, index + 1))}
      {!customized && <SourcesCard data={data}/>}
    </BriefStack>
  </section>;
}


