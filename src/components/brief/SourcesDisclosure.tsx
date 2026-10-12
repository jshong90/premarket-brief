import { useState, type ReactNode } from 'react';

/** A native button toggles the existing animated grid; collapsed links remain inert. */
export function SourcesDisclosure({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className={`sources-card panel ${open ? 'is-open' : ''}`}>
    <button className="sources-summary" type="button" aria-expanded={open} aria-controls="sources-content" onClick={() => setOpen((value) => !value)}><span className="sources-title">Sources</span><span className="sources-count">{count} references</span></button>
    <div className="sources-reveal" aria-hidden={!open} inert={!open}>
      <div className="sources-content" id="sources-content">{children}</div>
    </div>
  </section>;
}
