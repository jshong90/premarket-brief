import type { MarketContextRow, Snapshot } from '@/lib/scanner';

const ORDER: MarketContextRow['id'][] = ['SPX', 'SPY', 'QQQ', 'VIX', 'US10Y'];

const valueText = (row: MarketContextRow, value = row.value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const prefix = row.approximate ? '~' : '';
  if (row.kind === 'yield') return `${prefix}${value.toFixed(2)}%`;
  return `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const changeText = (row: MarketContextRow) => {
  if (row.change === null || !Number.isFinite(row.change)) return '—';
  const sign = row.change > 0 ? '+' : '';
  return `${sign}${row.change.toFixed(row.changeUnit === 'bp' ? 0 : 2)} ${row.changeUnit}`;
};

const pointsFor = (row: MarketContextRow) => {
  const series = row.series || [];
  if (series.length < 3) return null;
  const values = series.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return series.map((point, index) => {
    const x = series.length === 1 ? 0 : index / (series.length - 1) * 100;
    const y = 25 - ((point.value - min) / span) * 21;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

function MarketTile({ row }: { row: MarketContextRow }) {
  const chart = pointsFor(row);
  const missing = row.value === null;
  const range = row.high !== undefined && row.high !== null && row.low !== undefined && row.low !== null;
  const rangePosition = range && row.value !== null && row.high! > row.low! ? Math.max(0, Math.min(100, (row.value - row.low!) / (row.high! - row.low!) * 100)) : null;
  return <article className={`market-tile ${row.kind} ${missing ? 'is-missing' : ''}`} aria-label={`${row.label} ${row.name}`}>
    <div className="market-tile-label"><strong>{row.label}</strong><span>{row.name}</span></div>
    {chart ? <div className="market-chart-wrap"><svg className="market-chart" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={`${row.label} snapshot range chart`}><polyline className={row.change !== null && row.change > 0 ? 'price-up' : row.change !== null && row.change < 0 ? 'price-down' : 'price-flat'} points={chart} fill="none" vectorEffect="non-scaling-stroke"/></svg><b className="market-chart-value">{valueText(row)}</b></div> : <div className="market-value"><b>{valueText(row)}</b><span>{missing ? 'not supplied' : row.kind === 'yield' ? 'yield' : row.kind === 'volatility' ? 'index level' : 'last'}</span></div>}
    <div className="market-tile-meta"><span className={row.change !== null && row.change > 0 ? 'positive' : row.change !== null && row.change < 0 ? 'negative' : ''}>{changeText(row)}</span>{row.previousClose !== null ? <small>prev {valueText({...row, approximate:false}, row.previousClose)}</small> : <small>{row.issue || 'No observation supplied'}</small>}</div>
    {range && <div className="market-range-window"><span>H {valueText({...row, approximate:false}, row.high)}</span><i><b style={{width:`${rangePosition ?? 0}%`}}/></i><span>L {valueText({...row, approximate:false}, row.low)}</span></div>}
  </article>;
}

export default function MarketStrip({ data }: { data: Snapshot }) {
  const rows = data.marketContext || [];
  const byId = new Map(rows.map(row => [row.id, row]));
  const cutoff = data.status === 'imported' ? 'Snapshot inputs · unverified' : '06:20 PT / 09:20 ET';
  return <section className="market-strip" aria-label="Market context">
    <div className="market-strip-heading"><span className="eyebrow">MARKET CONTEXT</span><span>{cutoff}</span></div>
    <div className="market-strip-items">{ORDER.map(id => <MarketTile key={id} row={byId.get(id) || {id,label:id,name:'Not supplied',kind:id==='VIX'?'volatility':id==='US10Y'?'yield':id==='SPX'?'index':'etf',value:null,previousClose:null,change:null,changeUnit:'%',source:'Not supplied in this snapshot',asOf:null,issue:'No market-context row supplied.'}} />)}</div>
  </section>;
}
