import type { ScannerRow, SortKey } from './scannerTypes';

/** Shared display filtering/order; never calculates or changes resilience ranks. */
export function filterScannerRows(topStocks: ScannerRow[], query: string, sector: string, sort: {key: SortKey; asc: boolean}) {
  return topStocks.filter(r=>(sector==='all'||r.sector===sector)&&`${r.ticker} ${r.name}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>{
    const av=a[sort.key],bv=b[sort.key];
    if(av==null)return bv==null?a.rsRank-b.rsRank:1;
    if(bv==null)return-1;
    const result=typeof av==='string'?av.localeCompare(String(bv)):av-Number(bv);
    return(sort.asc?result:-result)||a.rsRank-b.rsRank;
  });
}
