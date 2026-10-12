import { createHash } from 'node:crypto';
import { instruments, providers, editorialSources } from './sources.mjs';
import { windows, etParts, rangeDrawdown } from './model.mjs';

const iso = ms => new Date(ms).toISOString();
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || iso(Date.parse(value)).slice(0, 10) !== value) throw new Error('Invalid session date');
  return value;
}
export function timestamp(value) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Expected timestamp with timezone');
  return iso(Date.parse(value));
}
function numeric(value, name, zero = false) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') throw new Error(`Missing ${name}`);
  const n = Number(value);
  if (!Number.isFinite(n) || (zero ? n < 0 : n <= 0)) throw new Error(`Invalid ${name}`);
  return n;
}
function barTime(value) {
  if (typeof value === 'number') return iso(value < 1e12 ? value * 1000 : value);
  return timestamp(value);
}
export function validateCalendar(calendar, sessionDate) {
  date(sessionDate);
  if (calendar?.sessionDate !== sessionDate || typeof calendar.equitiesOpen !== 'boolean' || typeof calendar.bondsOpen !== 'boolean' || !calendar.source || !/^https:\/\//.test(calendar.url)) throw new Error('A sourced calendar decision for this date is required');
  timestamp(calendar.checkedAt);
  for (const key of ['previousEquitySession', 'previousBondSession', 'previousFuturesSession']) if (date(calendar[key]) >= sessionDate) throw new Error('Previous session must precede the new date');
  if (!calendar.equitiesOpen) throw new Error('Equity market closed: do not create or refresh a session');
  return calendar;
}

export function makePlan(sessionDate, calendar, now = new Date().toISOString(), cache = {}) {
  validateCalendar(calendar, sessionDate);
  timestamp(now);
  const w = windows(sessionDate);
  const requests = [];
  for (const [id, spec] of Object.entries(instruments)) {
    // Futures ranges yield their own latest price. A separate ES/NQ quote is a
    // fallback only when the range request fails, avoiding redundant lookups.
    requests.push({ id, kind: spec.bars ? 'bars' : 'quote', providers: spec.bars ?? spec.quote,
      quoteFallback: spec.bars && ['ES', 'NQ'].includes(id) ? spec.quote : [],
      symbols: spec.symbols, unit: spec.unit,
      startAt: iso(spec.kind === 'futures' ? w.futuresStart : w.equityStart), endAt: iso(w.end),
      previousSession: spec.kind === 'yield' ? calendar.previousBondSession : spec.kind === 'futures' ? calendar.previousFuturesSession : calendar.previousEquitySession,
      requiredIntervalMinutes: spec.bars ? 1 : undefined,
      skipReason: spec.kind === 'yield' && !calendar.bondsOpen ? 'Bond market closed; collect prior-session reference only.' : null,
    });
  }
  const batches = {};
  for (const request of requests) {
    const provider = request.providers.find(p => !(Date.parse(cache.unsupported?.[`${p}|${request.kind}|${request.id}`]?.until) > Date.parse(now)));
    if (!provider) continue;
    const symbol = request.symbols[provider];
    (batches[provider] ??= []).push({ id: request.id, kind: request.kind, symbol, startAt: request.startAt, endAt: request.endAt,
      previousSession: request.previousSession, needsPreviousClose: !cache.previousCloses?.[`${request.id}|${symbol}|${request.previousSession}`],
      referenceOnly: Boolean(request.skipReason) });
  }
  return { version: 1, sessionDate, plannedAt: timestamp(now), calendar, cutoffAt: iso(w.end), requests, batches,
    editorialChecklist: editorialSources, instructions: 'Quotes and bars must retain actual observation times. Save market-only responses. Do not infer prices from commentary.' };
}

function previousClose(raw, request, envelope, cache) {
  const key = `${request.id}|${envelope.symbol}|${request.previousSession}`;
  if (raw != null) {
    const asOf = timestamp(raw.asOf);
    if (raw.symbol !== envelope.symbol) throw new Error('Previous close belongs to a different instrument or contract');
    if (etParts(new Date(asOf)).date !== request.previousSession) throw new Error('Previous close is not from the previous trading session');
    if (Date.parse(asOf) > Date.parse(envelope.retrievedAt)) throw new Error('Previous close is later than retrieval');
    if (!raw.source || !/^https:\/\//.test(raw.url)) throw new Error('Previous close needs its own source and URL');
    const close = { value: numeric(raw.value, 'previous close'), asOf, source: raw.source, url: raw.url, symbol: raw.symbol, retrievedAt: envelope.retrievedAt };
    cache.previousCloses[key] = close;
    return close;
  }
  return cache.previousCloses[key] ?? null;
}

export function normalizeResponse(envelope, request, calendar, cache = { previousCloses: {} }) {
  const spec = instruments[request.id];
  if (envelope.id !== request.id || !request.providers.includes(envelope.provider) || envelope.symbol !== request.symbols[envelope.provider]) throw new Error('Unapproved provider or instrument');
  if (envelope.unit !== request.unit || !/^https:\/\//.test(envelope.url)) throw new Error('Missing source URL or incorrect units');
  const retrievedAt = timestamp(envelope.retrievedAt);
  const latest = Math.min(Date.parse(request.endAt), Math.floor(Date.parse(retrievedAt) / 60000) * 60000);
  const delay = envelope.delayMinutes;
  if (delay !== null && (!Number.isFinite(delay) || delay < 0)) throw new Error('delayMinutes must be a number or null (unknown)');
  const issues = [delay === null ? 'Provider delay unknown.' : `Provider-reported delay: ${delay} minutes.`];
  const base = { id: request.id, symbol: envelope.symbol, provider: envelope.provider,
    source: `${providers[envelope.provider].name} · ${envelope.symbol}`, url: envelope.url, retrievedAt,
    delayMinutes: delay, previousClose: previousClose(envelope.previousClose, request, envelope, cache) };
  if (!base.previousClose) issues.push('Previous-session close unavailable for this instrument.');
  if (spec.kind === 'proxy') issues.push(spec.proxyDescription ?? 'Proxy instrument; not the underlying cash index.');

  if (request.kind === 'quote') {
    let raw = envelope.data;
    const quoteBars = Array.isArray(raw) ? raw : raw?.bars ?? raw?.results;
    if (Array.isArray(quoteBars)) {
      if (envelope.intervalMinutes !== 1) throw new Error('A quote from bars requires an explicit one-minute interval');
      raw = quoteBars.filter(b => b.interpolated !== true && b.is_interpolated !== true)
        .map(b => ({ ...b, asOf: barTime(b.t ?? b.time ?? b.timestamp ?? b.begins_at) }))
        .filter(b => Date.parse(b.asOf) + 60000 <= latest)
        .sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf)).at(-1);
    }
    const asOf = barTime(raw?.asOf ?? raw?.timestamp ?? raw?.updated_at ?? raw?.t ?? raw?.time ?? raw?.begins_at);
    const value = numeric(raw?.value ?? raw?.price ?? raw?.last_trade_price ?? raw?.c ?? raw?.close ?? raw?.close_price, 'quote');
    if (Date.parse(asOf) > Date.parse(retrievedAt)) throw new Error('Observation is later than retrieval');
    // A bar close can be used as a quote only if the minute has completed.
    if (envelope.intervalMinutes != null && (envelope.intervalMinutes !== 1 || Date.parse(asOf) + 60000 > latest)) throw new Error('Quote bar has not completed inside the capture window');
    if (Date.parse(asOf) >= Date.parse(request.endAt)) throw new Error('Quote is at or after cutoff');
    const outside = Date.parse(asOf) < Date.parse(request.startAt);
    if (outside) issues.push('No observation inside this premarket window; earlier reading was not used as today’s price.');
    if (request.skipReason) issues.push(request.skipReason);
    const usable = !outside && !request.skipReason;
    if (usable) issues.push(`Observation age at retrieval: ${Math.floor((Date.parse(retrievedAt) - Date.parse(asOf)) / 60000)} minutes.`);
    return { ...base, value: usable ? value : null, asOf: usable ? asOf : null, issue: issues.join(' '), complete: usable };
  }

  if (envelope.intervalMinutes !== 1) throw new Error('Key levels require one-minute bars');
  const raw = Array.isArray(envelope.data) ? envelope.data : envelope.data?.bars ?? envelope.data?.results ?? envelope.data?.data?.bars;
  if (!Array.isArray(raw)) throw new Error('Missing bar array');
  const byTime = new Map();
  for (const b of raw) {
    if (b.interpolated === true || b.is_interpolated === true) continue;
    const asOf = barTime(b.t ?? b.time ?? b.timestamp ?? b.begins_at);
    const t = Date.parse(asOf);
    if (t % 60000) throw new Error('Bars must use minute-start timestamps');
    if (t < Date.parse(request.startAt) || t + 60000 > latest) continue;
    const h = numeric(b.h ?? b.high ?? b.high_price, 'high');
    const l = numeric(b.l ?? b.low ?? b.low_price, 'low');
    const c = numeric(b.c ?? b.close ?? b.close_price, 'close');
    if (l > h || c < l || c > h) throw new Error('Invalid OHLC range');
    const row = { t, h, l, c, asOf };
    if (byTime.has(t) && JSON.stringify(byTime.get(t)) !== JSON.stringify(row)) throw new Error('Conflicting duplicate minute bars');
    byTime.set(t, row);
  }
  const bars = [...byTime.values()].sort((a, b) => a.t - b.t);
  const expected = Math.max(0, (Date.parse(request.endAt) - Date.parse(request.startAt)) / 60000);
  const missingMinutes = expected - bars.length;
  if (!bars.length) throw new Error('No completed bars inside the requested window');
  const high = bars.reduce((a, b) => b.h > a.h ? b : a);
  const low = bars.reduce((a, b) => b.l < a.l ? b : a);
  const last = bars.at(-1);
  const complete = missingMinutes === 0 && latest >= Date.parse(request.endAt);
  if (!complete) issues.push(`Partial range: ${bars.length}/${expected} minute buckets; last bar ${last.asOf}.`);
  return { ...base, high: high.h, low: low.l, highTime: high.asOf, lowTime: low.asOf,
    value: last.c, asOf: last.asOf, drawdown: rangeDrawdown(high.h, low.l), complete,
    coverage: { expectedMinutes: expected, observedMinutes: bars.length, missingMinutes, startAt: request.startAt, endAt: request.endAt }, issue: issues.join(' ') };
}

// Adapters implement one batch function. The file bridge supports ChatGPT MCP
// responses now; the same contract supports a future authenticated API adapter.
export async function collect(plan, adapter, { cache = {}, now = () => new Date().toISOString(), retry = 1 } = {}) {
  validateCalendar(plan.calendar, plan.sessionDate);
  cache.previousCloses ??= {};
  cache.unsupported ??= {};
  const processingStartedAt = now();
  const startedAt = timestamp(plan.plannedAt);
  if (Date.parse(startedAt) > Date.parse(processingStartedAt)) throw new Error('Collection plan starts in the future');
  const canonical = {}, attempts = [], rawResponses = [];
  const jobs = plan.requests.map(r => ({ request: r, queue: [...r.providers], fallback: false }));
  while (jobs.some(j => j.queue.length)) {
    const groups = new Map();
    for (const job of jobs) {
      if (!job.queue.length || canonical[job.request.id]?.complete) continue;
      const provider = job.queue.shift();
      const key = `${provider}|${job.request.kind}|${job.request.id}`;
      if (cache.unsupported[key] && Date.parse(cache.unsupported[key].until) > Date.parse(now())) {
        attempts.push({ id: job.request.id, provider, status: 'cached-unsupported', reason: cache.unsupported[key].reason });
        continue;
      }
      if (!groups.has(provider)) groups.set(provider, []);
      groups.get(provider).push(job);
    }
    await Promise.all([...groups].map(async ([provider, batch]) => {
      let pending = batch;
      for (let pass = 0; pending.length && pass <= retry; pass++) {
        let responses;
        try { responses = await adapter.fetchBatch(provider, pending.map(j => j.request)); }
        catch { responses = pending.map(j => ({ id: j.request.id, error: { code: 'transient', message: 'Provider request failed' } })); }
        if (!Array.isArray(responses)) responses = [];
        const next = [];
        for (const job of pending) {
          const matches = responses.filter(r => r.id === job.request.id);
          const result = matches.length === 1 ? matches[0] : { error: { code: 'unavailable', message: 'Missing or duplicate response' } };
          let error = result.error;
          if (!error) {
            try {
              if (Date.parse(result.retrievedAt) > Date.parse(now())) throw new Error('Future retrieval time');
              const normalized = normalizeResponse({ ...result, provider }, job.request, plan.calendar, cache);
              rawResponses.push({ ...result, provider, kind: job.request.kind });
              // Keep the first valid partial quote if fallbacks cannot improve it.
              const old = canonical[job.request.id];
              if (!old || normalized.complete || (!old.value && normalized.value)) canonical[job.request.id] = normalized;
              attempts.push({ id: job.request.id, provider, status: normalized.complete ? 'ok' : 'partial' });
              // A partial but valid range must not be replaced by a live quote.
              if (normalized.high != null || normalized.complete) job.queue = [];
            } catch (e) { error = { code: 'invalid', message: e.message }; }
          }
          if (error) {
            attempts.push({ id: job.request.id, provider, status: error.code, reason: error.message });
            if (error.code === 'unsupported') cache.unsupported[`${provider}|${job.request.kind}|${job.request.id}`] = { until: iso(Date.parse(now()) + 86400000), reason: error.message };
            if (error.code === 'transient' && pass < retry) next.push(job);
          }
        }
        pending = next;
      }
    }));
    for (const job of jobs) {
      if (!job.queue.length && !canonical[job.request.id] && !job.fallback && job.request.quoteFallback.length) {
        job.fallback = true;
        job.request = { ...job.request, kind: 'quote', providers: job.request.quoteFallback };
        job.queue = [...job.request.providers];
      }
    }
  }
  const finishedAt = now();
  return { version: 1, sessionDate: plan.sessionDate, startedAt, finishedAt, calendar: plan.calendar,
    requestedIds: plan.requests.map(r => r.id), canonical, attempts, rawResponses,
    timing: { elapsedMs: Date.parse(finishedAt) - Date.parse(startedAt), processingMs: Date.parse(finishedAt) - Date.parse(processingStartedAt), providerAttempts: attempts.filter(a => a.status !== 'cached-unsupported').length }, cache };
}

export function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
