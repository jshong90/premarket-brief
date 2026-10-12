import { useMemo, useState } from 'react';
import { metrics, rangeDrawdown, topRelativeStrength, type Instrument, type Snapshot } from '@/lib/scanner';
import { ScannerRankings } from '@/features/dashboard/ScannerRankings';
import { InstrumentDrawer } from '@/features/dashboard/InstrumentDrawer';
import { filterScannerRows } from '@/features/dashboard/scannerRows';
import type { SortKey } from '@/features/dashboard/scannerTypes';

const source = 'SYNTHETIC EXAMPLE — not market data';
const asOf = '2000-01-03T14:19:00Z';
const stocks: Instrument[] = [
  ['DEMOA', 'Sample Alpha', 'Technology', 100, 99, 100],
  ['DEMOB', 'Sample Beta', 'Financials', 100, 97, 98],
  ['DEMOC', 'Sample Gamma', 'Technology', 100, 98, 99],
].map(([ticker,name,sector,high,low,last])=>({ticker:String(ticker),name:String(name),sector:String(sector),benchmark:sector==='Technology'?'NQ':'ES',high:Number(high),low:Number(low),last:Number(last),previousClose:98,drawdown:rangeDrawdown(Number(high),Number(low)),volume:1000,marketCap:100_000_000_000,source,asOf,highTime:'2000-01-03T09:00:00Z',lowTime:'2000-01-03T13:00:00Z'}));
const data: Snapshot = {sessionDate:'2000-01-03',fetchedAt:asOf,status:'draft',universeCount:3,universeComplete:false,connected:{tradingview:false,massive:false},messages:[source],stocks,sectors:[],benchmarks:[{id:'NQ',high:100,low:96,drawdown:4,source,asOf},{id:'ES',high:100,low:96,drawdown:4,source,asOf}]};

export function ScannerSandbox() {
  const [query,setQuery]=useState('');
  const [sector,setSector]=useState('all');
  const [benchmark,setBenchmark]=useState('auto');
  const [tab,setTab]=useState('resilience');
  const [sort,setSort]=useState<{key:SortKey;asc:boolean}>({key:'capture',asc:true});
  const [selected,setSelected]=useState<Instrument|null>(null);
  const [notice,setNotice]=useState('');
  const topStocks=useMemo(()=>topRelativeStrength(stocks.map(row=>{const usedBenchmark=benchmark==='auto'?row.benchmark:benchmark as 'NQ'|'ES';return {...row,usedBenchmark,...metrics(row,data.benchmarks.find(b=>b.id===usedBenchmark))};})),[benchmark]);
  const rows=useMemo(()=>filterScannerRows(topStocks,query,sector,sort),[topStocks,query,sector,sort]);
  return <>
    <p className="inline-note">Synthetic scanner sandbox · January 3, 2000 · no live data. Test search, filters, sorting and stock details.</p>
    <ScannerRankings data={data} rows={rows} topStocks={topStocks} tab={tab} isOpening={false} mode="reference" error="" query={query} sector={sector} benchmark={benchmark} setQuery={setQuery} setSector={setSector} setBenchmark={setBenchmark} setSelected={setSelected} setDrawer={()=>setNotice('This sandbox uses synthetic examples; it has no market connections.')} changeTab={value=>{setTab(value);setSort({key:value==='recovery'?'recovery':'capture',asc:value!=='recovery'});}} changeSort={key=>setSort(current=>({key,asc:current.key===key?!current.asc:key!=='advantage'&&key!=='recovery'}))} />
    {notice&&<p role="status" className="inline-note">{notice}</p>}
    <InstrumentDrawer selected={selected} selectedMetrics={selected?metrics(selected,data.benchmarks.find(b=>b.id===(benchmark==='auto'?selected.benchmark:benchmark))):null} dateLabel="Synthetic examples · January 3, 2000" mode="reference" isOpening={false} cutoffPacific="06:20" cutoffEastern="09:20" onClose={()=>setSelected(null)} />
  </>;
}
