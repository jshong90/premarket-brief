// Provider preference is field-specific. Absence of a connector is recorded,
// never interpreted as permission to silently substitute another instrument.
export const providers = {
  robinhood: { name: 'Robinhood MCP', url: 'https://robinhood.com/' },
  public: { name: 'Public.com MCP', url: 'https://public.com/' },
  tradingview: { name: 'TradingView Official MCP', url: 'https://www.tradingview.com/' },
};
const quoteOrder = ['robinhood', 'public', 'tradingview'];
export const instruments = {
  SPX: { name: 'Spreadex SPX CFD proxy', kind: 'proxy', unit: 'price', quote: ['tradingview'], symbols: { tradingview: 'SPREADEX:SPX' } },
  SPY: { name: 'SPDR S&P 500 ETF Trust', kind: 'equity', unit: 'price', quote: quoteOrder, symbols: { robinhood: 'SPY', public: 'SPY', tradingview: 'AMEX:SPY' } },
  QQQ: { name: 'Invesco QQQ Trust', kind: 'equity', unit: 'price', quote: quoteOrder, symbols: { robinhood: 'QQQ', public: 'QQQ', tradingview: 'NASDAQ:QQQ' } },
  VIX: { name: 'Cboe Volatility Index', kind: 'volatility', unit: 'price', quote: ['tradingview'], symbols: { tradingview: 'CBOE:VIX' } },
  ...Object.fromEntries(['2Y', '5Y', '10Y', '30Y'].map(tenor => [`US${tenor}`, {
    name: `U.S. ${tenor} Treasury yield`, kind: 'yield', unit: 'percent', quote: quoteOrder,
    symbols: { robinhood: `US${tenor}`, public: `US${tenor}`, tradingview: `TVC:US${tenor.padStart(3, '0')}` },
  }])),
  ...Object.fromEntries(['ES', 'NQ', 'YM', 'RTY'].map(id => [id, {
    name: `${id} futures`, kind: 'futures', unit: 'price', quote: quoteOrder, bars: ['tradingview'],
    symbols: { robinhood: id, public: id, tradingview: `${id === 'YM' ? 'CBOT_MINI' : 'CME_MINI'}:${id}1!` },
  }])),
};
export const editorialSources = [
  { field: 'U.S. economic releases', source: 'Trading Economics', url: 'https://tradingeconomics.com/calendar', rule: 'Only explicitly approved releases; recheck dates and ET times.' },
  { field: 'Fed events', source: 'Federal Reserve Board / relevant regional Fed', url: 'https://www.federalreserve.gov/newsevents/calendar.htm', rule: 'Official event pages; chronological; omit events at or after 16:00 ET.' },
  { field: 'Treasury auctions', source: 'TreasuryDirect / U.S. Treasury', url: 'https://www.treasurydirect.gov/auctions/upcoming/', rule: 'Verify auction date, deadline and offering sizes; omit after-close events.' },
  { field: 'Earnings', source: 'Earnings Whispers', url: 'https://www.earningswhispers.com/calendar', rule: 'Verify release timing; retain only companies above $25B with dated market-cap evidence.' },
  { field: 'Earnings market caps', source: 'StockAnalysis', url: 'https://stockanalysis.com/list/biggest-companies/', rule: 'Dated USD capitalization; do not guess missing values.' },
];
export function sourceMarkdown() {
  return ['| Instrument | Quote order | Range source |', '| --- | --- | --- |',
    ...Object.entries(instruments).map(([id, x]) => `| ${id}${x.kind === 'proxy' ? ' (CFD proxy)' : ''} | ${x.quote.map(p => providers[p].name).join(' → ')} | ${(x.bars ?? []).map(p => providers[p].name).join(' → ') || '—'} |`),
    '', '| Calendar field | Source | Handling |', '| --- | --- | --- |',
    ...editorialSources.map(x => `| ${x.field} | [${x.source}](${x.url}) | ${x.rule} |`)].join('\n');
}
