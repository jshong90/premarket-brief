// Provider preference is field-specific. Absence of a connector is recorded,
// never interpreted as permission to silently substitute another instrument.
export const providers = {
  robinhood: { name: 'Robinhood MCP', url: 'https://robinhood.com/' },
  public: { name: 'Public.com MCP', url: 'https://public.com/' },
  tradingview: { name: 'TradingView Official MCP', url: 'https://www.tradingview.com/' },
  openmarket: { name: 'OpenMarket MCP', url: 'https://openmarket.xyz/' },
  yahoo: { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/' },
  tradingeconomics: { name: 'Trading Economics', url: 'https://tradingeconomics.com/' },
};

// These routes are the collection adapter's supported quote/bar requests.
// Public replaces TradingView as a quote fallback; TradingView remains assigned
// where timestamped one-minute futures bars are required.
const quoteOrder = ['robinhood', 'public'];
export const instruments = {
  SPX: {
    name: 'OpenMarket HYPERLIQUID_HIP3 / xyz:SP500 proxy', kind: 'proxy', unit: 'price',
    quote: ['openmarket'], symbols: { openmarket: 'HYPERLIQUID_HIP3 / xyz:SP500' },
    proxyDescription: 'OpenMarket synthetic SP500 proxy; not the SPX cash index.',
  },
  SPY: { name: 'SPDR S&P 500 ETF Trust', kind: 'equity', unit: 'price', quote: quoteOrder, symbols: { robinhood: 'SPY', public: 'SPY' } },
  QQQ: { name: 'Invesco QQQ Trust', kind: 'equity', unit: 'price', quote: quoteOrder, symbols: { robinhood: 'QQQ', public: 'QQQ' } },
  VIX: { name: 'Cboe Volatility Index', kind: 'volatility', unit: 'price', quote: ['tradingview'], symbols: { tradingview: 'CBOE:VIX' } },
  ...Object.fromEntries(['2Y', '5Y', '10Y', '30Y'].map(tenor => [`US${tenor}`, {
    name: `U.S. ${tenor} Treasury yield`, kind: 'yield', unit: 'percent',
    quote: tenor === '2Y' ? [...quoteOrder, 'tradingeconomics'] : [...quoteOrder, 'yahoo', 'tradingeconomics'],
    symbols: { robinhood: `US${tenor}`, public: `US${tenor}`,
      ...(tenor === '2Y' ? {} : { yahoo: ({ '5Y': '^FVX', '10Y': '^TNX', '30Y': '^TYX' })[tenor] }),
      tradingeconomics: ({ '2Y': 'USGG2YR:IND', '5Y': 'USGG5YR:IND', '10Y': 'USGG10YR:IND', '30Y': 'USGG30Y:IND' })[tenor],
    },
  }])),
  ...Object.fromEntries(['ES', 'NQ'].map(id => [id, {
    name: `${id} futures`, kind: 'futures', unit: 'price', quote: ['tradingview', 'openmarket', 'yahoo', 'tradingeconomics'], bars: ['tradingview', 'openmarket', 'yahoo', 'tradingeconomics'],
    workspaceId: 'Ebzd9R2U', chartIndex: id === 'NQ' ? 0 : 1,
    symbols: { tradingview: `CME_MINI:${id}1!`, openmarket: `CME:${id === 'NQ' ? 'NNQZ6' : 'ESZ6'}`, yahoo: `${id}=F`, tradingeconomics: id === 'NQ' ? 'US100:IND' : 'SPX:IND' },
  }])),
  ...Object.fromEntries(['YM', 'RTY'].map(id => [id, {
    name: `${id} futures`, kind: 'futures', unit: 'price', quote: quoteOrder, bars: ['tradingview'],
    symbols: { robinhood: id, public: id, tradingview: `${id === 'YM' ? 'CBOT_MINI' : 'CME_MINI'}:${id}1!` },
  }])),
};

const source = (name, url) => ({ name, url });
export const marketDataSources = [
  {
    field: 'SPX premarket reference', primary: [providers.openmarket], backup: [],
    detail: 'HYPERLIQUID_HIP3 / xyz:SP500 is a temporary proxy, not the SPX cash index. Keep the proxy and its prior close on the same instrument.',
  },
  {
    field: 'SPY, QQQ and individual-equity quotes', primary: [providers.robinhood], backup: [providers.public],
    detail: 'Public.com is the quote fallback. Scanner ranges require actual timestamped OHLCV bars; quote-only data stays unranked.',
  },
  {
    field: 'U.S. Treasury yields (2Y, 5Y, 10Y, 30Y)', primary: [providers.robinhood], backup: [providers.public, providers.yahoo, providers.tradingeconomics],
    detail: 'Try Yahoo Finance, then Trading Economics when prior providers fail. Yahoo has no configured 2Y yield symbol. Use exact pre-cutoff timestamped observations; Trading Economics 2Y uses 5-minute bars, other maturities use 1-minute bars. Disclose resolution and compare against the last actual Treasury session, including holidays.',
  },
  {
    field: 'VIX', primary: [providers.tradingview], backup: [],
    detail: 'TradingView Official MCP · CBOE:VIX. Retain the observation time.',
  },
  {
    field: 'ES/NQ quotes and Key Levels', primary: [providers.tradingview], backup: [providers.openmarket, providers.yahoo, providers.tradingeconomics],
    detail: 'Use TradingView CME_MINI:ES1! and CME_MINI:NQ1! completed 1-minute bars for both the last price and overnight range. OpenMarket workspace Ebzd9R2U (NQ pane 0, ES pane 1) is the first fallback, then Yahoo ES=F/NQ=F. Verify each instrument and exact cutoff window. Trading Economics US500 (SPX:IND) and US100 (US100:IND) are authorized reference instruments for these displays. Use S&P 500 / Nasdaq-100 labels, their actual source links and same-instrument prior references. Keep TradingView CME scanner benchmarks separate and disclose incomplete bar coverage.',
  },
  {
    field: 'Timestamped ES/NQ scanner benchmark ranges', primary: [providers.tradingview], backup: [],
    detail: 'Completed one-minute OHLC bars for the exact overnight window only. Partial or missing ranges remain null; never substitute a quote or an unbounded chart high/low.',
  },
  {
    field: 'U.S. equity-universe discovery', primary: [providers.robinhood], backup: [],
    detail: 'Report the discovered count and disclose coverage gaps; do not claim complete discovery without evidence.',
  },
  {
    field: 'Sector-strength panel', primary: [], backup: [],
    detail: 'Retired. Do not collect or display sector-relative-strength rows.',
  },
].map(row => ({ ...row, primary: row.primary.length ? row.primary : [source('Not collected', '')] }));

export const editorialSources = [
  { field: 'U.S. economic releases', source: 'Trading Economics', url: 'https://tradingeconomics.com/calendar', rule: 'U.S. calendar only; include upcoming events rated at least two stars. Recheck dates and ET times.' },
  { field: 'Fed policy events, releases and speakers', source: 'Trading Economics', url: 'https://tradingeconomics.com/calendar', backup: 'Federal Reserve Board / relevant regional Fed', backupUrl: 'https://www.federalreserve.gov/newsevents/calendar.htm', rule: 'Trading Economics is primary; use official Fed event pages only to verify or fill a missing detail. Keep chronological and omit events at or after 16:00 ET.' },
  { field: 'Treasury auctions and offering sizes', source: 'TreasuryDirect / U.S. Treasury', url: 'https://www.treasurydirect.gov/auctions/upcoming/', rule: 'Use official auction schedules and Treasury announcements for offering sizes; include relevant upcoming items before market close.' },
  { field: 'Earnings', source: 'Earnings Whispers', url: 'https://www.earningswhispers.com/calendar', rule: 'Verify release timing; retain only companies strictly above $25B market capitalization with dated evidence.' },
  { field: 'Earnings market-cap checks', source: 'StockAnalysis', url: 'https://stockanalysis.com/list/biggest-companies/', rule: 'Dated USD market-cap evidence for the earnings screen only; do not treat this list as a complete scanner universe.' },
  { field: 'Overnight news', source: 'User-provided', url: '', rule: 'The user supplies news and commentary. Do not search or scrape other news sources.' },
];

function sourceLinks(items) {
  return items.map(item => item.url ? `[${item.name}](${item.url})` : item.name).join(' → ') || '—';
}

export function sourceMarkdown() {
  return [
    '| Dashboard data | Primary source | Backup | Handling |', '| --- | --- | --- | --- |',
    ...marketDataSources.map(x => `| ${x.field} | ${sourceLinks(x.primary)} | ${sourceLinks(x.backup)} | ${x.detail} |`),
    '', '| Briefing field | Primary source | Backup | Handling |', '| --- | --- | --- | --- |',
    ...editorialSources.map(x => `| ${x.field} | ${x.url ? `[${x.source}](${x.url})` : x.source} | ${x.backup ? `[${x.backup}](${x.backupUrl})` : '—'} | ${x.rule} |`),
  ].join('\n');
}
