import { useViewportBars } from '@/shared/hooks/useViewportBars';
import type { Band } from '@/lib/scanner';
import { ArrowUpRight } from 'lucide-react';
import { tone } from './scannerDisplay';

export function ResilienceScale({ onAbout }: { onAbout: () => void }) {
  const panelRef = useViewportBars();
  return <section ref={panelRef} className="distribution panel"><div className="panel-heading"><h2>The resilience scale</h2></div><div className="distribution-bar" aria-label="Classification distribution">{['Exceptional RS','Clear RS','Moderate RS','Market-like','Laggard'].map(b=><span key={b} className={tone(b as Band)} style={{flex:1}}/>)}</div>{[['Exceptional RS',''],['Clear RS',''],['Moderate RS',''],['Market-like',''],['Laggard','']].map(([label,range])=><div className="scale-row" key={label}><span><i className={tone(label as Band)}/>{label}</span>{range&&<span className="mono">{range}</span>}</div>)}<button className="text-link" onClick={onAbout}>About the scanner <ArrowUpRight size={13}/></button></section>;
}
