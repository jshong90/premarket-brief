const MARKET_TIME_ZONE = 'America/New_York';
const MINUTE_MS = 60_000;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function easternTimeToUtc(date, hour, minute) {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });

  let guess = target;
  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const correction = target - representedAsUtc;
    guess += correction;
    if (correction === 0) break;
  }
  return guess;
}

export function sessionWindow(date) {
  if (!validDate(date)) throw new Error('date must be a real calendar date in YYYY-MM-DD format.');
  const start = easternTimeToUtc(date, 4, 0);
  const cutoff = easternTimeToUtc(date, 9, 20);
  return { start, cutoff, lastIncludedBar: cutoff - MINUTE_MS };
}

export function summarizeBars(results, window) {
  const bars = (Array.isArray(results) ? results : [])
    .filter(bar => Number.isFinite(bar?.t) && bar.t >= window.start && bar.t < window.cutoff
      && Number.isFinite(bar?.h) && Number.isFinite(bar?.l) && Number.isFinite(bar?.c)
      && bar.h > 0 && bar.l > 0 && bar.l <= bar.h)
    .sort((a, b) => a.t - b.t);

  if (!bars.length) return { bars: [], high: null, low: null, last: null, volume: null, drawdown: null, asOf: null, highTime: null, lowTime: null };

  const highBar = bars.reduce((best, bar) => bar.h > best.h ? bar : best);
  const lowBar = bars.reduce((best, bar) => bar.l < best.l ? bar : best);
  const allVolumesKnown = bars.every(bar => Number.isFinite(bar.v) && bar.v >= 0);
  const lastBar = bars[bars.length - 1];
  return {
    bars: bars.map(bar => ({
      time: new Date(bar.t).toISOString(),
      open: Number.isFinite(bar.o) ? bar.o : null,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: Number.isFinite(bar.v) && bar.v >= 0 ? bar.v : null,
    })),
    high: highBar.h,
    low: lowBar.l,
    last: lastBar.c,
    volume: allVolumesKnown ? bars.reduce((sum, bar) => sum + bar.v, 0) : null,
    drawdown: (1 - lowBar.l / highBar.h) * 100,
    asOf: new Date(lastBar.t).toISOString(),
    highTime: new Date(highBar.t).toISOString(),
    lowTime: new Date(lowBar.t).toISOString(),
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Use GET for this endpoint.' });
  }

  const url = new URL(request.url, 'https://vercel.invalid');
  const symbol = url.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const date = url.searchParams.get('date') ?? '';
  if (!/^[A-Z0-9](?:[A-Z0-9.-]{0,10}[A-Z0-9])?$/.test(symbol) || symbol.includes('..')) {
    return response.status(400).json({ error: 'symbol must be a valid ticker, such as AAPL or XLK.' });
  }
  if (!validDate(date)) {
    return response.status(400).json({ error: 'date must be a real calendar date in YYYY-MM-DD format.' });
  }

  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) return response.status(503).json({ error: 'MASSIVE_API_KEY is not configured for this deployment.' });

  const window = sessionWindow(date);
  const endpoint = new URL(`https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${window.start}/${window.lastIncludedBar}`);
  endpoint.searchParams.set('adjusted', 'true');
  endpoint.searchParams.set('sort', 'asc');
  endpoint.searchParams.set('limit', '50000');

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return response.status(502).json({ error: 'Could not reach Massive. Try again shortly.' });
  }

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : upstream.status === 401 || upstream.status === 403 ? upstream.status : 502;
    const message = upstream.status === 401 ? 'Massive rejected the API key.'
      : upstream.status === 403 ? 'Massive did not allow this request for the configured account.'
        : upstream.status === 429 ? 'Massive rate limit reached. Wait briefly and try again.'
          : `Massive returned an error (${upstream.status}).`;
    return response.status(status).json({ error: message });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return response.status(502).json({ error: 'Massive returned an unreadable response.' });
  }

  const summary = summarizeBars(payload.results, window);
  const retrievedAt = new Date().toISOString();
  return response.status(200).json({
    ticker: symbol,
    sessionDate: date,
    window: {
      startAt: new Date(window.start).toISOString(),
      cutoffAt: new Date(window.cutoff).toISOString(),
      lastIncludedBarAt: new Date(window.lastIncludedBar).toISOString(),
    },
    barCount: summary.bars.length,
    ...summary,
    previousClose: null,
    marketCap: null,
    source: 'Massive Stocks REST API · 1-minute aggregates',
    retrievedAt,
    issue: summary.bars.length ? null : 'No eligible premarket bars were returned for this date. Data may not yet be available on the account tier, or no qualifying trades produced bars.',
  });
}
