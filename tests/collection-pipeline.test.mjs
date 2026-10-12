import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makePlan, normalizeResponse, collect, digest } from '../scripts/pipeline/collection.mjs';
import { generateSnapshot, rolloverDraft, validatePacket } from '../scripts/pipeline/snapshot.mjs';
import { applyCandidate, writeJson, readJson, replayAdapter } from '../scripts/pipeline/files.mjs';
import { windows } from '../scripts/pipeline/model.mjs';

// Synthetic prices are isolated fixtures; never write them to public/data.
const day = '2026-10-12';
const calendar = { sessionDate: day, equitiesOpen: true, bondsOpen: true,
  previousEquitySession: '2026-10-09', previousBondSession: '2026-10-09', previousFuturesSession: '2026-10-09',
  source: 'Test calendar', url: 'https://example.com/calendar', checkedAt: '2026-10-12T12:00:00Z' };
const now = () => '2026-10-12T13:35:00.000Z';
const plan = makePlan(day, calendar, now());
const request = id => plan.requests.find(r => r.id === id);
const envelope = (id, overrides = {}) => {
  const provider = overrides.provider ?? request(id).providers[0];
  return { id, provider, kind: request(id).kind,
    symbol: request(id).symbols[provider], unit: request(id).unit,
    url: provider === 'openmarket' ? 'https://openmarket.xyz/' : `https://${provider === 'tradingview' ? 'www.tradingview.com' : provider === 'public' ? 'public.com' : 'robinhood.com'}/`,
    retrievedAt: now(), delayMinutes: 10, data: { value: 100, asOf: '2026-10-12T13:19:00Z' }, ...overrides };
};
function bars(id = 'ES', count) {
  const w = windows(day), expected = (w.end - w.futuresStart) / 60000;
  return envelope(id, { intervalMinutes: 1, data: Array.from({ length: count ?? expected }, (_, i) => ({
    t: w.futuresStart + i * 60000, h: 101 + i / 1000, l: 99, c: 100,
  })) });
}
async function base() { return readJson('public/data/snapshot.json'); }

test('DST-aware windows and one shared futures request', () => {
  assert.equal(new Date(windows('2026-11-02').end).toISOString(), '2026-11-02T14:20:00.000Z');
  assert.equal(plan.cutoffAt, '2026-10-12T13:20:00.000Z');
  assert.equal(plan.requests.filter(r => r.id === 'NQ').length, 1);
  assert.equal(request('NQ').kind, 'bars');
  assert.throws(() => makePlan(day, { ...calendar, equitiesOpen: false }), /closed/);
});

test('range excludes 09:20 and unfinished bars; detects missing and conflicting minutes', () => {
  const raw = bars();
  raw.data.push({ t: windows(day).end, h: 9999, l: 1, c: 100 });
  const full = normalizeResponse(raw, request('ES'), calendar);
  assert.equal(full.complete, true);
  assert.equal(full.high < 9999, true);
  assert.equal(full.asOf, '2026-10-12T13:19:00.000Z');
  const partial = normalizeResponse({ ...raw, retrievedAt: '2026-10-12T13:19:30Z' }, request('ES'), calendar);
  assert.equal(partial.asOf, '2026-10-12T13:18:00.000Z');
  assert.equal(partial.complete, false);
  assert.match(partial.issue, /Partial range/);
  const conflict = bars('ES', 2); conflict.data.push({ ...conflict.data[0], h: 105 });
  assert.throws(() => normalizeResponse(conflict, request('ES'), calendar), /Conflicting/);
});

test('strict fields reject wrong symbol, units, intervals, previous session and mixed proxy close', () => {
  assert.throws(() => normalizeResponse(envelope('VIX', { symbol: 'AMEX:SPY' }), request('VIX'), calendar), /instrument/);
  assert.throws(() => normalizeResponse(envelope('US10Y', { unit: 'price' }), request('US10Y'), calendar), /units/);
  assert.throws(() => normalizeResponse({ ...bars(), intervalMinutes: 5 }, request('ES'), calendar), /one-minute/);
  const prior = { value: 99, asOf: '2026-10-09T20:00:00Z', source: 'Test', url: 'https://example.com', symbol: 'SP:SPX' };
  assert.throws(() => normalizeResponse(envelope('SPX', { previousClose: prior }), request('SPX'), calendar), /different instrument/);
  assert.throws(() => normalizeResponse(envelope('VIX', { data: { value: 100, asOf: plan.cutoffAt } }), request('VIX'), calendar), /cutoff/);
  assert.throws(() => normalizeResponse(envelope('VIX', { data: { value: null, asOf: '2026-10-12T13:19:00Z' } }), request('VIX'), calendar), /Missing/);
});

test('prior close cache is scoped to exact symbol and previous session', () => {
  const cache = { previousCloses: {} };
  const raw = envelope('VIX', { previousClose: { value: 99, asOf: '2026-10-09T20:14:00Z', source: 'Test', url: 'https://example.com', symbol: 'CBOE:VIX' } });
  normalizeResponse(raw, request('VIX'), calendar, cache);
  assert.equal(normalizeResponse(envelope('VIX'), request('VIX'), calendar, cache).previousClose.value, 99);
  assert.equal(normalizeResponse(envelope('VIX'), { ...request('VIX'), previousSession: '2026-10-08' }, calendar, cache).previousClose, null);
});

test('stale equity readings and closed bond session retain no false current quote', () => {
  const stale = normalizeResponse(envelope('SPY', { data: { value: 100, asOf: '2026-10-12T07:00:00Z' } }), request('SPY'), calendar);
  assert.equal(stale.value, null);
  const holidayPlan = makePlan(day, { ...calendar, bondsOpen: false });
  const closed = normalizeResponse(envelope('US10Y'), holidayPlan.requests.find(r => r.id === 'US10Y'), calendar);
  assert.equal(closed.value, null);
  assert.match(closed.issue, /closed/);
});

test('OpenMarket SPX proxy is labeled and uses the exact proxy instrument', () => {
  const q = normalizeResponse(envelope('SPX', { intervalMinutes: 1, data: [
    { time: '2026-10-12T13:19:00Z', close: 100 },
    { time: '2026-10-12T13:20:00Z', close: 200 },
  ] }), request('SPX'), calendar);
  assert.equal(q.value, 100);
  assert.equal(q.asOf, '2026-10-12T13:19:00.000Z');
  assert.match(q.issue, /synthetic SP500 proxy; not the SPX cash index/);
});

test('collection batches by provider, caches unsupported results and falls back', async () => {
  const small = { ...plan, requests: [request('SPY'), request('QQQ')] };
  const calls = [], cache = {};
  const adapter = { async fetchBatch(provider, rows) {
    calls.push([provider, rows.length]);
    return rows.map(r => provider === 'robinhood'
      ? { id: r.id, error: { code: 'unsupported', message: 'Quote not supported' } }
      : envelope(r.id, { provider, symbol: r.symbols[provider] }));
  } };
  const capture = await collect(small, adapter, { now, cache });
  assert.deepEqual(calls, [['robinhood', 2], ['public', 2]]);
  assert.equal(capture.canonical.SPY.provider, 'public');
  calls.length = 0;
  await collect(small, adapter, { now, cache });
  assert.deepEqual(calls, [['public', 2]]);
});

test('transient failures retry once and do not poison capability cache', async () => {
  let calls = 0;
  const cache = {};
  const capture = await collect({ ...plan, requests: [request('VIX')] }, { async fetchBatch() {
    calls++;
    return calls === 1 ? [{ id: 'VIX', error: { code: 'transient', message: 'Try again' } }] : [envelope('VIX')];
  } }, { now, cache });
  assert.equal(calls, 2);
  assert.equal(capture.canonical.VIX.value, 100);
  assert.deepEqual(cache.unsupported, {});
});

test('ES range failure falls back to a quote without inventing key levels', async () => {
  const capture = await collect({ ...plan, requests: [request('ES')] }, replayAdapter([
    envelope('ES', { kind: 'bars', error: { code: 'unsupported', message: 'No bars' } }),
    envelope('ES', { kind: 'quote', provider: 'public', symbol: 'ES' }),
  ]), { now });
  assert.equal(capture.canonical.ES.value, 100);
  assert.equal(capture.canonical.ES.high, undefined);
  const packet = generateSnapshot(await base(), capture);
  assert.equal(packet.indexQuotes.find(r => r.id === 'ES').value, 100);
  assert.equal(packet.keyLevels.find(r => r.id === 'ES').high, null);
});

test('one canonical record populates duplicate displays; commentary is byte-for-byte preserved', async () => {
  const original = await base();
  original.briefing.indices = [{ title: 'Equity Commentary', body: 'My words.\n\nKeep these.', source: 'Desk commentary', url: '' }];
  const capture = await collect({ ...plan, requests: [request('US10Y'), request('ES')] }, replayAdapter([envelope('US10Y'), bars()]), { now });
  const packet = generateSnapshot(original, capture);
  const strip = packet.marketContext.find(r => r.id === 'US10Y');
  const bonds = packet.treasuryYields.find(r => r.tenor === '10Y');
  assert.equal(strip.value, bonds.value);
  assert.equal(strip.asOf, bonds.asOf);
  assert.equal(packet.indexQuotes.find(r => r.id === 'ES').asOf, packet.keyLevels.find(r => r.id === 'ES').asOf);
  assert.deepEqual(packet.briefing, original.briefing);
  assert.equal(packet.cutoffAt, original.cutoffAt);
  assert.deepEqual(packet.benchmarks, original.benchmarks);
  validatePacket(packet);
  const changed = structuredClone(packet); changed.treasuryYields.find(r => r.tenor === '10Y').value = 4;
  assert.throws(() => validatePacket(changed), /diverged/);
  const editedCapture = structuredClone(capture); editedCapture.canonical.ES.value = 100.5;
  assert.throws(() => generateSnapshot(original, editedCapture), /raw evidence/);
});

test('failed refreshed field clears old values and rollover prepares a separate blank draft', async () => {
  const original = await base();
  const capture = await collect({ ...plan, requests: [request('VIX')] }, replayAdapter([]), { now });
  const next = generateSnapshot(original, capture);
  assert.equal(next.marketContext.find(r => r.id === 'VIX').value, null);
  assert.equal(next.marketContext.find(r => r.id === 'SPY').value, original.marketContext.find(r => r.id === 'SPY').value);
  const tomorrow = { ...calendar, sessionDate: '2026-10-13', previousEquitySession: day, previousFuturesSession: day };
  const rolled = rolloverDraft(original, tomorrow.sessionDate, tomorrow, now());
  assert.equal(rolled.draft.previousArchiveDate, day);
  assert.ok(rolled.draft.marketContext.every(r => r.value === null));
  assert.deepEqual(rolled.archive.marketContext, original.marketContext);
  assert.deepEqual(rolled.draft.briefing, { indices: [], bonds: [], macro: [], earnings: [], news: [] });
});

test('apply enforces snapshot lease and refuses to overwrite a different archive', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-pipeline-'));
  try {
    const original = await base();
    await writeJson(path.join(temp, 'snapshot.json'), original);
    const tomorrow = { ...calendar, sessionDate: '2026-10-13', previousEquitySession: day, previousFuturesSession: day };
    const transaction = rolloverDraft(original, tomorrow.sessionDate, tomorrow, now());
    const archivePath = path.join(temp, `snapshot-${day}.json`);
    await writeJson(archivePath, { ...transaction.archive, messages: ['Different archive'] });
    await assert.rejects(applyCandidate(temp, transaction, digest(original)), /overwrite/);
    assert.deepEqual(await readJson(path.join(temp, 'snapshot.json')), original);
    await fs.rm(archivePath);
    await assert.rejects(applyCandidate(temp, transaction, 'wrong-hash'), /changed/);
    await applyCandidate(temp, transaction, digest(original));
    assert.deepEqual(await readJson(archivePath), transaction.archive);
    assert.equal((await readJson(path.join(temp, 'snapshot.json'))).sessionDate, '2026-10-13');
    assert.equal((await readJson(path.join(temp, 'archive-index.json'))).entries[0].sessionDate, day);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
