'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowDownUp, ArrowUpRight, ChevronLeft, ChevronRight, CircleHelp, Database, Info, Clock3, LockKeyhole, Search, ShieldCheck, SlidersHorizontal, Sunrise, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { readSnapshot } from '@/lib/snapshot';
import { IMPORTED, metrics, type Snapshot, type Instrument, type BenchmarkId, type Band } from '@/lib/scanner';
import MarketStrip from './MarketStrip';
import ThemeToggle from './ThemeToggle';
import MorningBrief from './MorningBrief';
import MassiveConnectionTest from './MassiveConnectionTest';
import DesignLabs from './DesignLabs';

const number = (v: number | null | undefined, digits=2) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const percent = (v: number | null | undefined, digits=2) => v == null ? '—' : `${number(v,digits)}%`;
const signed = (v: number | null | undefined, suffix='%') => v == null ? '—' : `${v>0?'+':''}${number(v)}${suffix}`;
const clock = (v: string | null | undefined) => !v ? '—' : new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));
const tone = (band: Band | null) => band === 'Exceptional RS' ? 'exceptional' : band === 'Clear RS' ? 'clear' : band === 'Moderate RS' ? 'moderate' : band === 'Laggard' ? 'laggard' : 'neutral';
type SortKey='ticker'|'drawdown'|'capture'|'advantage'|'recovery';
export default function Scanner() {
  const [data,setData] = useState<Snapshot>(IMPORTED);
  useEffect(()=>{
    const update=()=>{const header=document.querySelector('.topbar');document.documentElement.style.setProperty('--dashboard-offset',`${(header?.getBoundingClientRect().height||180)+24}px`);};
    const observer=new ResizeObserver(update);
    const header=document.querySelector('.topbar');if(header)observer.observe(header);
    update();return()=>observer.disconnect();
  },[]);
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
  },[]);
  useEffect(()=>{
    const panels=Array.from(document.querySelectorAll<HTMLElement>('.rankings, .sector-panel, .distribution'));
    if(!('IntersectionObserver' in window)){panels.forEach(panel=>panel.classList.add('bars-visible'));return;}
    const reveal=new IntersectionObserver(entries=>{
      for(const entry of entries){
        entry.target.classList.toggle('bars-visible',entry.isIntersecting);
      }
    },{threshold:0,rootMargin:'0px 0px -32px 0px'});
    panels.forEach(panel=>reveal.observe(panel));
    return()=>reveal.disconnect();
  },[]);
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
    },{threshold:0.12,rootMargin:'0px 0px -48px 0px'});
    cards.forEach(card=>reveal.observe(card));
    return()=>reveal.disconnect();
  },[data]);

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
    if (window.location.protocol==='file:') return;
    const controller=new AbortController();
    const requestedDate=new URLSearchParams(window.location.search).get('date');
    const snapshotFile=requestedDate==='2026-09-27'?'snapshot-2026-09-27.json':'snapshot.json';
    fetch(new URL(`./data/${snapshotFile}`,window.location.href),{cache:'no-store',signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error(`Snapshot file unavailable (${r.status}).`);return r.json();})
      .then(packet=>setData(readSnapshot(packet)))
      .catch(e=>{if(e.name!=='AbortError')setError(`${e.message} Showing the unverified legacy example.`);});
    return()=>controller.abort();
  },[]);
  const rows=useMemo(()=>data.stocks.map(r=>{const b=benchmark==='auto'?r.benchmark:benchmark as BenchmarkId;return{...r,usedBenchmark:b,...metrics(r,data.benchmarks.find(x=>x.id===b))};}).filter(r=>(sector==='all'||r.sector===sector)&&`${r.ticker} ${r.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(av==null)return bv==null?a.ticker.localeCompare(b.ticker):1;if(bv==null)return-1;const result=typeof av==='string'?av.localeCompare(String(bv)):av-Number(bv);return(sort.asc?result:-result)||a.ticker.localeCompare(b.ticker);}),[data,benchmark,sector,query,sort]);
  const sectors=useMemo(()=>data.sectors.map(r=>({...r,...metrics(r,data.benchmarks.find(x=>x.id==='ES'))})).sort((a,b)=>(a.capture??Infinity)-(b.capture??Infinity)),[data]);
  const counts=useMemo(()=>{const c:Record<string,number>={};for(const r of data.stocks){const b=benchmark==='auto'?r.benchmark:benchmark;const band=metrics(r,data.benchmarks.find(x=>x.id===b)).band;if(band)c[band]=(c[band]||0)+1;}return c;},[data,benchmark]);
  const validCount=Object.values(counts).reduce((a,b)=>a+b,0);
  const changeSort=(key:SortKey)=>setSort(s=>({key,asc:s.key===key?!s.asc:key!=='advantage'&&key!=='recovery'}));
  const changeTab=(t:string)=>{setTab(t);setSort({key:t==='recovery'?'recovery':'capture',asc:t!=='recovery'});};
  const formatDateLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const dateLabel=data.sessionDate?formatDateLabel(data.sessionDate):'Current session';
  const isArchivePreview=new URLSearchParams(window.location.search).get('date')==='2026-09-27';
  const isDevelopmentMode=new URLSearchParams(window.location.search).get('dev')==='1';
  const pageDateLabel=isArchivePreview?formatDateLabel('2026-09-27'):dateLabel;
  const selectedMetrics=selected?metrics(selected,data.benchmarks.find(b=>b.id===(data.sectors.some(s=>s.ticker===selected.ticker)?'ES':benchmark==='auto'?selected.benchmark:benchmark))):null;

  const toolState=useRef({rows,mode,sector,benchmark,query,data});
  useEffect(()=>{toolState.current={rows,mode,sector,benchmark,query,data};},[rows,mode,sector,benchmark,query,data]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?: {registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools=[{
      name:'read_rs_scan',title:'Read the relative strength scan',description:'Read the visible scan and its provenance. Imported data is unverified; unavailable scores remain null.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},
      execute(input:unknown){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No parameters are accepted.');const s=toolState.current;return {mode:s.mode,date:s.data.sessionDate,status:s.data.status,filters:{sector:s.sector,benchmark:s.benchmark,query:s.query},rows:s.rows.map(r=>({ticker:r.ticker,drawdown:r.drawdown,capture:r.capture,band:r.band,recovery:r.recovery,source:r.source,asOf:r.asOf}))};}
    },{
      name:'set_rs_filters',title:'Set scanner filters',description:'Change the visible ticker search, sector, and benchmark. Does not fetch market data or change connections.',inputSchema:{type:'object',properties:{query:{type:'string'},sector:{type:'string'},benchmark:{type:'string',enum:['auto','NQ','ES']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute(input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected a filters object.');const p=input as Record<string,unknown>;if(Object.keys(p).some(k=>!['query','sector','benchmark'].includes(k)))throw new Error('Unknown filter.');if(p.query!==undefined&&(typeof p.query!=='string'||p.query.length>60))throw new Error('Search must be at most 60 characters.');if(p.benchmark!==undefined&&!['auto','NQ','ES'].includes(String(p.benchmark)))throw new Error('Unknown benchmark.');if(p.sector!==undefined&&p.sector!=='all'&&!toolState.current.data.stocks.some(r=>r.sector===p.sector))throw new Error('Unknown sector.');flushSync(()=>{if(p.query!==undefined)setQuery(p.query as string);if(p.sector!==undefined)setSector(p.sector as string);if(p.benchmark!==undefined)setBenchmark(p.benchmark as string);});return{query:toolState.current.query,sector:toolState.current.sector,benchmark:toolState.current.benchmark};}
    }];
    for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    return()=>lifecycle.abort();
  },[]);

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-leading"><a className="snapshot-nav-link" href={isArchivePreview?'./index.html':'./index.html?date=2026-09-27'} aria-label={isArchivePreview?'Return to the latest snapshot':'View the September 27 snapshot preview'} title={isArchivePreview?'Latest snapshot':'Previous snapshot · September 27'}>{isArchivePreview?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}<span>{isArchivePreview?'Latest':'9/27'}</span></a><a href="./index.html" className="brand" aria-label="The Warren home"><span className="brand-mark">W</span></a></div>
        <time className="topbar-date" dateTime={isArchivePreview?'2026-09-27':data.sessionDate}>{pageDateLabel}</time>
        <ThemeToggle/><button className="connection-button" onClick={()=>setDrawer('connections')}><Clock3 size={14}/><span>06:20 Pacific</span><ChevronRight size={15}/></button>
      </div>
      <MarketStrip data={data}/>
    </header>
    <main>
      {isArchivePreview&&<div className="snapshot-preview-banner" role="note"><strong>September 27 preview copy</strong><span>Duplicated from the September 28 snapshot; prices and timestamps have not been verified for September 27.</span></div>}
      <MorningBrief data={data} error={error} dateLabel={isArchivePreview?'September 27, 2026':undefined}/>

      <section id="relative-strength" className="dashboard-section" aria-labelledby="scanner-title" tabIndex={-1}>
      <div className="page-heading centered-heading">
        <div className="heading-center"><div className="eyebrow">THE PREMARKET READ <span>/</span> RS SCANNER V1</div><div className="section-heading-row"><h2 id="scanner-title" className="section-title">Relative strength<span className="title-dot">.</span></h2><a className="primary-button section-jump" href="#morning-brief">Back to morning brief ↑</a></div><p>Who held up when the market sold off?</p></div>
        <div className="heading-meta"><span className="session-chip"><LockKeyhole size={13}/>{isArchivePreview?'PREVIEW COPY':mode==='imported'?'LEGACY EXAMPLE':'FROZEN SNAPSHOT'}</span></div>
      </div>
      <div className={`source-notice ${mode==='imported'?'is-imported':''}`}>
        <Info size={16}/><div>{mode==='imported'?<><strong>Legacy example · cutoff unverified</strong><span>Earlier approximate drawdowns. The daily snapshot freezes at 06:20 Pacific.</span></>:<><strong>Frozen at 06:20 Pacific · {data.status==='partial'?'partial coverage':data.status==='unavailable'?'data unavailable':'daily snapshot'}</strong><span>{data.messages[0]||'Overnight ranges through 09:20 ET. Prices stay fixed for this session.'}</span></>}</div>
        
      </div>
      <section className="benchmark-grid" aria-label="Session overview">
        {data.benchmarks.map(b=><article className="benchmark-card" key={b.id}><div className="card-label"><span><strong>{b.id}</strong> {b.id==='NQ'?'NASDAQ 100':'S&P 500'} FUTURES</span><span className="small-tag">OVERNIGHT</span></div><div className="benchmark-number">{b.drawdown==null?'—':`−${number(b.drawdown)}%`}<span>drawdown</span></div><div className="benchmark-range"><span>H <b>{number(b.high)}</b><small>{clock(b.highTime)}</small></span><span className="range-arrow">→</span><span>L <b>{number(b.low)}</b><small>{clock(b.lowTime)}</small></span></div><div className="card-foot">{mode==='imported'?'Cutoff unverified':'18:00 → 09:20 ET'} <span>{mode==='imported'?'Prior scan':b.source}</span></div></article>)}
        <article className="benchmark-card leader-card"><div className="card-label"><span>RESILIENCE LEADERS</span><ShieldCheck size={16}/></div><div className="benchmark-number accent">{(counts['Exceptional RS']||0)+(counts['Clear RS']||0)}<span>leading names</span></div><div className="leader-tickers">{data.stocks.filter(r=>{const m=metrics(r,data.benchmarks.find(b=>b.id===(benchmark==='auto'?r.benchmark:benchmark)));return m.capture!==null&&m.capture<70;}).slice(0,5).map(r=><button key={r.ticker} onClick={()=>setSelected(r)}>{r.ticker}<ArrowUpRight size={12}/></button>)}{!validCount&&<span className="muted">Waiting for complete ranges</span>}</div><div className="card-foot">{counts['Exceptional RS']||0} exceptional <span>{counts['Clear RS']||0} clear RS</span></div></article>
        <article className="benchmark-card coverage-card"><div className="card-label"><span>SCAN COVERAGE</span><Database size={15}/></div><div className="benchmark-number">{validCount}<span>/ {data.universeCount||'—'} names</span></div><div className="coverage-track"><span style={{width:`${data.universeCount?validCount/data.universeCount*100:0}%`}}/></div><div className="card-foot">{mode==='imported'?'12 supplied names':data.universeComplete?'US common stocks ≥ $50B':'Universe incomplete'}<span>{mode==='imported'?'Not a full scan':`${data.stocks.filter(r=>r.drawdown===null).length} missing`}</span></div></article>
      </section>
      <div className="work-grid">
        <section className="rankings panel">
          <div className="panel-heading"><div><h2>Stock scanner</h2><span className="section-meta">Relative strength overview.</span></div><button className="icon-button" aria-label="Open scanner information" onClick={()=>setDrawer('method')}><CircleHelp size={17}/></button></div>
          <div className="ranking-tabs"><Tabs value={tab} onValueChange={changeTab}><TabsList variant="line"><TabsTrigger value="resilience"><ShieldCheck/>Resilience</TabsTrigger><TabsTrigger value="recovery"><ArrowUpRight/>Recovery</TabsTrigger></TabsList></Tabs><span className="tabs-note">{tab==='resilience'?'RELATIVE STRENGTH RANKING':'PREMARKET LOW → CUTOFF PRICE'}</span></div>
          <div className="filters"><label className="search-field"><Search size={15}/><input placeholder="Find a ticker…" aria-label="Find a ticker" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label><Select value={sector} onValueChange={setSector}><SelectTrigger aria-label="Sector filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All sectors</SelectItem>{[...new Set(data.stocks.map(r=>r.sector))].sort().map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Select value={benchmark} onValueChange={setBenchmark}><SelectTrigger aria-label="Benchmark selection"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">Auto benchmark</SelectItem><SelectItem value="NQ">NQ · all stocks</SelectItem><SelectItem value="ES">ES · all stocks</SelectItem></SelectContent></Select></div>
          <div className="inline-note"><Info size={15}/><span>Friday closes are shown. TradingView returned no 6:20 PT premarket bars for stocks, so scan prices and range-based rankings remain blank.</span></div>
          {tab==='recovery'&&<div className="inline-note"><ArrowUpRight size={15}/><span>Recovery is ranked separately and never changes the resilience score.{mode==='imported'?' The imported scan has no verified recovery prices.':''}</span></div>}
          {error&&<div className="error-note" role="alert">{error}</div>}
          <Table className="scanner-table"><TableHeader><TableRow><TableHead className="rank-col">#</TableHead><TableHead><button onClick={()=>changeSort('ticker')}>Company<ArrowDownUp size={12}/></button></TableHead><TableHead className="num">Fri close</TableHead><TableHead className="num">6:20 PT</TableHead><TableHead className="num"><button onClick={()=>changeSort('drawdown')}>PM DD<ArrowDownUp size={12}/></button></TableHead><TableHead className="bench-col">Bench.</TableHead><TableHead className="num capture-col"><button onClick={()=>changeSort('capture')}>Capture<ArrowDown size={12}/></button></TableHead><TableHead className="num advantage-col"><button onClick={()=>changeSort('advantage')}>RS adv.<ArrowDownUp size={12}/></button></TableHead><TableHead className="class-col">Classification</TableHead><TableHead className="num"><button onClick={()=>changeSort('recovery')}>Recovery<ArrowDownUp size={12}/></button></TableHead></TableRow></TableHeader><TableBody>
            {rows.map((r,index)=><TableRow key={r.ticker} className={tone(r.band)}><TableCell className="rank-col muted">{String(index+1).padStart(2,'0')}</TableCell><TableCell><button className="company" onClick={()=>setSelected(r)}><span className={`ticker-mark ${r.ticker.toLowerCase()}`}>{r.ticker.slice(0,1)}</span><span><strong>{r.ticker}</strong><small>{r.name}</small></span><ChevronRight className="row-chevron" size={13}/></button></TableCell><TableCell className="num mono">{number(r.previousClose)}</TableCell><TableCell className="num mono">{number(r.last)}</TableCell><TableCell className="num mono">{r.drawdown==null?'—':`−${number(r.drawdown)}%`}</TableCell><TableCell className="bench-col"><span className="benchmark-pill">{r.usedBenchmark}</span></TableCell><TableCell className="num capture-col"><div className="capture-value mono">{percent(r.capture,1)}</div><div className="capture-track"><span style={{width:`${Math.min((r.capture??0)/300*100,100)}%`}}/><i/></div></TableCell><TableCell className={`num mono advantage-col ${r.advantage!==null&&r.advantage>0?'positive':r.advantage!==null&&r.advantage<0?'negative':''}`}>{signed(r.advantage,' pp')}</TableCell><TableCell className="class-col"><span className={`classification ${tone(r.band)}`}>{r.band||'No range'}</span></TableCell><TableCell className="num mono">{signed(r.recovery)}</TableCell></TableRow>)}
            {!rows.length&&<TableRow><TableCell colSpan={8}><div className="empty-state"><Database size={28}/><h3>{query||sector!=='all'?'No matching names':'Your next premarket read starts here.'}</h3><p>{query||sector!=='all'?'Try another ticker or sector.':'The daily snapshot will appear here after its data packet is published.'}</p><button className="primary-button" onClick={()=>query||sector!=='all'?(setQuery(''),setSector('all')):setDrawer('connections')}>{query||sector!=='all'?'Clear filters':'Data connections'}<ArrowUpRight size={15}/></button></div></TableCell></TableRow>}
          </TableBody></Table>
          <div className="table-footer"><span>{rows.length} of {data.stocks.length} names <span className="divider">/</span> {benchmark==='auto'?'NQ / ES assigned per stock':`All stocks vs ${benchmark}`}</span><span>Click a company for details <ArrowUpRight size={12}/></span></div>
        </section>
        <aside className="right-rail">
          <section className="sector-panel panel"><div className="panel-heading"><h2>Sector strength</h2><span className="small-tag">VS ES</span></div><p className="rail-description">Premarket range capture · Friday close by ETF</p><div className="sector-list">{sectors.map(s=><button key={s.ticker} className={`sector-row ${tone(s.band)}`} onClick={()=>setSelected(s)}><span className="sector-info"><strong>{s.ticker}</strong><small>{s.name}</small><small>Fri close {number(s.previousClose)}</small></span><span className="sector-track">{s.capture!==null&&<i style={{width:`${Math.min(s.capture/200*100,100)}%`}}/>}</span><span className="mono">{percent(s.capture,0)}</span></button>)}</div>{sectors.every(s=>s.capture===null)&&<div className="sector-note"><Info size={14}/><span>Session ranges needed.<br/>Daily change is not used as a substitute.</span></div>}</section>
          <section className="distribution panel"><div className="panel-heading"><h2>The resilience scale</h2></div><div className="distribution-bar" aria-label="Classification distribution">{['Exceptional RS','Clear RS','Moderate RS','Market-like','Laggard'].map(b=><span key={b} className={tone(b as Band)} style={{flex:1}}/>)}</div>{[['Exceptional RS',''],['Clear RS',''],['Moderate RS',''],['Market-like',''],['Laggard','']].map(([label,range])=><div className="scale-row" key={label}><span><i className={tone(label as Band)}/>{label}</span>{range&&<span className="mono">{range}</span>}</div>)}<button className="text-link" onClick={()=>setDrawer('method')}>About the scanner <ArrowUpRight size={13}/></button></section>
        </aside>
      </div>
      </section>
      <footer className="statusbar"><div><LockKeyhole size={14}/>{mode==='imported'?'Legacy reference · cutoff unverified':'Frozen daily snapshot'}<span className="divider">/</span><span>06:20 PT · 09:20 ET</span></div><div><span>{mode==='imported'?'Awaiting a verified daily capture':`Collected ${clock(data.fetchedAt)} ET · no live refresh`}</span></div></footer>
    </main>
    <Sheet open={drawer!==null} onOpenChange={o=>!o&&setDrawer(null)}><SheetContent className="detail-sheet"><SheetHeader><div className="eyebrow">THE WARREN / {drawer==='method'?'SCANNER INFO':'DAILY SNAPSHOT'}</div><SheetTitle>{drawer==='method'?'About the scanner':'One snapshot. Every market morning.'}</SheetTitle><SheetDescription>{drawer==='method'?'':'TradingView first. A second source only for missing fields.'}</SheetDescription></SheetHeader>
      {drawer==='method'?<div className="drawer-body"><p>The scanner uses premarket price ranges and some comparison rules to calculate relative strength. Results are based on the best available data and are intended as an aid, not a signal.</p></div> :<div className="drawer-body"><div className="formula-card"><span>DAILY CAPTURE</span><strong>06:20 AM Pacific</strong><p>09:20 AM Eastern · ten minutes before the open. Follows daylight saving time.</p></div><h3>Overnight, then frozen</h3><p>Futures: prior-day 18:00 to 09:20 ET.<br/>Stocks and ETFs: 04:00 to 09:20 ET.</p><p>One data packet per market morning. Rankings, recovery prices, and sector ranges stay fixed. Search and benchmark comparisons still work on that same snapshot.</p><div className="provider-card"><div><strong>TradingView</strong><span className="provider-status">Primary source</span></div><p>Use its supported market fields and timestamped bars. Fill missing range fields from an alternate source only when needed. Every instrument retains its source and observation time.</p></div><MassiveConnectionTest sessionDate={data.sessionDate}/><h3>Visible data quality</h3><p>Late or delayed data must still match the 09:20 cutoff. Incomplete ranges stay blank. The original example has no verified capture time and is labeled separately.</p><div className="provider-note"><ShieldCheck size={17}/><p>The dashboard reads a published snapshot once when opened. Generating and publishing the next snapshot happens separately from this static prototype.</p></div><button className="primary-button" onClick={()=>setDrawer(null)}>Back to scanner<ChevronRight size={15}/></button></div>}
    </SheetContent></Sheet>
    <Sheet open={!!selected} onOpenChange={o=>!o&&setSelected(null)}><SheetContent className="detail-sheet"><SheetHeader><div className="eyebrow">INSTRUMENT DETAIL / {selected?.sector}</div><SheetTitle>{selected?.ticker} <span className="muted">{selected?.name}</span></SheetTitle><SheetDescription>{dateLabel} · {mode==='imported'?'Cutoff unverified':'04:00–09:20 ET'}</SheetDescription></SheetHeader>{selected&&selectedMetrics&&<div className="drawer-body"><div className={`detail-score ${tone(selectedMetrics.band)}`}><span>DOWNSIDE CAPTURE</span><strong>{percent(selectedMetrics.capture,1)}</strong><span>{selectedMetrics.band||'Awaiting data'}</span></div><dl className="detail-metrics">{[['Friday close',number(selected.previousClose)],['Premarket high',number(selected.high)],['Premarket low',number(selected.low)],['Price at 6:20 AM PT',number(selected.last)],['Range drawdown',percent(selected.drawdown)],['RS advantage',signed(selectedMetrics.advantage,' pp')],['Recovery from low',signed(selectedMetrics.recovery)],['Change vs Friday close',signed(selectedMetrics.absolute)],['Premarket volume',number(selected.volume,0)],['Market capitalization',selected.marketCap===null?'—':`$${number(selected.marketCap/1e9,1)}B`],['Last observation',selected.asOf?`${clock(selected.asOf)} ET`:'Not supplied']].map(([k,v])=><div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>)}</dl><div className="inline-note"><Info size={16}/><p>{selected.source}{selected.issue?` · ${selected.issue}`:''}</p></div>{mode==='imported'&&<p className="muted">Only an approximate drawdown was supplied for this stock. Missing prices are left blank.</p>}</div>}</SheetContent></Sheet>
    {isDevelopmentMode&&<DesignLabs/>}
  </div>;
}
