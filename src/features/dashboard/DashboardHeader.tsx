import type { Snapshot } from '@/lib/scanner';
import { Archive, ChevronLeft, ChevronRight, Clock3, SlidersHorizontal } from 'lucide-react';
import MarketStrip from '@/features/market-context/MarketContextStrip';
import ThemeToggle from '@/shared/ThemeToggle';

type HeaderProps = {
  data: Snapshot; compactHeader: boolean; isArchivePreview: boolean;
  archiveDate: string | undefined; archiveLabel: string; latestHref: string;
  archiveHref: string; builderHref: string; pageDateLabel: string;
  cutoffPacific: string; onConnections: () => void;
};
export function DashboardHeader({ data, compactHeader, isArchivePreview, archiveDate, archiveLabel,
  latestHref, archiveHref, builderHref, pageDateLabel, cutoffPacific, onConnections }: HeaderProps) {
  return <header className={`topbar${compactHeader?' is-compact':''}`}>
      <div className="topbar-main">
        <div className="topbar-leading">{(isArchivePreview||archiveDate)&&<a className="snapshot-nav-link" href={isArchivePreview?latestHref:archiveHref} aria-label={isArchivePreview?'Return to the latest snapshot':`View the ${archiveLabel} archive`} title={isArchivePreview?'Latest snapshot':`Previous snapshot · ${archiveLabel}`}>{isArchivePreview?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}<span>{isArchivePreview?'Latest':archiveDate!.slice(5).replace('-', '/')}</span></a>}<a href={latestHref} className="brand" aria-label="The Warren home"><span className="brand-mark">W</span></a><a className="brief-builder-link" href={builderHref}><SlidersHorizontal size={15}/><span>Build your brief</span></a><a className="brief-builder-link" href="./archive.html"><Archive size={15}/><span>Archive</span></a></div>
        <time className="topbar-date" dateTime={data.sessionDate}>{pageDateLabel}</time>
        <ThemeToggle/><button className="connection-button" onClick={onConnections}><Clock3 size={14}/><span>{cutoffPacific} Pacific</span><ChevronRight size={15}/></button>
      </div>
      <MarketStrip data={data}/>
    </header>;
}
