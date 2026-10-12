'use client';

import { filterScannerRows } from './scannerRows';

import { SectionJump } from '@/components/brief/SectionJump';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, Info, LockKeyhole } from 'lucide-react';
import { IMPORTED, metrics, topRelativeStrength, type Snapshot, type Instrument, type BenchmarkId } from '@/lib/scanner';
import { loadSnapshot } from '@/data/snapshotRepository';
import { readBriefingTopics, type BriefingTopicSelection } from '@/lib/briefingTopics';
import MorningBrief from '@/features/briefing/MorningBrief';
import DesignLabs from '@/features/design-lab/DesignLabs';
import { DashboardHeader } from './DashboardHeader';
import { ScannerOverview } from './ScannerOverview';
import { ResilienceScale } from './ResilienceScale';

import type { SortKey } from './scannerTypes';
import { ScannerRankings } from './ScannerRankings';
import { SnapshotStatus } from './SnapshotStatus';
import { ScannerInfoDrawer } from './ScannerInfoDrawer';
import { InstrumentDrawer } from './InstrumentDrawer';
export default function Scanner() {
  const [data,setData] = useState<Snapshot>(IMPORTED);
  const [snapshotLoaded,setSnapshotLoaded] = useState(false);
  const [compactHeader,setCompactHeader] = useState(false);
  const [briefingTopics,setBriefingTopics] = useState<BriefingTopicSelection | null>(null);
  useEffect(()=>{setBriefingTopics(readBriefingTopics());},[]);
  useEffect(()=>{
    const mobile=window.matchMedia('(max-width: 640px)');
    let frame=0;
    const update=()=>{
      if(frame)return;
      frame=window.requestAnimationFrame(()=>{
        setCompactHeader(mobile.matches&&window.scrollY>40);
        frame=0;
      });
    };
    window.addEventListener('scroll',update,{passive:true});
    mobile.addEventListener('change',update);
    update();
    return()=>{window.removeEventListener('scroll',update);mobile.removeEventListener('change',update);if(frame)window.cancelAnimationFrame(frame);};
  },[]);
  useEffect(()=>{
    const update=()=>{const header=document.querySelector('.topbar');document.documentElement.style.setProperty('--dashboard-offset',`${(header?.getBoundingClientRect().height||180)+24}px`);};
    const observer=new ResizeObserver(update);
    const header=document.querySelector('.topbar');if(header)observer.observe(header);
    update();return()=>observer.disconnect();
  },[snapshotLoaded]);
  useEffect(()=>{
    const headings=Array.from(document.querySelectorAll<HTMLElement>('.dashboard-section > .page-heading .section-heading-row'));
    const setVisible=(heading:HTMLElement,visible:boolean)=>{
      heading.classList.toggle('is-revealed',visible);
      heading.closest('.page-heading')?.classList.toggle('is-revealed',visible);
    };
    if(!('IntersectionObserver' in window)){headings.forEach(heading=>setVisible(heading,true));return;}
    const reveal=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>setVisible(entry.target as HTMLElement,entry.intersectionRatio>=0.15));
    },{threshold:0.15,rootMargin:'0px 0px -48px 0px'});
    headings.forEach((heading)=>reveal.observe(heading));
    return()=>reveal.disconnect();
  },[snapshotLoaded]);
  useEffect(()=>{
    const panels=Array.from(document.querySelectorAll<HTMLElement>('.rankings'));
    if(!('IntersectionObserver' in window)){panels.forEach(panel=>panel.classList.add('bars-visible'));return;}
    const reveal=new IntersectionObserver(entries=>{
      for(const entry of entries){
        entry.target.classList.toggle('bars-visible',entry.isIntersecting);
      }
    },{threshold:0,rootMargin:'0px 0px -32px 0px'});
    panels.forEach(panel=>reveal.observe(panel));
    return()=>reveal.disconnect();
  },[snapshotLoaded]);
  useEffect(()=>{
    const groups=['.morning-sections > .panel','.benchmark-grid > .benchmark-card','.work-grid .panel'];
    const configuredStagger=Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lab-card-stagger'))||70;
    const cards=groups.flatMap(selector=>Array.from(document.querySelectorAll<HTMLElement>(selector)).map((card,index)=>{
      card.classList.add('viewport-card');
      card.style.setProperty('--card-reveal-delay',`${Math.min(index,3)*configuredStagger}ms`);
      return card;
    }));
    if(!('IntersectionObserver' in window)){cards.forEach(card=>card.classList.add('is-in-view'));return;}
    const reveal=new IntersectionObserver(entries=>{
      for(const entry of entries)entry.target.classList.toggle('is-in-view',entry.isIntersecting);
    // A full stock table can be much taller than the viewport; a percentage
    // threshold would leave the entire panel permanently transparent.
    },{threshold:0,rootMargin:'0px 0px -48px 0px'});
    cards.forEach(card=>reveal.observe(card));
    return()=>reveal.disconnect();
  },[data,snapshotLoaded]);

  useEffect(()=>{
    if(!snapshotLoaded)return;
    const root=document.documentElement;
    const briefCards=Array.from(document.querySelectorAll<HTMLElement>('.morning-sections > .panel'));
    const scannerCards=Array.from(document.querySelectorAll<HTMLElement>('.benchmark-grid > .benchmark-card, .work-grid .panel'));
    briefCards.forEach(node=>node.dataset.parallaxLayer='brief');
    scannerCards.forEach(node=>node.dataset.parallaxLayer='scanner');
    const parallaxCards=[...new Set([...briefCards,...scannerCards])];
    let frame=0;
    const schedule=()=>{
      if(frame)return;
      frame=window.requestAnimationFrame(()=>{
        frame=0;
        const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.devReducedMotion==='true';
        const active=root.dataset.parallaxEnabled!=='false'&&!reduced;
        const parsed=(value:string|undefined,fallback:number)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
        const speed=Math.max(0,Math.min(1,parsed(root.dataset.parallaxSpeed,0.22)));
        const depth=Math.max(0,Math.min(120,parsed(root.dataset.parallaxDepth,28)));
        const direction=root.dataset.parallaxDirection==='reverse'?-1:1;
        const spacing=Math.max(12,parsed(root.dataset.chartGridSpacing,48));
        const gridEnabled=root.dataset.chartGrid!=='false';
        const gridMoves=root.dataset.parallaxGrid!=='false';
        const shift=active&&gridEnabled&&gridMoves?(window.scrollY*speed*direction%spacing):0;
        root.style.setProperty('--warren-chart-grid-y',String(shift)+'px');
        const viewportHeight=Math.max(window.innerHeight,1);
        const updates=parallaxCards.map(node=>{
          const layer=node.dataset.parallaxLayer;
          const layerEnabled=layer==='brief'?root.dataset.parallaxBrief!=='false':root.dataset.parallaxScanner!=='false';
          const rect=node.getBoundingClientRect();
          const progress=Math.max(-1,Math.min(1,(rect.top+rect.height/2-viewportHeight/2)/(viewportHeight/2)));
          const y=active&&layerEnabled?progress*depth*speed*direction:0;
          return[node,y] as const;
        });
        for(const [node,y] of updates)node.style.setProperty('--warren-parallax-y',String(y.toFixed(2))+'px');
      });
    };
    const observer=new MutationObserver(schedule);
    observer.observe(root,{attributes:true,attributeFilter:['data-parallax-enabled','data-parallax-speed','data-parallax-depth','data-parallax-direction','data-parallax-grid','data-parallax-brief','data-parallax-scanner','data-chart-grid','data-chart-grid-spacing','data-dev-reduced-motion']});
    const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    motionPreference.addEventListener('change',schedule);
    schedule();
    return()=>{observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);motionPreference.removeEventListener('change',schedule);if(frame)window.cancelAnimationFrame(frame);parallaxCards.forEach(node=>{delete node.dataset.parallaxLayer;node.style.removeProperty('--warren-parallax-y');});root.style.removeProperty('--warren-chart-grid-y');};
  },[data,snapshotLoaded]);

  const mode = data.status==='imported' ? 'imported' : 'snapshot';
  const [error,setError] = useState('');
  const [tab,setTab] = useState('resilience');
  const [query,setQuery] = useState('');
  const [sector,setSector] = useState('all');
  const [benchmark,setBenchmark] = useState('auto');
  const [sort,setSort] = useState<{key:SortKey;asc:boolean}>({key:'capture',asc:true});
  const [drawer,setDrawer] = useState<'method'|'connections'|null>(null);
  const [selected,setSelected] = useState<Instrument|null>(null);
  useEffect(()=>{
    // Read one published data packet per page load. Never poll market prices.
    if (window.location.protocol==='file:') { setError('Snapshot loading requires an HTTP or HTTPS deployment.'); return; }
    const controller=new AbortController();
    loadSnapshot({ search: window.location.search, baseUrl: window.location.href, signal: controller.signal })
      .then(packet=>{setData(packet);setSnapshotLoaded(true);})
      .catch(e=>{if(e.name!=='AbortError'){setError(e.message||'The snapshot could not be loaded.');setSnapshotLoaded(false);}});
    return()=>controller.abort();
  },[]);
  const topStocks=useMemo(()=>topRelativeStrength(data.stocks.map(r=>{const b=benchmark==='auto'?r.benchmark:benchmark as BenchmarkId;return{...r,usedBenchmark:b,...metrics(r,data.benchmarks.find(x=>x.id===b))};})),[data,benchmark]);
  const rows=useMemo(()=>filterScannerRows(topStocks,query,sector,sort),[topStocks,sector,query,sort]);
  const leaders=useMemo(()=>data.stocks.map(row=>({row,capture:metrics(row,data.benchmarks.find(b=>b.id===(benchmark==='auto'?row.benchmark:benchmark))).capture})).filter(({capture})=>capture!==null&&capture<70).sort((a,b)=>a.capture!-b.capture!||a.row.ticker.localeCompare(b.row.ticker)).slice(0,5).map(({row})=>row),[data,benchmark]);
  const counts=useMemo(()=>{const c:Record<string,number>={};for(const r of data.stocks){const b=benchmark==='auto'?r.benchmark:benchmark;const band=metrics(r,data.benchmarks.find(x=>x.id===b)).band;if(band)c[band]=(c[band]||0)+1;}return c;},[data,benchmark]);
  const validCount=Object.values(counts).reduce((a,b)=>a+b,0);
  const changeSort=(key:SortKey)=>setSort(s=>({key,asc:s.key===key?!s.asc:key!=='advantage'&&key!=='recovery'}));
  const changeTab=(t:string)=>{setTab(t);setSort({key:t==='recovery'?'recovery':'capture',asc:t!=='recovery'});};
  const formatDateLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const dateLabel=data.sessionDate?formatDateLabel(data.sessionDate):'Current session';
  const isArchivePreview=/^\d{4}-\d{2}-\d{2}$/.test(new URLSearchParams(window.location.search).get('date')||'');
  const isDraftBrief=data.status==='draft';
  const isOpening=data.scanVariant==='opening-0635';
  const cutoffPacific=isOpening?'06:35':'06:20';
  const cutoffEastern=isOpening?'09:35':'09:20';
  const isDevelopmentMode=new URLSearchParams(window.location.search).get('dev')==='1';
  const pageDateLabel=dateLabel;
  const archiveDate=data.previousArchiveDate;
  const latestHref=isDevelopmentMode?'./index.html?dev=1':'./index.html';
  const builderHref=`./briefing-builder.html${isArchivePreview?`?date=${new URLSearchParams(window.location.search).get('date')}${isDevelopmentMode?'&dev=1':''}`:isDevelopmentMode?'?dev=1':''}`;
  const archiveHref=archiveDate?`./index.html?date=${archiveDate}${isDevelopmentMode?'&dev=1':''}`:latestHref;
  const selectedMetrics=selected?metrics(selected,data.benchmarks.find(b=>b.id===(benchmark==='auto'?selected.benchmark:benchmark))):null;

  const toolState=useRef({rows,topStocks,mode,sector,benchmark,query,data});
  useEffect(()=>{toolState.current={rows,topStocks,mode,sector,benchmark,query,data};},[rows,topStocks,mode,sector,benchmark,query,data]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?: {registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools=[{
      name:'read_rs_scan',title:'Read the relative strength scan',description:'Read the visible scan and its provenance. Imported data is unverified; unavailable scores remain null.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},
      execute(input:unknown){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No parameters are accepted.');const s=toolState.current;return {mode:s.mode,date:s.data.sessionDate,status:s.data.status,scanVariant:s.data.scanVariant??null,cutoffAt:s.data.cutoffAt??null,filters:{sector:s.sector,benchmark:s.benchmark,query:s.query},rows:s.rows.map(r=>({ticker:r.ticker,rsRank:r.rsRank,drawdown:r.drawdown,capture:r.capture,band:r.band,recovery:r.recovery,source:r.source,asOf:r.asOf}))};}
    },{
      name:'set_rs_filters',title:'Set scanner filters',description:'Change the visible ticker search, sector, and benchmark. Does not fetch market data or change connections.',inputSchema:{type:'object',properties:{query:{type:'string'},sector:{type:'string'},benchmark:{type:'string',enum:['auto','NQ','ES']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute(input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected a filters object.');const p=input as Record<string,unknown>;if(Object.keys(p).some(k=>!['query','sector','benchmark'].includes(k)))throw new Error('Unknown filter.');if(p.query!==undefined&&(typeof p.query!=='string'||p.query.length>60))throw new Error('Search must be at most 60 characters.');if(p.benchmark!==undefined&&!['auto','NQ','ES'].includes(String(p.benchmark)))throw new Error('Unknown benchmark.');if(p.sector!==undefined&&p.sector!=='all'&&!toolState.current.topStocks.some(r=>r.sector===p.sector))throw new Error('Unknown sector.');flushSync(()=>{if(p.query!==undefined)setQuery(p.query as string);if(p.sector!==undefined)setSector(p.sector as string);if(p.benchmark!==undefined)setBenchmark(p.benchmark as string);});return{query:toolState.current.query,sector:toolState.current.sector,benchmark:toolState.current.benchmark};}
    }];
    for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return()=>lifecycle.abort();
  },[]);

  if (!snapshotLoaded) return <main className="snapshot-load-state" role={error?'alert':'status'} aria-live="polite"><div className="snapshot-load-card"><span className="snapshot-load-mark">W</span><h1>{error?'Snapshot unavailable':'Loading morning snapshot'}</h1><p>{error||'Checking the published snapshot and its required fields…'}</p>{error&&<button type="button" onClick={()=>window.location.reload()}>Try again</button>}</div></main>;

  return <div className="app-shell">
    <DashboardHeader data={data} compactHeader={compactHeader} isArchivePreview={isArchivePreview}
      archiveDate={archiveDate} archiveLabel={archiveDate ? formatDateLabel(archiveDate) : ''}
      latestHref={latestHref} archiveHref={archiveHref} builderHref={builderHref}
      pageDateLabel={pageDateLabel} cutoffPacific={cutoffPacific} onConnections={()=>setDrawer('connections')} />
    <main>
      <MorningBrief data={data} error={error} archived={isArchivePreview} topics={briefingTopics}/>

      <section id="relative-strength" className="dashboard-section" aria-labelledby="scanner-title" tabIndex={-1}>
      <div className="page-heading centered-heading">
        <div className="heading-center"><div className="eyebrow">THE PREMARKET READ <span>/</span> RS SCANNER V1</div><div className="section-heading-row"><h2 id="scanner-title" className="section-title">Relative strength<span className="title-dot">.</span></h2></div><p>Who held up when the market sold off?</p></div>
        <SectionJump target="morning-brief">Back to morning brief ↑</SectionJump>
        <div className="heading-meta"><span className="session-chip"><LockKeyhole size={13}/>{isDraftBrief?'DRAFT':isArchivePreview?'ARCHIVE COPY':mode==='imported'?'LEGACY EXAMPLE':isOpening?'OPENING EXPERIMENT':data.status==='partial'?'PARTIAL SNAPSHOT':'FROZEN SNAPSHOT'}</span></div>
      </div>
      <div className={`source-notice ${mode==='imported'?'is-imported':''}`}>
        <Info size={16}/><div>{isDraftBrief?<><strong>{dateLabel} brief · draft</strong><span>{data.messages[0]||'Premarket inputs and cutoff ranges are pending.'}</span></>:isArchivePreview?<><strong>{dateLabel} archive</strong><span>{data.messages[0]||'Archived snapshot.'}</span></>:mode==='imported'?<><strong>Legacy example · cutoff unverified</strong><span>Earlier approximate drawdowns. The daily scanner cutoff is 06:20 Pacific.</span></>:<><strong>{isOpening?'Opening experiment':'Frozen scanner'} at {cutoffPacific} Pacific · {data.status==='partial'?'partial coverage':data.status==='unavailable'?'data unavailable':'daily snapshot'}</strong><span>{data.messages[0]||`Ranges through ${cutoffEastern} ET.`}</span></>}</div>
        {!isArchivePreview && data.sessionDate==='2026-10-01' && <a className="text-link" href={isOpening?'./index.html?dev=1':'./index.html?dev=1&scan=0635'}>{isOpening?'Compare 06:20 baseline':'Compare 06:35 experiment'} <ArrowUpRight size={13}/></a>}
      </div>
      <ScannerOverview data={data} mode={mode} isOpening={isOpening} cutoffEastern={cutoffEastern}
        counts={counts} leaders={leaders} validCount={validCount} onSelect={setSelected} />
      <div className="work-grid">
        <ScannerRankings data={data} rows={rows} topStocks={topStocks} tab={tab} isOpening={isOpening}
          mode={mode} error={error} query={query} sector={sector} benchmark={benchmark}
          setQuery={setQuery} setSector={setSector} setBenchmark={setBenchmark}
          setSelected={setSelected} setDrawer={setDrawer} changeTab={changeTab} changeSort={changeSort} />
        <aside className="right-rail">

          <ResilienceScale onAbout={()=>setDrawer('method')} />
        </aside>
      </div>
      </section>
      <SnapshotStatus data={data} mode={mode} isDraftBrief={isDraftBrief} isOpening={isOpening} cutoffPacific={cutoffPacific} cutoffEastern={cutoffEastern} />
    </main>
    <ScannerInfoDrawer data={data} drawer={drawer} isOpening={isOpening} cutoffPacific={cutoffPacific} onClose={()=>setDrawer(null)} />
    <InstrumentDrawer selected={selected} selectedMetrics={selectedMetrics} dateLabel={dateLabel}
      mode={mode} isOpening={isOpening} cutoffPacific={cutoffPacific} cutoffEastern={cutoffEastern} onClose={()=>setSelected(null)} />
    {isDevelopmentMode&&<DesignLabs/>}
  </div>;
}




