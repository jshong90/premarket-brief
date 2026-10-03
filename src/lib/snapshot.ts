import { rangeDrawdown, type Snapshot } from './scanner';
import { windows } from './ranges';

/** Validate the static data packet before presenting it as a frozen scan. */
export function readSnapshot(input: unknown): Snapshot {
  const fail = (message: string): never => { throw new Error(`Snapshot: ${message}`); };
  if (!input || typeof input !== 'object') return fail('expected an object.');
  const s = input as Snapshot;
  const validNumber = (value: unknown) => value===null || typeof value==='number' && Number.isFinite(value) && value>=0;
  const validChange = (value: unknown) => value===null || typeof value==='number' && Number.isFinite(value);
  const validTime = (value: unknown) => typeof value==='string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  const optionalTime = (value: unknown) => value===undefined || value===null || validTime(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.sessionDate) || !Number.isFinite(Date.parse(s.sessionDate)) || new Date(s.sessionDate).toISOString().slice(0,10) !== s.sessionDate) return fail('invalid session date.');
  if (s.scanVariant!==undefined && s.scanVariant!=='opening-0635') return fail('unknown scanner variant.');
  const w = windows(s.sessionDate,s.scanVariant==='opening-0635'?35:20);
  if (!['archived','draft','imported','frozen','partial','unavailable'].includes(s.status)) return fail('unknown status.');
  if (![s.stocks,s.sectors,s.benchmarks,s.messages].every(Array.isArray) || s.messages.some(x=>typeof x!=='string')) return fail('missing arrays.');
  if (s.previousArchiveDate!==undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(s.previousArchiveDate) || !Number.isFinite(Date.parse(s.previousArchiveDate)) || new Date(s.previousArchiveDate).toISOString().slice(0,10)!==s.previousArchiveDate || s.previousArchiveDate>=s.sessionDate)) return fail('invalid archive date.');
  if (!optionalTime(s.quotesRefreshedAt)) return fail('invalid quote refresh time.');
  if (!optionalTime(s.sectorQuotesRefreshedAt)) return fail('invalid sector quote refresh time.');
  if (s.marketContext!==undefined) {
    if (!Array.isArray(s.marketContext)) return fail('marketContext must be an array.');
    const ids=['SPX','SPY','QQQ','VIX','US10Y'];
    if (s.marketContext.length!==5 || new Set(s.marketContext.map(row=>row?.id)).size!==s.marketContext.length || ids.some(id=>!s.marketContext!.some(row=>row?.id===id))) return fail('marketContext must contain SPX, SPY, QQQ, VIX and US10Y exactly once.');
    for (const row of s.marketContext) {
      if (!row || typeof row!=='object' || !ids.includes(row.id) || typeof row.label!=='string' || typeof row.name!=='string' || !['index','etf','volatility','yield'].includes(row.kind) || !['%','pts','bp'].includes(row.changeUnit) || ![row.value,row.previousClose].every(validNumber) || !validChange(row.change) || typeof row.source!=='string' || !(row.asOf===null || validTime(row.asOf)) || !optionalTime(row.previousCloseAt) || !optionalTime(row.retrievedAt)) return fail('invalid marketContext fields.');
      if (row.high!==undefined && row.high!==null && (!Number.isFinite(row.high) || row.high<0) || row.low!==undefined && row.low!==null && (!Number.isFinite(row.low) || row.low<0)) return fail('invalid marketContext range.');
      if (row.series!==undefined) {
        if (!Array.isArray(row.series) || row.series.some(point=>!point || typeof point.time!=='string' || !Number.isFinite(Date.parse(point.time)) || !Number.isFinite(point.value))) return fail('invalid marketContext series.');
      }
    }
  }
  if (s.indexQuotes!==undefined) {
    if (!Array.isArray(s.indexQuotes) || s.indexQuotes.length!==2 || new Set(s.indexQuotes.map(row=>row?.id)).size!==2 || !['NQ','ES'].every(id=>s.indexQuotes!.some(row=>row?.id===id))) return fail('indexQuotes must contain NQ and ES exactly once.');
    for (const row of s.indexQuotes) {
      if (!row || ![row.value,row.previousClose].every(validNumber) || row.value===0 || row.previousClose===0 || typeof row.source!=='string' || !(row.asOf===null || validTime(row.asOf)) || !optionalTime(row.previousCloseAt) || !optionalTime(row.retrievedAt) || row.url!==undefined && (typeof row.url!=='string' || !/^https:\/\//i.test(row.url)) || row.value!==null && !validTime(row.asOf)) return fail('invalid index quote.');
    }
  }
  if (s.treasuryYields!==undefined) {
    const tenors=['2Y','5Y','10Y','30Y'];
    if (!Array.isArray(s.treasuryYields) || new Set(s.treasuryYields.map(row=>row?.tenor)).size!==s.treasuryYields.length || s.treasuryYields.some(row=>!row || !tenors.includes(row.tenor) || ![row.value,row.previousClose].every(validNumber) || typeof row.source!=='string' || typeof row.url!=='string' || !/^https:\/\//i.test(row.url) || !optionalTime(row.asOf) || !optionalTime(row.retrievedAt) || row.value!==null && (row.asOf===undefined || row.asOf===null) && typeof row.issue!=='string')) return fail('invalid treasury yield rows.');
  }
  if (s.keyLevels!==undefined) {
    const keyWindow=windows(s.sessionDate); // Key Levels remain the 06:20 premarket capture in both views.
    const ids=['ES','NQ','YM','RTY'];
    if (!Array.isArray(s.keyLevels) || s.keyLevels.length!==4 || new Set(s.keyLevels.map(row=>row?.id)).size!==4 || ids.some(id=>!s.keyLevels!.some(row=>row?.id===id))) return fail('keyLevels must contain ES, NQ, YM and RTY exactly once.');
    for (const row of s.keyLevels) {
      if (!row || typeof row.label!=='string' || typeof row.source!=='string' || ![row.high,row.low].every(validNumber) || (row.high===null)!==(row.low===null) || row.high!==null && row.low!==null && row.high<row.low || !(row.asOf===null || validTime(row.asOf)) || !optionalTime(row.highTime) || !optionalTime(row.lowTime) || !optionalTime(row.retrievedAt) || row.high!==null && (!row.highTime || !row.lowTime || !row.asOf || [row.highTime,row.lowTime,row.asOf].some(time=>Date.parse(time!)<keyWindow.futuresStart || Date.parse(time!)>=keyWindow.end))) return fail('invalid key level.');
    }
  }
  if (s.briefing!==undefined) {
    if (!s.briefing || typeof s.briefing!=='object' || Array.isArray(s.briefing)) return fail('invalid briefing.');
    for (const key of ['indices','bonds','macro','earnings','news'] as const) {
      const notes=s.briefing[key];
      if (!Array.isArray(notes)) return fail(`briefing.${key} must be an array.`);
      for (const note of notes) {
        if (!note || typeof note!=='object' || typeof note.title!=='string' || typeof note.body!=='string' || typeof note.source!=='string' || typeof note.url!=='string' || note.source!=='Desk commentary' && !/^https:\/\//i.test(note.url) || note.url && !/^https:\/\//i.test(note.url)) return fail('briefing notes need a direct HTTPS source.');
        for (const field of ['publishedAt','asOf'] as const) if (note[field]!==undefined && note[field]!==null && (typeof note[field]!=='string' || !Number.isFinite(Date.parse(note[field])))) return fail('briefing note date is invalid.');
        const legacyQuotes=(note as typeof note & {indexQuotes?: unknown}).indexQuotes;
        if (legacyQuotes!==undefined && (!Array.isArray(legacyQuotes) || legacyQuotes.some(row=>!row || typeof row.label!=='string' || ![row.fridayClose,row.scanPrice].every(validNumber) || !validChange(row.changePercent) || !optionalTime(row.fridayCloseAt)))) return fail('invalid legacy index quote.');
      }
    }
  }
  if (!Number.isInteger(s.universeCount) || s.universeCount < s.stocks.length || typeof s.universeComplete !== 'boolean') return fail('invalid coverage.');
  if (s.benchmarks.length !== 2 || !['NQ','ES'].every(id=>s.benchmarks.filter(b=>b.id===id).length===1)) return fail('NQ and ES benchmarks are required.');
  const imported = s.status === 'imported';
  const draft = s.status === 'draft';
  const archived = s.status === 'archived';
  if ((imported || draft) && s.cutoffAt) return fail('drafts and legacy imports cannot claim a verified scanner cutoff.');
  if (draft && !validTime(s.fetchedAt)) return fail('draft needs a preparation time.');
  if ((imported || draft) && s.scanVariant) return fail('an opening variant needs a captured snapshot.');
  if (!imported && !draft && !archived && (Date.parse(s.cutoffAt || '') !== w.end || !validTime(s.fetchedAt) || Date.parse(s.fetchedAt!) < w.end)) return fail('expected the declared scanner cutoff and a collection time at or after it.');
  const within = (value: unknown, start: number) => typeof value==='string' && Date.parse(value)>=start && Date.parse(value)<w.end;
  const clean = <T extends Snapshot['benchmarks'][number] | Snapshot['stocks'][number]>(row: T, start: number): T => {
    if (!row || typeof row !== 'object' || typeof row.source !== 'string' || ![row.high,row.low,row.drawdown].every(validNumber) || !(row.asOf===null || typeof row.asOf==='string' && Number.isFinite(Date.parse(row.asOf)))) return fail('invalid price or source fields.');
    const instrument = 'ticker' in row;
    if (instrument && (typeof row.ticker!=='string' || typeof row.name!=='string' || typeof row.sector!=='string' || !['NQ','ES'].includes(row.benchmark) || ![row.last,row.previousClose,row.volume,row.marketCap].every(validNumber))) return fail('invalid instrument fields.');
    if (imported || draft || archived) return row;
    if (row.asOf && !within(row.asOf,start) || row.highTime && !within(row.highTime,start) || row.lowTime && !within(row.lowTime,start)) return fail('an observation is outside the snapshot window.');
    const dd = rangeDrawdown(row.high,row.low);
    const missing = dd===null || !within(row.asOf,start) || !within(row.highTime,start) || !within(row.lowTime,start) || instrument && (row.volume===null || row.volume<=0);
    if (missing) return {...row,high:null,low:null,drawdown:null,...(instrument?{last:null}:{}),issue:row.issue || 'Incomplete timestamped range at cutoff.'};
    if (instrument && row.last!==null && (row.last<row.low! || row.last>row.high!)) return fail('last price is outside its high/low range.');
    return {...row,drawdown:dd};
  };
  const stocks = s.stocks.map(r=>clean(r,w.equityStart));
  const sectors = s.sectors.map(r=>clean(r,w.equityStart));
  for (const row of sectors) {
    if (row.quote!==undefined && (!validNumber(row.quote) || row.quote===null || row.quote<=0 || typeof row.quoteSource!=='string' || !validTime(row.quoteAsOf) || !validTime(row.quoteRetrievedAt))) return fail('invalid sector quote fields.');
  }
  if (new Set(stocks.map(r=>r.ticker)).size !== stocks.length || new Set(sectors.map(r=>r.ticker)).size !== sectors.length || sectors.some(r=>r.benchmark!=='ES')) return fail('duplicate tickers or invalid sector benchmark.');
  const benchmarks = s.benchmarks.map(r=>clean(r,w.futuresStart));
  const partial = !s.universeComplete || !stocks.length || sectors.length!==11 || [...stocks,...sectors,...benchmarks].some(r=>r.drawdown===null);
  return {...s,stocks,sectors,benchmarks,status:s.status==='frozen'&&partial?'partial':s.status};
}

