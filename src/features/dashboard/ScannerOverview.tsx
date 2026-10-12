import type { Instrument, Snapshot } from '@/lib/scanner';
import { ArrowUpRight, Database, ShieldCheck } from 'lucide-react';
import { clock, number } from './scannerDisplay';

type OverviewProps = {
  data: Snapshot; mode: string; isOpening: boolean; cutoffEastern: string;
  counts: Record<string, number>; leaders: Instrument[]; validCount: number;
  onSelect: (instrument: Instrument) => void;
};
export function ScannerOverview({ data, mode, isOpening, cutoffEastern, counts, leaders, validCount, onSelect }: OverviewProps) {
  return <section className="benchmark-grid" aria-label="Session overview">
        {data.benchmarks.map(b=><article className="benchmark-card" key={b.id}><div className="card-label"><span><strong>{b.id}</strong> {b.id==='NQ'?'NASDAQ 100':'S&P 500'} FUTURES</span><span className="small-tag">{isOpening?'THROUGH OPEN':'OVERNIGHT'}</span></div><div className="benchmark-number">{b.drawdown==null?'—':`−${number(b.drawdown)}%`}<span>drawdown</span></div><div className="benchmark-range"><span>H <b>{number(b.high)}</b><small>{clock(b.highTime)}</small></span><span className="range-arrow">→</span><span>L <b>{number(b.low)}</b><small>{clock(b.lowTime)}</small></span></div><div className="card-foot">{mode==='imported'?'Cutoff unverified':`18:00 → ${cutoffEastern} ET`} <span>{mode==='imported'?'Prior scan':b.source}</span></div></article>)}
        <article className="benchmark-card leader-card"><div className="card-label"><span>RESILIENCE LEADERS</span><ShieldCheck size={16}/></div><div className="benchmark-number accent">{(counts['Exceptional RS']||0)+(counts['Clear RS']||0)}<span>leading names</span></div><div className="leader-tickers">{leaders.map(r=><button key={r.ticker} onClick={()=>onSelect(r)}>{r.ticker}<ArrowUpRight size={12}/></button>)}{!validCount&&<span className="muted">Waiting for complete ranges</span>}</div><div className="card-foot">{counts['Exceptional RS']||0} exceptional <span>{counts['Clear RS']||0} clear RS</span></div></article>
        <article className="benchmark-card coverage-card"><div className="card-label"><span>SCAN COVERAGE</span><Database size={15}/></div><div className="benchmark-number">{validCount}<span>/ {data.universeCount||'—'} names</span></div><div className="coverage-track"><span style={{width:`${data.universeCount?validCount/data.universeCount*100:0}%`}}/></div><div className="card-foot">{mode==='imported'?'12 supplied names':data.universeComplete?'Universe discovery complete':'Universe incomplete'}<span>{mode==='imported'?'Not a full scan':`${data.stocks.filter(r=>r.drawdown===null).length} missing`}</span></div></article>
      </section>;
}
