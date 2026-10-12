import type { Snapshot } from '@/lib/scanner';
import { LockKeyhole } from 'lucide-react';
import { clock } from './scannerDisplay';

export function SnapshotStatus({ data, mode, isDraftBrief, isOpening, cutoffPacific, cutoffEastern }: { data: Snapshot; mode: string; isDraftBrief: boolean; isOpening: boolean; cutoffPacific: string; cutoffEastern: string }) {
  return <footer className="statusbar"><div><LockKeyhole size={14}/>{data.status==='archived'?'Archived brief · original observation dates retained':isDraftBrief?'Draft · scanner capture pending':mode==='imported'?'Legacy reference · cutoff unverified':data.status==='partial'?'Partial scanner capture':'Frozen daily scanner snapshot'}<span className="divider">/</span><span>Scanner cutoff {cutoffPacific} PT · {cutoffEastern} ET{isOpening?' · opening experiment':''}</span></div><div><span>{data.status==='partial'?`Scanner collected ${clock(data.fetchedAt)} ET · no live refresh`:data.quotesRefreshedAt?`Quotes captured ${clock(data.quotesRefreshedAt)} ET · no live refresh`:isDraftBrief?`Draft prepared ${clock(data.fetchedAt)} ET · no live refresh`:mode==='imported'?'Awaiting a verified daily capture':`Collected ${clock(data.fetchedAt)} ET · no live refresh`}</span></div></footer>;
}
