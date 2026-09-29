import assert from 'node:assert/strict';
import handler, { sessionWindow, summarizeBars } from '../api/massive-bars.js';

const window = sessionWindow('2026-09-28');
assert.equal(new Date(window.start).toISOString(), '2026-09-28T08:00:00.000Z');
assert.equal(new Date(window.cutoff).toISOString(), '2026-09-28T13:20:00.000Z');
const winterWindow = sessionWindow('2026-01-12');
assert.equal(new Date(winterWindow.start).toISOString(), '2026-01-12T09:00:00.000Z');
assert.equal(new Date(winterWindow.cutoff).toISOString(), '2026-01-12T14:20:00.000Z');
assert.throws(() => sessionWindow('2026-02-30'), /real calendar date/);

const summarized = summarizeBars([
  { t: window.start - 60_000, h: 500, l: 1, c: 100, v: 9000 },
  { t: window.start, o: 100, h: 101, l: 99, c: 100.5, v: 10 },
  { t: window.start + 60_000, o: 100.5, h: 103, l: 98, c: 102, v: 20 },
  { t: window.lastIncludedBar, o: 102, h: 102, l: 100, c: 101, v: 30 },
  { t: window.cutoff, h: 900, l: 1, c: 500, v: 9000 },
], window);
assert.equal(summarized.bars.length, 3);
assert.equal(summarized.high, 103);
assert.equal(summarized.low, 98);
assert.equal(summarized.last, 101);
assert.equal(summarized.volume, 60);
assert.equal(summarized.asOf, new Date(window.lastIncludedBar).toISOString());
assert.equal(summarized.highTime, new Date(window.start + 60_000).toISOString());
assert.equal(summarized.drawdown, (1 - 98 / 103) * 100);

const oldFetch = globalThis.fetch;
const oldKey = process.env.MASSIVE_API_KEY;
process.env.MASSIVE_API_KEY = 'test-only-secret';
let seenRequest;
globalThis.fetch = async (input, init) => {
  seenRequest = { url: new URL(input), init };
  return new Response(JSON.stringify({ results: [{ t: window.start, o: 100, h: 101, l: 99, c: 100.5, v: 10 }] }), { status: 200 });
};
const makeResponse = () => ({
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const response = makeResponse();
await handler({ method: 'GET', url: '/api/massive-bars?symbol=aapl&date=2026-09-28' }, response);
assert.equal(response.statusCode, 200);
assert.equal(response.body.ticker, 'AAPL');
assert.equal(response.body.barCount, 1);
assert.equal(response.body.bars.length, 1);
assert.equal(seenRequest.init.headers.Authorization, 'Bearer test-only-secret');
assert.equal(seenRequest.url.hostname, 'api.massive.com');
assert.equal(seenRequest.url.searchParams.has('apiKey'), false);
assert.equal(seenRequest.url.pathname.endsWith(`/${window.lastIncludedBar}`), true);

const invalid = makeResponse();
await handler({ method: 'GET', url: '/api/massive-bars?symbol=AAPL%2F..%2FMSFT&date=2026-09-28' }, invalid);
assert.equal(invalid.statusCode, 400);

globalThis.fetch = oldFetch;
if (oldKey === undefined) delete process.env.MASSIVE_API_KEY;
else process.env.MASSIVE_API_KEY = oldKey;
console.log('PASS: Massive API route validation, ET/DST cutoff, inclusive 09:19 bar, provenance fields, and server-only key handling.');
