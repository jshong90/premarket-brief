export type BenchmarkId = "NQ" | "ES";
export type Band = "Exceptional RS" | "Clear RS" | "Moderate RS" | "Market-like" | "Laggard";
export type Instrument = {
  ticker: string; name: string; sector: string; benchmark: BenchmarkId;
  high: number | null; low: number | null; last: number | null; previousClose: number | null;
  drawdown: number | null; volume: number | null; marketCap: number | null;
  source: string; asOf: string | null; retrievedAt?:string; previousCloseAt?:string; issue?: string; highTime?: string; lowTime?: string;
  quote?: number | null; quoteAsOf?: string | null; quoteSource?: string; quoteRetrievedAt?: string;
};
export type Benchmark = { id: BenchmarkId; high: number | null; low: number | null; drawdown: number | null; source: string; asOf: string | null; highTime?: string; lowTime?: string; issue?: string };
export type BriefingNote = { title: string; body: string; source: string; url: string; publishedAt?: string | null; asOf?: string | null };
export type Briefing = { indices: BriefingNote[]; bonds: BriefingNote[]; macro: BriefingNote[]; earnings: BriefingNote[]; news: BriefingNote[] };
export type IndexQuote = { id: BenchmarkId; previousClose: number | null; value: number | null; previousCloseAt?: string | null; asOf: string | null; source: string; url?: string; retrievedAt?: string | null; issue?: string };
export type MarketContextId = "SPX" | "SPY" | "QQQ" | "VIX" | "US10Y";
export type MarketContextKind = "index" | "etf" | "volatility" | "yield";
export type MarketContextPoint = { time: string; value: number };
export type MarketContextRow = {
  id: MarketContextId; label: string; name: string; kind: MarketContextKind;
  value: number | null; previousClose: number | null; previousCloseAt?: string | null; retrievedAt?: string | null; change: number | null;
  changeUnit: "%" | "pts" | "bp"; approximate?: boolean;
  high?: number | null; low?: number | null; highTime?: string; lowTime?: string;
  series?: MarketContextPoint[]; source: string; asOf: string | null; issue?: string;
};
export type TreasuryYield = { tenor: "2Y" | "5Y" | "10Y" | "30Y"; value: number | null; previousClose: number | null; asOf?: string | null; approximate?: boolean; source: string; url: string; retrievedAt?: string | null; previousCloseSource?: string; previousCloseUrl?: string; issue?: string };
export type KeyLevel = { id: "ES" | "NQ" | "YM" | "RTY"; label: string; high: number | null; low: number | null; highTime?: string | null; lowTime?: string | null; asOf: string | null; retrievedAt?: string | null; source: string; issue?: string };
export type Snapshot = { sessionDate: string; fetchedAt: string | null; cutoffAt?: string | null; scanVariant?: "opening-0635"; status: "draft" | "imported" | "frozen" | "partial" | "unavailable"; previousArchiveDate?: string; quotesRefreshedAt?: string | null; sectorQuotesRefreshedAt?: string | null; stocks: Instrument[]; sectors: Instrument[]; benchmarks: Benchmark[]; messages: string[]; universeCount: number; universeComplete: boolean; connected: { tradingview: boolean; massive: boolean; robinhood?: boolean }; marketContext?: MarketContextRow[]; indexQuotes?: IndexQuote[]; treasuryYields?: TreasuryYield[]; keyLevels?: KeyLevel[]; briefing?: Briefing; };
export const SECTORS = [["XLK", "Technology"], ["XLC", "Communication"], ["XLY", "Discretionary"], ["XLF", "Financials"], ["XLI", "Industrials"], ["XLV", "Health Care"], ["XLP", "Staples"], ["XLU", "Utilities"], ["XLRE", "Real Estate"], ["XLB", "Materials"], ["XLE", "Energy"]] as const;
export const BENCHMARK_MAP: Record<string, BenchmarkId> = { AAPL:"NQ", CSCO:"NQ", TSLA:"NQ", AMZN:"NQ", QCOM:"NQ", GOOGL:"NQ", GOOG:"NQ", NVDA:"NQ", APP:"NQ", MSFT:"NQ", META:"NQ", AVGO:"NQ", AMD:"NQ", MU:"NQ", ORCL:"NQ", INTC:"NQ", NFLX:"NQ", COST:"ES", MA:"ES", WMT:"ES", MCD:"ES" };
export function benchmarkFor(ticker: string, sector: string): BenchmarkId { return BENCHMARK_MAP[ticker] ?? (/technology|electronic|communication/i.test(sector) ? "NQ" : "ES"); }
export function rangeDrawdown(high: number | null, low: number | null): number | null {
  return high !== null && low !== null && Number.isFinite(high) && Number.isFinite(low) && high > 0 && low > 0 && low <= high ? (1 - low / high) * 100 : null;
}
export function classify(capture: number): Band {
  if(capture < 40) return "Exceptional RS";
  if(capture < 70) return "Clear RS";
  if(capture < 100) return "Moderate RS";
  if(capture <= 125) return "Market-like";
  return "Laggard";
}
export function metrics(row: Instrument, benchmark: Benchmark | undefined) {
  const dd = row.drawdown, bdd = benchmark?.drawdown;
  const capture = dd !== null && dd >= 0 && bdd != null && bdd > 0 ? dd / bdd * 100 : null;
  const recovery = row.last !== null && row.low !== null && row.low > 0 ? (row.last / row.low - 1) * 100 : null;
  const absolute = row.last !== null && row.previousClose !== null && row.previousClose > 0 ? (row.last / row.previousClose - 1) * 100 : null;
  return { capture, advantage: dd !== null && bdd != null && bdd > 0 ? bdd - dd : null, recovery, absolute, band: capture !== null ? classify(Math.round(capture*1e8)/1e8) : null };
}
export function topRelativeStrength<T extends { ticker: string; capture: number | null }>(rows: T[], limit=25): (T & { rsRank: number })[] {
  return rows.filter(r=>r.capture!==null && Number.isFinite(r.capture))
    .sort((a,b)=>a.capture!-b.capture! || a.ticker.localeCompare(b.ticker))
    .slice(0,limit)
    .map((row,index)=>({...row,rsRank:index+1}));
}
export function etParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, minutes:Number(p.hour)*60+Number(p.minute),weekday:p.weekday};
}
export function marketSession(now = new Date()) {
  const p=etParts(now), weekend=p.weekday==="Sat"||p.weekday==="Sun";
  return {date:p.date, phase: weekend ? "Weekend" : p.minutes<240 ? "Before premarket" : p.minutes<570 ? "Premarket open" : "Premarket closed", active: !weekend && p.minutes>=240 && p.minutes<570};
}
// Approximate user-provided values, never passed off as verified live market data.
const importedRows: [string,string,string,BenchmarkId,number][] = [
  ["AAPL","Apple","Technology","NQ",0.43],["CSCO","Cisco Systems","Technology","NQ",0.49],
  ["TSLA","Tesla","Discretionary","NQ",0.88],["AMZN","Amazon","Discretionary","NQ",0.98],
  ["QCOM","Qualcomm","Technology","NQ",1.01],["COST","Costco","Staples","ES",0.48],
  ["MA","Mastercard","Financials","ES",0.53],["GOOGL","Alphabet","Communication","NQ",1.14],
  ["WMT","Walmart","Staples","ES",0.53],["MCD","McDonald’s","Discretionary","ES",0.56],
  ["NVDA","NVIDIA","Technology","NQ",3.07],["APP","AppLovin","Technology","NQ",3.50],
];
export const IMPORTED: Snapshot = {
  sessionDate:"2026-09-28",fetchedAt:null,status:"imported",universeCount:12,universeComplete:false,connected:{tradingview:false,massive:false},
  messages:["Imported from your earlier scan. Approximate drawdowns, unverified prices. Capture is recalculated from rounded inputs; it may differ slightly from the original report."],
  marketContext:[
    {id:"SPX",label:"SPX",name:"S&P 500 cash index",kind:"index",value:null,previousClose:null,change:null,changeUnit:"%",source:"Not supplied in this snapshot",asOf:null,issue:"Cash index does not trade premarket; prior close not supplied."},
    {id:"SPY",label:"SPY",name:"SPDR S&P 500 ETF",kind:"etf",value:null,previousClose:null,change:null,changeUnit:"%",source:"Not supplied in this snapshot",asOf:null,issue:"Premarket price not supplied."},
    {id:"QQQ",label:"QQQ",name:"Invesco QQQ Trust",kind:"etf",value:null,previousClose:null,change:null,changeUnit:"%",source:"Not supplied in this snapshot",asOf:null,issue:"Premarket price not supplied."},
    {id:"VIX",label:"VIX",name:"Cboe Volatility Index",kind:"volatility",value:16.2,previousClose:14.87,change:1.33,changeUnit:"pts",approximate:true,source:"User-provided briefing · VIX",asOf:null,issue:"Approximate morning note; observation timestamp not supplied."},
    {id:"US10Y",label:"10Y",name:"U.S. 10-year Treasury yield",kind:"yield",value:5.2,previousClose:5.17,change:3,changeUnit:"bp",approximate:true,source:"User-provided briefing · U.S. Treasury",asOf:null,issue:"Approximate morning note; observation timestamp not supplied."}
  ],
  briefing:{
  "bonds": [
    {
      "title": "Rates — 10Y remains a headwind",
      "body": "10Y Treasury yield ~5.2% versus ~5.17% Friday close. Yields remain elevated and are still a headwind for growth and technology, even as the market trades near all-time highs.",
      "source": "User-provided briefing · U.S. Treasury",
      "url": "https://home.treasury.gov/resource-center/data-chart-center/interest-rates"
    },
    {
      "title": "Treasury auctions — mostly bills",
      "body": "No major coupon auctions this week. Scheduled auctions are mostly short-term bills.",
      "source": "User-provided briefing · TreasuryDirect",
      "url": "https://www.treasurydirect.gov/auctions/upcoming/"
    }
  ],
  "macro": [
    {
      "title": "Macro calendar — the week ahead",
      "body": "Tuesday: JOLTS. Wednesday: ADP, Q2 GDP, PCE / Core PCE. Thursday: Jobless Claims and ISM Manufacturing. Friday: Nonfarm Payrolls and Unemployment Rate.",
      "source": "User-provided briefing · economic calendars",
      "url": "https://www.bls.gov/schedule/news_release/"
    },
    {
      "title": "Trump announcement — 2:00 PM ET / 11:00 AM PT",
      "body": "The White House schedule lists an announcement at 2:00 PM ET / 11:00 AM PT today, but does not specify the subject.",
      "source": "User-provided briefing · White House schedule",
      "url": "https://www.whitehouse.gov/schedule/"
    }
  ],
  "news": [
    {
      "title": "NVDA — another $150B buyback authorization",
      "body": "NVIDIA added another $150B to its share-buyback authorization overnight.",
      "source": "User-provided briefing · NVIDIA IR",
      "url": "https://investor.nvidia.com/"
    },
    {
      "title": "Headline risk — U.S.–Iran negotiations",
      "body": "The tape is responding well to expectations that negotiations will continue this week. Any new U.S.–Iran headline can flow through oil, yields, and QQQ / semis.",
      "source": "User-provided briefing · market headlines",
      "url": "https://www.reuters.com/markets/"
    },
    {
      "title": "Oil / Middle East — inverse to equities",
      "body": "Oil is still trading inverse to equities. CL is following through on the selloff after negative U.S.–Iran news. Markets are now responding to expectations that negotiations will continue this week.",
      "source": "User-provided briefing · crude oil reference",
      "url": "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.quotes.html"
    }
  ],
  "indices": [
    {
      "title": "Market snapshot — a soft futures open",
      "body": "S&P 500 futures ~−0.2%; Nasdaq-100 futures roughly flat; Dow futures ~−0.3%; Russell 2000 futures ~−0.4%. VIX ~16.2 versus 14.87 Friday. The tape is responding well to NVIDIA buyback news and the expectation that U.S.–Iran negotiations continue this week.",
      "source": "User-provided briefing · futures reference",
      "url": "https://www.tradingview.com/markets/futures/quotes/"
    },
    {
      "title": "Keep an eye on relative strength",
      "body": "Watch oil, the 10Y yield, semiconductor relative strength, VIX, and any new U.S.–Iran headlines. The main setup remains: U.S.–Iran headlines → oil → yields → QQQ / semis.",
      "source": "User-provided briefing · market watchlist",
      "url": "https://www.tradingview.com/"
    }
  ],
  "earnings": [
    {
      "title": "Catalyst watch — MU after the close Wednesday",
      "body": "Micron is the key earnings report for the broader market this week because of its read-through to AI memory and semiconductors.",
      "source": "User-provided briefing · Micron IR",
      "url": "https://investors.micron.com/events-and-presentations"
    }
  ]
},
  stocks:importedRows.map(([ticker,name,sector,benchmark,drawdown])=>({ticker,name,sector,benchmark,drawdown,high:null,low:null,last:null,previousClose:null,volume:null,marketCap:null,source:"Conversation snapshot · unverified",asOf:null})),
  sectors:SECTORS.map(([ticker,name])=>({ticker,name,sector:name,benchmark:"ES",high:null,low:null,last:null,previousClose:null,drawdown:null,volume:null,marketCap:null,source:"Awaiting session ranges",asOf:null})),
  benchmarks:[{id:"NQ",high:30920.75,low:30531,drawdown:1.26,source:"Prior scan · unverified",asOf:null,highTime:"2026-09-27T22:00:00Z",lowTime:"2026-09-28T09:10:00Z"},{id:"ES",high:7803,low:7757,drawdown:0.59,source:"Prior scan · unverified",asOf:null,highTime:"2026-09-27T22:00:00Z",lowTime:"2026-09-28T10:10:00Z"}],
};
