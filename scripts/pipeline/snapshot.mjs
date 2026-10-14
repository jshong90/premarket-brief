import { readSnapshot, windows } from './model.mjs';
import { instruments } from './sources.mjs';
import { timestamp, validateCalendar, digest, makePlan, normalizeResponse } from './collection.mjs';

const blank = { value: null, previousClose: null, asOf: null, previousCloseAt: null, retrievedAt: null, source: 'Not captured', issue: 'No verified observation collected.' };
function quote(record) {
  if (!record) return { ...blank };
  return { value: record.value, asOf: record.asOf, previousClose: record.previousClose?.value ?? null,
    previousCloseAt: record.previousClose?.asOf ?? null, previousCloseSource: record.previousClose?.source,
    previousCloseUrl: record.previousClose?.url, retrievedAt: record.retrievedAt,
    source: record.source, url: record.url, issue: record.issue };
}
function range(record) {
  return { high: record?.high ?? null, low: record?.low ?? null, highTime: record?.highTime ?? null,
    lowTime: record?.lowTime ?? null, asOf: record?.high != null ? record.asOf : null,
    retrievedAt: record?.retrievedAt ?? null, source: record?.source ?? 'Not captured',
    issue: record?.high != null ? record.issue : 'No valid timestamped range collected.' };
}
function displayIdentity(record, id, fallbackLabel = id) {
  const reference = record?.provider === 'tradingeconomics' && ['ES', 'NQ'].includes(id);
  return { label: reference ? (id === 'ES' ? 'S&P 500' : 'Nasdaq-100') : fallbackLabel,
    ...(record?.symbol ? { symbol: record.symbol } : {}),
    ...(reference ? { instrumentType: 'index-reference' } : {}) };
}
function change(value, close, unit) {
  if (value === null || close === null || close <= 0) return null;
  return unit === 'bp' ? (value - close) * 100 : unit === 'pts' ? value - close : (value / close - 1) * 100;
}
function clearRow(row, fields) { return { ...row, ...Object.fromEntries(fields.map(key => [key, null])), source: 'Not captured', issue: 'Awaiting capture for this session.' }; }

export function generateSnapshot(base, capture, { scannerBenchmarks = false } = {}) {
  readSnapshot(base);
  if (base.sessionDate !== capture.sessionDate) throw new Error('Collection and snapshot dates differ');
  if (base.status === 'archived' || base.status === 'imported') throw new Error('Cannot refresh an archive or legacy import');
  validateCalendar(capture.calendar, capture.sessionDate);
  timestamp(capture.startedAt); timestamp(capture.finishedAt);
  if (Date.parse(capture.finishedAt) < Date.parse(capture.startedAt)) throw new Error('Collection timing is reversed');
  if (!Array.isArray(capture.requestedIds) || new Set(capture.requestedIds).size !== capture.requestedIds.length || capture.requestedIds.some(id => !instruments[id])) throw new Error('Invalid requested instruments');
  const result = structuredClone(base);
  const touched = new Set(capture.requestedIds);
  const plan = makePlan(capture.sessionDate, capture.calendar, capture.startedAt);
  for (const [id, row] of Object.entries(capture.canonical)) {
    if (!touched.has(id) || row.id !== id) throw new Error('Unexpected canonical observation');
    timestamp(row.retrievedAt);
    if (Date.parse(row.retrievedAt) > Date.parse(capture.finishedAt)) throw new Error('Retrieval exceeds collection time');
    if (row.value != null && (!Number.isFinite(row.value) || row.value <= 0 || !row.asOf)) throw new Error('Invalid canonical quote');
    if (row.asOf && Date.parse(timestamp(row.asOf)) >= windows(base.sessionDate).end) throw new Error('Canonical observation exceeds cutoff');
    // Re-derive each selected record from its retained raw response. This makes
    // generation reproducible and catches hand-edited derived fields.
    const reproducible = (capture.rawResponses ?? []).some(raw => {
      if (raw.id !== id || raw.provider !== row.provider) return false;
      const planned = plan.requests.find(r => r.id === id);
      const request = raw.kind === 'quote' && planned.kind === 'bars'
        ? { ...planned, kind: 'quote', providers: planned.quoteFallback } : planned;
      try { return digest(normalizeResponse(raw, request, capture.calendar, structuredClone(capture.cache))) === digest(row); }
      catch { return false; }
    });
    if (!reproducible) throw new Error(`Canonical record does not match raw evidence: ${id}`);
  }
  // Clear only fields being refreshed. An unsuccessful request must not leave
  // yesterday's or an earlier attempt's value behind as if the refresh succeeded.
  result.indexQuotes = base.indexQuotes?.map(row => touched.has(row.id) ? { id: row.id, ...displayIdentity(capture.canonical[row.id], row.id), ...quote(capture.canonical[row.id]) } : row);
  result.treasuryYields = base.treasuryYields?.map(row => touched.has(`US${row.tenor}`) ? {
    tenor: row.tenor, ...quote(capture.canonical[`US${row.tenor}`]), url: capture.canonical[`US${row.tenor}`]?.url ?? 'https://www.tradingview.com/',
  } : row);
  result.marketContext = base.marketContext?.map(row => {
    if (!touched.has(row.id)) return row;
    const fresh = quote(capture.canonical[row.id]);
    return { id: row.id, label: row.id === 'SPX' ? 'SPX · synthetic reference' : row.label,
      name: row.id === 'SPX' ? instruments.SPX.name : row.name, kind: row.kind,
      ...fresh, changeUnit: row.changeUnit, change: change(fresh.value, fresh.previousClose, row.changeUnit) };
  });
  result.keyLevels = base.keyLevels?.map(row => touched.has(row.id) ? { id: row.id, ...displayIdentity(capture.canonical[row.id], row.id, ({ ES: 'S&P 500 (ES)', NQ: 'Nasdaq-100 (NQ)', YM: 'Dow (YM)', RTY: 'Russell 2000 (RTY)' })[row.id]), url: capture.canonical[row.id]?.url ?? 'https://www.tradingview.com/markets/futures/quotes/', ...range(capture.canonical[row.id]) } : row);
  if (scannerBenchmarks) {
    if (['ES', 'NQ'].some(id => touched.has(id) && capture.canonical[id]?.provider === 'tradingeconomics')) throw new Error('Reference indices cannot replace CME scanner benchmarks');
    if (!base.cutoffAt || Date.parse(capture.finishedAt) < Date.parse(base.cutoffAt)) throw new Error('Benchmark capture requires a cutoff-based scanner packet');
    result.benchmarks = base.benchmarks.map(row => {
      const record = capture.canonical[row.id];
      if (!touched.has(row.id)) return row;
      const valid = record?.complete && record.high != null;
      return { id: row.id, ...range(valid ? record : null), drawdown: valid ? record.drawdown : null };
    });
  }
  const previousMessages = new Set(base.collection?.messages ?? []);
  const messages = [
    `Premarket price cutoff ${plan.cutoffAt}; later observations are excluded.`,
    `Collection completed ${capture.finishedAt}; observations retain their individual times.`,
    ...capture.requestedIds.map(id => `${id}: ${capture.canonical[id]?.issue ?? 'No usable data; quote and range fields remain null.'}`),
    ...capture.attempts.filter(a => !['ok', 'partial'].includes(a.status)).map(a => `${a.id} / ${a.provider}: ${a.status}${a.reason ? ` (${a.reason})` : ''}.`),
  ];
  result.messages = [...base.messages.filter(m => !previousMessages.has(m)), ...messages];
  result.quotesRefreshedAt = capture.finishedAt;
  result.collection = { version: 1, id: digest(capture), cutoffAt: plan.cutoffAt, startedAt: capture.startedAt, finishedAt: capture.finishedAt,
    timing: capture.timing, requestedIds: capture.requestedIds, messages };
  // Quotes do not establish a frozen scanner or change its capture time.
  return readSnapshot(result);
}

export function rolloverDraft(base, sessionDate, calendar, now = new Date().toISOString()) {
  readSnapshot(base);
  validateCalendar(calendar, sessionDate);
  if (sessionDate <= base.sessionDate) throw new Error('Rollover must advance the session date');
  const archive = { ...structuredClone(base), status: base.status === 'draft' ? 'archived' : base.status };
  const next = structuredClone(base);
  next.sessionDate = sessionDate; next.status = 'draft'; next.fetchedAt = timestamp(now);
  next.previousArchiveDate = base.sessionDate;
  for (const key of ['cutoffAt', 'quotesRefreshedAt', 'sectorQuotesRefreshedAt', 'scanVariant', 'collection']) delete next[key];
  next.messages = ['Draft for a new session; quotes and commentary await collection.'];
  next.stocks = []; next.sectors = []; next.universeCount = 0; next.universeComplete = false;
  next.connected = { tradingview: false, massive: false };
  next.briefing = { indices: [], bonds: [], energy: [], macro: [], earnings: [], news: [] };
  const quoteFields = ['value', 'previousClose', 'asOf', 'previousCloseAt', 'retrievedAt', 'change', 'high', 'low', 'highTime', 'lowTime'];
  for (const key of ['marketContext', 'indexQuotes', 'treasuryYields']) next[key] = base[key]?.map(row => {
    const cleaned = clearRow(row, quoteFields.filter(k => k in row));
    for (const k of ['series', 'approximate', 'previousCloseSource', 'previousCloseUrl']) delete cleaned[k];
    return cleaned;
  });
  next.keyLevels = base.keyLevels?.map(row => ({ id: row.id, label: row.label, ...range(null) }));
  next.benchmarks = base.benchmarks.map(row => ({ id: row.id, ...range(null), drawdown: null }));
  return { archive: readSnapshot(archive), draft: readSnapshot(next) };
}

export function validatePacket(packet) {
  const normalized = readSnapshot(packet);
  if (packet.status === 'frozen' && normalized.status !== 'frozen') throw new Error('Incomplete packet cannot be published as frozen');
  for (const row of packet.marketContext ?? []) {
    if (row.change !== null && row.value !== null && row.previousClose !== null) {
      const expected = change(row.value, row.previousClose, row.changeUnit);
      if (expected === null || Math.abs(row.change - expected) > 1e-6) throw new Error(`Incorrect derived change: ${row.id}`);
    }
  }
  if (packet.collection) {
    const ids = new Set(packet.collection.requestedIds);
    const a = packet.marketContext?.find(r => r.id === 'US10Y');
    const b = packet.treasuryYields?.find(r => r.tenor === '10Y');
    if (ids.has('US10Y') && a && b && ['value', 'previousClose', 'asOf', 'retrievedAt', 'source'].some(k => a[k] !== b[k])) throw new Error('10Y canonical observation diverged between sections');
    for (const row of packet.indexQuotes ?? []) {
      const key = packet.keyLevels?.find(r => r.id === row.id);
      if (ids.has(row.id) && key?.high != null && (row.asOf !== key.asOf || row.value < key.low || row.value > key.high)) throw new Error('Futures quote and range use inconsistent observations');
    }
  }
  return normalized;
}
