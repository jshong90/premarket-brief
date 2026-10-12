import { ResponsivePreview } from './ResponsivePreview';
import { ScannerSandbox } from './ScannerSandbox';
import { useState } from 'react';
import ThemeToggle from '@/shared/ThemeToggle';
import DesignLabs from '@/features/design-lab/DesignLabs';
import { BriefCard } from '@/components/brief/BriefCard';
import { BriefStack, OvernightPair } from '@/components/brief/BriefLayout';
import { CommentaryNotes } from '@/components/brief/Commentary';
import { BriefTable } from '@/components/brief/BriefTable';
import { NumericCell } from '@/components/brief/NumericCell';
import { SectionJump } from '@/components/brief/SectionJump';
import { SourcesDisclosure } from '@/components/brief/SourcesDisclosure';
import { ResilienceScale } from '@/features/dashboard/ResilienceScale';

const examples = [
  { label: 'Up', value: 1.25 },
  { label: 'Down', value: -1.25 },
  { label: 'Unchanged', value: 0 },
  { label: 'Unavailable', value: null },
];

/** Isolated synthetic display examples: never loads or publishes a market packet. */
export default function DesignReferencePage() {
  const [showScaleNote, setShowScaleNote] = useState(false);
  const enabled = new URLSearchParams(window.location.search).get('dev') === '1';
  if (!enabled) return <main className="snapshot-load-state"><div className="snapshot-load-card"><h1>Design reference</h1><p>Open the development reference to inspect the shared components.</p><a className="primary-button" href="./design-reference.html?dev=1">Open reference</a></div></main>;

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-main">
      <div className="topbar-leading"><a className="brief-builder-link" href="./index.html?dev=1">Back to dashboard</a></div>
      <span className="topbar-date">Design reference</span><ThemeToggle />
    </div></header>
    <main><section className="dashboard-section" id="morning-brief" aria-labelledby="reference-title" tabIndex={-1}>
      <div className="page-heading centered-heading"><div className="heading-center"><h1 id="reference-title">Shared primitives<span className="title-dot">.</span></h1><p>Primitive and scanner examples are synthetic. The responsive frame separately displays the published dashboard.</p><p>Use the theme toggle and Design Lab to compare the same components in both modes.</p></div><SectionJump target="relative-strength">Jump to controls <span className="jump-arrow" aria-hidden="true">↓</span></SectionJump></div>
      <BriefStack>
        <BriefCard id="reference-text" number={1} title="Text and commentary" role="commentary">
          <CommentaryNotes notes={[
            { title: 'Commentary label', body: 'Body text uses the shared commentary font, size and line height.\nA second line demonstrates preserved paragraph breaks.' },
            { title: 'Another commentary label', body: 'Repeated notes share the same spacing and divider rules.' },
          ]} empty="No commentary supplied." />
        </BriefCard>
        <BriefCard id="reference-pair" number={2} title="Paired layout and numeric roles" role="overnight">
          <OvernightPair equities bonds>
            <section className="overnight-column" aria-labelledby="reference-prices"><h3 id="reference-prices">Price and percentage examples</h3>
              <BriefTable role="indices" columns={['Example', 'Price', 'Change (%)']}>
                {examples.map(row=><tr key={row.label}><th scope="row">{row.label}</th><NumericCell value={row.value === null ? null : 1234.5} format="price" /><NumericCell value={row.value} format="percent" movement="standard" /></tr>)}
              </BriefTable>
              <div className="overnight-commentary"><CommentaryNotes notes={[{title:'Equity-style commentary',body:'Prices and signed changes use their own display roles.'}]} empty="No notes." /></div>
            </section>
            <section className="overnight-column" aria-labelledby="reference-yields"><h3 id="reference-yields">Yield and basis-point examples</h3>
              <BriefTable role="yields" columns={['Example', 'Yield', 'Change']}>
                {examples.map(row=><tr key={row.label}><th scope="row">{row.label}</th><NumericCell value={row.value === null ? null : 5.237} format="yield" /><NumericCell value={row.value} format="basisPoints" movement="inverse" /></tr>)}
              </BriefTable>
              <div className="overnight-commentary"><CommentaryNotes notes={[{title:'Bond-style commentary',body:'Yield increases retain the inverse red/green treatment.'}]} empty="No notes." /></div>
            </section>
          </OvernightPair>
        </BriefCard>
        <BriefCard id="reference-levels" number={3} title="Key-level table and timestamps" role="levels">
          <BriefTable role="levels" columns={['Example', 'High', 'Low']}>
            <tr><th scope="row">Sample range</th><NumericCell value={1250.25} format="price" asOf="2000-01-03T14:19:00Z" /><NumericCell value={1230.5} format="price" asOf="2000-01-03T13:00:00Z" /></tr>
            <tr><th scope="row">Approximate</th><NumericCell value={1250} format="price" approximate /><NumericCell value={null} format="price" /></tr>
          </BriefTable><p className="key-levels-note">Timestamps are synthetic examples dated January 3, 2000.</p>
        </BriefCard>
        <BriefCard id="reference-editorial" number={4} title="Editorial notes and empty states">
          <article className="briefing-note"><h3>Editorial note heading</h3><p>General briefing notes retain their editorial text role, distinct from commentary.</p></article>
          <div className="briefing-empty">No notes supplied for this section.</div>
        </BriefCard>
        <BriefCard id="reference-empty-commentary" number={5} title="Empty commentary" role="commentary"><CommentaryNotes notes={[]} empty="No commentary supplied." /></BriefCard>
        <SourcesDisclosure count={1}><section className="sources-group"><h3>Component documentation</h3><p className="sources-intro">Open and close this card to inspect the shared disclosure transition.</p><ul className="sources-list"><li><a href="https://github.com/jshong90/premarket-brief/blob/main/docs/component-system.md" target="_blank" rel="noreferrer">Component system ↗</a><small>Documentation reference; not a quote source.</small></li></ul></section></SourcesDisclosure>
      </BriefStack>
    </section>
    <section className="dashboard-section" id="relative-strength" aria-labelledby="reference-controls" tabIndex={-1}>
      <div className="page-heading centered-heading"><div className="heading-center"><h2 id="reference-controls" className="section-title">Scale and controls</h2></div><SectionJump target="morning-brief">Back to primitives ↑</SectionJump></div>
      <ResilienceScale onAbout={()=>setShowScaleNote(value=>!value)} />
      {showScaleNote && <div className="inline-note" role="status">The scale uses the same classification colors in both themes.</div>}
    </section><section className="dashboard-section" aria-labelledby="reference-scanner"><h2 id="reference-scanner" className="section-title">Scanner interaction examples</h2><ScannerSandbox /></section><section className="dashboard-section" aria-labelledby="reference-responsive"><h2 id="reference-responsive" className="section-title">Responsive dashboard preview</h2><ResponsivePreview /></section></main><DesignLabs />
  </div>;
}
