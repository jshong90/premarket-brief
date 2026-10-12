'use client';

import { SectionJump } from '@/components/brief/SectionJump';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowDownUp, ArrowUpRight, ChevronRight, CircleHelp, Database, Info, LockKeyhole, Search, ShieldCheck, Sunrise, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IMPORTED, metrics, topRelativeStrength, type Snapshot, type Instrument, type BenchmarkId } from '@/lib/scanner';
import { loadSnapshot } from '@/data/snapshotRepository';
import { readBriefingTopics, type BriefingTopicSelection } from '@/lib/briefingTopics';
import MorningBrief from '@/features/briefing/MorningBrief';
import MassiveConnectionTest from '@/features/connections/MassiveConnectionTest';
import DesignLabs from '@/features/design-lab/DesignLabs';
import { DashboardHeader } from './DashboardHeader';
import { ScannerOverview } from './ScannerOverview';
import { ResilienceScale } from './ResilienceScale';
import { number, quotePrice, percent, signed, clock, tone } from './scannerDisplay';

type SortKey='ticker'|'drawdown'|'capture'|'advantage'|'recovery';
const dataConnectionRows = [
  { field:'SPX premarket reference', sources:[{label:'OpenMarket MCP',url:'https://openmarket.xyz/'}], detail:'HYPERLIQUID_HIP3 / xyz:SP500 is a temporary proxy, not the SPX cash index. Compare only with the same instrument’s prior close.' },
  { field:'SPY, QQQ and equity quotes', sources:[{label:'Robinhood MCP',url:'https://robinhood.com/'},{label:'Public.com MCP',url:'https://public.com/'}], detail:'Robinhood is primary; Public.com is the quote fallback. Each displayed input retains its source and observation time.' },
  { field:'U.S. Treasury yields', sources:[{label:'Robinhood MCP',url:'https://robinhood.com/'},{label:'Public.com MCP',url:'https://public.com/'}], detail:'Keep the observation timestamp. Stale or unsupported readings stay blank.' },
  { field:'VIX', sources:[{label:'TradingView Official MCP',url:'https://www.tradingview.com/'}], detail:'CBOE:VIX; retain the actual observation time.' },
  { field:'ES/NQ quotes and Key Levels', sources:[{label:'OpenMarket MCP',url:'https://openmarket.xyz/'}], detail:'Use the configured charts and record the symbol, time and covered window. Disclose any CME-related proxy; leave unbounded or unverified levels blank.' },
  { field:'Scanner reference data', sources:[{label:'TradingView Official MCP',url:'https://www.tradingview.com/'}], detail:'Timestamped futures observations support the comparison set; incomplete inputs remain unranked.' },
  { field:'Equity-universe discovery', sources:[{label:'Robinhood MCP',url:'https://robinhood.com/'}], detail:'Report the discovered count and disclose coverage gaps; do not claim complete discovery without evidence.' },
  { field:'U.S. economic releases', sources:[{label:'Trading Economics',url:'https://tradingeconomics.com/calendar'}], detail:'Upcoming U.S. events rated at least two stars; verify dates and ET release times.' },
  { field:'Fed policy events, releases and speakers', sources:[{label:'Trading Economics',url:'https://tradingeconomics.com/calendar'},{label:'Federal Reserve',url:'https://www.federalreserve.gov/newsevents/calendar.htm'}], detail:'Trading Economics is primary; official Fed and Reserve Bank pages are backup verification.' },
  { field:'Treasury auctions and offering sizes', sources:[{label:'TreasuryDirect',url:'https://www.treasurydirect.gov/auctions/upcoming/'},{label:'U.S. Treasury',url:'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding'}], detail:'Use official auction schedules and Treasury announcements for offering sizes.' },
  { field:'Earnings and market-cap screen', sources:[{label:'Earnings Whispers',url:'https://www.earningswhispers.com/calendar'},{label:'StockAnalysis',url:'https://stockanalysis.com/list/biggest-companies/'}], detail:'Include companies strictly above $25B market cap; retain dated capitalization evidence.' },
  { field:'Overnight news', sources:[], detail:'User-provided only. No outside news search or scraping.' },
];
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
    const panels=Array.from(document.querySelectorAll<HTMLElement>('.rankings, .distribution'));
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
  const rows=useMemo(()=>topStocks.filter(r=>(sector==='all'||r.sector===sector)&&`${r.ticker} ${r.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(av==null)return bv==null?a.rsRank-b.rsRank:1;if(bv==null)return-1;const result=typeof av==='string'?av.localeCompare(String(bv)):av-Number(bv);return(sort.asc?result:-result)||a.rsRank-b.rsRank;}),[topStocks,sector,query,sort]);
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
        <section className="rankings panel">
          <div className="panel-heading"><div><h2>Stock scanner</h2><span className="section-meta">Top 25 by downside capture.</span></div><button className="icon-button" aria-label="Open scanner information" onClick={()=>setDrawer('method')}><CircleHelp size={17}/></button></div>
          <div className="ranking-tabs"><Tabs value={tab} onValueChange={changeTab}><TabsList variant="line"><TabsTrigger value="resilience"><ShieldCheck/>Resilience</TabsTrigger><TabsTrigger value="recovery"><ArrowUpRight/>Recovery</TabsTrigger></TabsList></Tabs><span className="tabs-note">{tab==='resilience'?'RELATIVE STRENGTH RANKING':isOpening?'WINDOW LOW → CUTOFF PRICE':'PREMARKET LOW → CUTOFF PRICE'}</span></div>
          <div className="filters"><label className="search-field"><Search size={15}/><input placeholder="Find a top 25 ticker…" aria-label="Find a ticker" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label><Select value={sector} onValueChange={setSector}><SelectTrigger aria-label="Sector filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All sectors</SelectItem>{[...new Set(topStocks.map(r=>r.sector))].sort().map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Select value={benchmark} onValueChange={setBenchmark}><SelectTrigger aria-label="Benchmark selection"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">Auto benchmark</SelectItem><SelectItem value="NQ">NQ · all stocks</SelectItem><SelectItem value="ES">ES · all stocks</SelectItem></SelectContent></Select></div>
          {data.stocks.length===0&&<div className="inline-note"><Info size={15}/><span>No stock scanner rows have been published for this session.</span></div>}
          {tab==='recovery'&&<div className="inline-note"><ArrowUpRight size={15}/><span>Recovery sorts the top 25 separately and never changes the resilience score.{mode==='imported'?' The imported scan has no verified recovery prices.':''}</span></div>}
          {error&&<div className="error-note" role="alert">{error}</div>}
          <Table className="scanner-table"><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead><button onClick={()=>changeSort('ticker')}>Company<ArrowDownUp size={12}/></button></TableHead><TableHead className="num">Prev. Session Close</TableHead><TableHead className="num">{isOpening?'6:35 PT':'6:20 PT'}</TableHead><TableHead className="num"><button onClick={()=>changeSort('drawdown')}>PM DD<ArrowDownUp size={12}/></button></TableHead><TableHead className="bench-col">Bench.</TableHead><TableHead className="num capture-col"><button onClick={()=>changeSort('capture')}>Capture<ArrowDown size={12}/></button></TableHead><TableHead className="num advantage-col"><button onClick={()=>changeSort('advantage')}>RS adv.<ArrowDownUp size={12}/></button></TableHead><TableHead className="class-col">Classification</TableHead><TableHead className="num"><button onClick={()=>changeSort('recovery')}>Recovery<ArrowDownUp size={12}/></button></TableHead></TableRow></TableHeader><TableBody>
            {rows.map(r=><TableRow key={r.ticker} className={tone(r.band)}><TableCell className="rank-col muted">{String(r.rsRank).padStart(2,'0')}</TableCell><TableCell><button className="company" onClick={()=>setSelected(r)}><span className={`ticker-mark ${r.ticker.toLowerCase()}`}>{r.ticker.slice(0,1)}</span><span><strong>{r.ticker}</strong><small>{r.name}</small></span><ChevronRight className="row-chevron" size={13}/></button></TableCell><TableCell className="num mono">{number(r.previousClose)}</TableCell><TableCell className="num mono">{number(r.last)}</TableCell><TableCell className="num mono">{r.drawdown==null?'—':`−${number(r.drawdown)}%`}</TableCell><TableCell className="bench-col"><span className="benchmark-pill">{r.usedBenchmark}</span></TableCell><TableCell className="num capture-col"><div className="capture-value mono">{percent(r.capture,1)}</div><div className="capture-track"><span style={{width:`${Math.min((r.capture??0)/300*100,100)}%`}}/><i/></div></TableCell><TableCell className={`num mono advantage-col ${r.advantage!==null&&r.advantage>0?'positive':r.advantage!==null&&r.advantage<0?'negative':''}`}>{signed(r.advantage,' pp')}</TableCell><TableCell className="class-col"><span className={`classification ${tone(r.band)}`}>{r.band||'No range'}</span></TableCell><TableCell className="num mono">{signed(r.recovery)}</TableCell></TableRow>)}
            {!rows.length&&<TableRow><TableCell colSpan={8}><div className="empty-state"><Database size={28}/><h3>{query||sector!=='all'?'No matching names':'Your next premarket read starts here.'}</h3><p>{query||sector!=='all'?'Try another ticker or sector.':'The daily snapshot will appear here after its data packet is published.'}</p><button className="primary-button" onClick={()=>query||sector!=='all'?(setQuery(''),setSector('all')):setDrawer('connections')}>{query||sector!=='all'?'Clear filters':'Data connections'}<ArrowUpRight size={15}/></button></div></TableCell></TableRow>}
          </TableBody></Table>
          <div className="table-footer"><span>{rows.length} of {topStocks.length} top RS names <span className="divider">/</span> {benchmark==='auto'?'NQ / ES assigned per stock':`All stocks vs ${benchmark}`}</span><span>Click a company for details <ArrowUpRight size={12}/></span></div>
        </section>
        <aside className="right-rail">

          <ResilienceScale onAbout={()=>setDrawer('method')} />
        </aside>
      </div>
      </section>
      <footer className="statusbar"><div><LockKeyhole size={14}/>{data.status==='archived'?'Archived brief · original observation dates retained':isDraftBrief?'Draft · scanner capture pending':mode==='imported'?'Legacy reference · cutoff unverified':data.status==='partial'?'Partial scanner capture':'Frozen daily scanner snapshot'}<span className="divider">/</span><span>Scanner cutoff {cutoffPacific} PT · {cutoffEastern} ET{isOpening?' · opening experiment':''}</span></div><div><span>{data.status==='partial'?`Scanner collected ${clock(data.fetchedAt)} ET · no live refresh`:data.quotesRefreshedAt?`Quotes captured ${clock(data.quotesRefreshedAt)} ET · no live refresh`:isDraftBrief?`Draft prepared ${clock(data.fetchedAt)} ET · no live refresh`:mode==='imported'?'Awaiting a verified daily capture':`Collected ${clock(data.fetchedAt)} ET · no live refresh`}</span></div></footer>
    </main>
    <Sheet open={drawer!==null} onOpenChange={o=>!o&&setDrawer(null)}><SheetContent className="detail-sheet"><SheetHeader><div className="eyebrow">THE WARREN / {drawer==='method'?'SCANNER INFO':'DAILY SNAPSHOT'}</div><SheetTitle>{drawer==='method'?'About the scanner':'Data connections'}</SheetTitle><SheetDescription>{drawer==='method'?'':'Approved sources by field. Each snapshot records the source, observation time and any coverage issue.'}</SheetDescription></SheetHeader>
      {drawer==='method'?<div className="drawer-body"><p>{isOpening?'This experiment uses an alternate capture.':'The scanner uses premarket price ranges and some comparison rules to calculate relative strength.'} Results are based on the best available data and are intended as an aid, not a signal.</p></div> :<div className="drawer-body"><div className="formula-card"><span>DAILY CAPTURE</span><strong>{cutoffPacific} AM Pacific</strong><p>{isOpening?'Alternate capture.':'09:20 AM Eastern.'} Follows daylight saving time.</p></div><h3>Approved source map</h3><div className="data-connections-table-wrap"><table className="data-connections-table"><thead><tr><th scope="col">Input</th><th scope="col">Source</th><th scope="col">Rule</th></tr></thead><tbody>{dataConnectionRows.map(row=><tr key={row.field}><td data-label="Input">{row.field}</td><td data-label="Source">{row.sources.length?row.sources.map((source,index)=><span key={source.url}>{index>0&&' → '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>):'User supplied'}</td><td data-label="Rule">{row.detail}</td></tr>)}</tbody></table></div><p className="connection-note">The sector-strength panel is retired. Massive remains a connection diagnostic only; it is not in the approved quote order.</p><MassiveConnectionTest sessionDate={data.sessionDate}/><h3>Snapshot timing</h3><p>Each session is a fixed premarket capture. Actual observation and retrieval times are retained; delayed, incomplete, or unsupported inputs are labeled.</p><p>The dashboard reads its published packet once when opened. Snapshot updates happen separately.</p><div className="provider-note"><ShieldCheck size={17}/><p>Generating and publishing the next snapshot happens separately from this static prototype.</p></div><button className="primary-button" onClick={()=>setDrawer(null)}>Back to scanner<ChevronRight size={15}/></button></div>}
    </SheetContent></Sheet>
    <Sheet open={!!selected} onOpenChange={o=>!o&&setSelected(null)}><SheetContent className="detail-sheet"><SheetHeader><div className="eyebrow">INSTRUMENT DETAIL / {selected?.sector}</div><SheetTitle>{selected?.ticker} <span className="muted">{selected?.name}</span></SheetTitle><SheetDescription>{dateLabel} · {mode==='imported'?'Cutoff unverified':`04:00–${cutoffEastern} ET`}</SheetDescription></SheetHeader>{selected&&selectedMetrics&&<div className="drawer-body"><div className={`detail-score ${tone(selectedMetrics.band)}`}><span>DOWNSIDE CAPTURE</span><strong>{percent(selectedMetrics.capture,1)}</strong><span>{selectedMetrics.band||'Awaiting data'}</span></div><dl className="detail-metrics">{[['Previous session close',number(selected.previousClose)],[isOpening?'Window high':'Premarket high',number(selected.high)],[isOpening?'Window low':'Premarket low',number(selected.low)],[`Price at ${cutoffPacific} AM PT`,number(selected.last)],['Range drawdown',percent(selected.drawdown)],['RS advantage',signed(selectedMetrics.advantage,' pp')],['Recovery from low',signed(selectedMetrics.recovery)],['Change vs previous close',signed(selectedMetrics.absolute)],['Premarket volume',number(selected.volume,0)],['Market capitalization',selected.marketCap===null?'—':`$${number(selected.marketCap/1e9,1)}B`],['Last observation',selected.asOf?`${clock(selected.asOf)} ET`:'Not supplied']].map(([k,v])=><div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>)}</dl><div className="inline-note"><Info size={16}/><p>{selected.source}{selected.issue?` · ${selected.issue}`:''}</p></div>{mode==='imported'&&<p className="muted">Only an approximate drawdown was supplied for this stock. Missing prices are left blank.</p>}</div>}</SheetContent></Sheet>
    {isDevelopmentMode&&<DesignLabs/>}
  </div>;
}




