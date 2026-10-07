import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const scannerUrl = compile(fs.readFileSync('src/lib/scanner.ts', 'utf8'));
const rangesUrl = compile(fs.readFileSync('src/lib/ranges.ts', 'utf8').replace("'./scanner'", JSON.stringify(scannerUrl)));
const { normalizeMacroCalendar } = await import(compile(fs.readFileSync('src/lib/macroCalendar.ts', 'utf8')));
const { readSnapshot } = await import(compile(fs.readFileSync('src/lib/snapshot.ts', 'utf8')
  .replace("'./scanner'", JSON.stringify(scannerUrl))
  .replace("'./ranges'", JSON.stringify(rangesUrl))));

const draft = JSON.parse(fs.readFileSync('public/data/snapshot.json', 'utf8'));
assert.equal(readSnapshot(draft).status, 'draft');
assert.equal(draft.sessionDate, '2026-10-07');
assert.equal(draft.previousArchiveDate, '2026-10-06');
assert.equal(draft.cutoffAt, undefined);
assert.equal(draft.stocks.length, 0);
assert.equal(draft.sectors.length, 0);
assert.equal(draft.marketContext.length, 5);
assert.ok(draft.marketContext.filter(row => row.id !== 'US10Y').every(row => row.value === null && row.previousClose === null && row.change === null && row.asOf === null));
const tenYear = draft.marketContext.find(row => row.id === 'US10Y');
assert.equal(tenYear.value, 5.337);
assert.equal(tenYear.previousClose, 5.284);
assert.ok(Math.abs(tenYear.change - 5.3) < 1e-9);
assert.equal(tenYear.asOf, '2026-10-07T12:36:00.000Z');
assert.equal(tenYear.source.startsWith('TradingView Official MCP'), true);
assert.deepEqual(draft.treasuryYields.map(row => [row.tenor, row.value, row.previousClose, row.asOf, row.previousCloseAt]), [
  ['2Y', 4.814, 4.802, '2026-10-07T12:39:00.000Z', '2026-10-06T20:58:00.000Z'],
  ['5Y', 5.07, 5.037, '2026-10-07T12:35:00.000Z', '2026-10-06T20:56:00.000Z'],
  ['10Y', 5.337, 5.284, '2026-10-07T12:36:00.000Z', '2026-10-06T20:59:00.000Z'],
  ['30Y', 5.713, 5.66, '2026-10-07T12:35:00.000Z', '2026-10-06T20:59:00.000Z'],
]);
assert.ok(draft.treasuryYields.every(row => row.source.startsWith('TradingView Official MCP') && row.retrievedAt && row.url.startsWith('https://')));
assert.deepEqual(draft.keyLevels.map(row => row.id), ['ES', 'NQ', 'YM', 'RTY']);
assert.ok(draft.keyLevels.every(row => row.high === null && row.low === null && row.asOf === null));
assert.ok(draft.indexQuotes.every(row => row.value === null && row.previousClose === null && row.asOf === null));
assert.equal(draft.quotesRefreshedAt, '2026-10-07T12:40:56.887Z');
assert.equal(draft.briefing.indices.length, 1);
assert.equal(draft.briefing.indices[0].title, 'Equity Commentary');
assert.equal(draft.briefing.indices[0].source, 'Desk commentary');
assert.equal(draft.briefing.indices[0].body, "Oil is trading at around $90, hovering around that 88 technical level. Oil and bond yields will still prove to be strong headwinds against equities.\n\nBoth indices made new ATHs yesterday, with a strong fade into 2nd half of the session and follow through selling overnight. Bitcoin is following through on a strong down move in Asia session.\n\nThat being said, breadth still remains weak and we are trading into earnings/midterms which only means additional volatility is on the horizon. I get the sense the market will range here until things change. Neither bulls nor bears want to be offsides if Trump strikes a deal with Iran.");
assert.equal(draft.briefing.bonds.length, 1);
assert.equal(draft.briefing.bonds[0].title, 'Bond Commentary');
assert.equal(draft.briefing.bonds[0].source, 'Desk commentary');
assert.equal(draft.briefing.bonds[0].body, "France's national debt is still a point of concern - small cooldown to 4.9% overnight, still elevated.\n\nUS Treasury 10Y made a new high overnight, sitting around 5.337%.");
assert.equal(draft.briefing.earnings.length, 0);
assert.equal(draft.briefing.news.length, 0);
assert.equal(draft.briefing.macro.length, 10);
assert.ok(draft.briefing.macro.every(note => note.sourceKey));
const normalizedMacro = normalizeMacroCalendar(draft.briefing.macro, draft.sessionDate);
assert.equal(normalizedMacro.length, 10);
assert.deepEqual(normalizedMacro.map(row => row.sortKey), [...normalizedMacro.map(row => row.sortKey)].sort((a, b) => a - b));
assert.ok(normalizedMacro.every(row => row.sortKey % 86400000 < 16 * 60 * 60 * 1000));
const withAfterClose = normalizeMacroCalendar([...draft.briefing.macro, {
  title: 'Tuesday, October 6', body: '7:00 p.m. ET — FED · Lorie Logan speaks',
  source: 'Econoday', url: 'https://us.econoday.com/byweek?day=5&lid=0&month=10&year=2026',
}], draft.sessionDate);
assert.equal(withAfterClose.length, normalizedMacro.length);
assert.ok(!withAfterClose.some(row => row.event.includes('Lorie Logan')));

const macroDayOrder = new Map([
  ['Wednesday, October 7', 0], ['Thursday, October 8', 1], ['Friday, October 9', 2],
]);
let previousMacroMinute = -1;
for (const note of draft.briefing.macro) {
  assert.ok(note.source && note.url.startsWith('https://'));
  const time = note.body.match(/^(\d{1,2}):(\d{2})\s*([ap])\.m\. ET — /i);
  assert.ok(time, `expected timestamped calendar event: ${note.body}`);
  assert.ok(macroDayOrder.has(note.title), `unexpected event date: ${note.title}`);
  const hour = Number(time[1]) % 12 + (time[3].toLowerCase() === 'p' ? 12 : 0);
  const absoluteMinute = macroDayOrder.get(note.title) * 1440 + hour * 60 + Number(time[2]);
  assert.ok(absoluteMinute >= previousMacroMinute, `macro events are out of chronological order at ${note.body}`);
  assert.ok(hour * 60 + Number(time[2]) < 16 * 60, `event is after the 4:00 p.m. ET close: ${note.body}`);
  previousMacroMinute = absoluteMinute;
  assert.ok((note.relatedSources ?? []).every(source => source.source && source.url.startsWith('https://')));
}
assert.equal(draft.briefing.macro.filter(note => note.body.includes('FED ·') && note.body.includes('speaks')).length, 2);
assert.ok(draft.briefing.macro.some(note => note.body.includes('FOMC minutes')));
assert.ok(draft.briefing.macro.some(note => note.body.includes('$39B reopened 10-year notes')
  && note.relatedSources.some(source => /TreasuryDirect · upcoming auctions/.test(source.source))
  && note.relatedSources.some(source => /U.S. Treasury · quarterly refunding/.test(source.source))));

const oct6Archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-06.json', 'utf8'));
assert.equal(readSnapshot(oct6Archive).status, 'archived');
assert.equal(oct6Archive.sessionDate, '2026-10-06');
assert.equal(oct6Archive.previousArchiveDate, '2026-10-05');
assert.equal(oct6Archive.marketContext.find(row => row.id === 'SPY').value, 778.05);
assert.equal(oct6Archive.marketContext.find(row => row.id === 'VIX').value, 15.29);
assert.equal(oct6Archive.keyLevels.find(row => row.id === 'ES').high, 7867.75);
assert.match(oct6Archive.briefing.indices[0].body, /Oil is trading at around \$86/);
assert.match(oct6Archive.briefing.bonds[0].body, /new high yesterday at 5\.32%/);

const oct5Archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-05.json', 'utf8'));
assert.equal(readSnapshot(oct5Archive).status, 'archived');
assert.equal(oct5Archive.sessionDate, '2026-10-05');
assert.equal(oct5Archive.marketContext.find(row => row.id === 'SPY').value, 769.33);
assert.equal(oct5Archive.marketContext.find(row => row.id === 'VIX').asOf, '2026-10-05T13:19:00.000Z');
assert.equal(oct5Archive.keyLevels.find(row => row.id === 'ES').high, 7793);
assert.match(oct5Archive.briefing.indices[0].body, /Oil is trading at around \$90/);
const current = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-02.json', 'utf8'));
const opening = JSON.parse(fs.readFileSync('public/data/snapshot-opening-0635.json', 'utf8'));
const archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-09-30.json', 'utf8'));
const oct1Archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-01.json', 'utf8'));
assert.equal(readSnapshot(current).status, 'archived');
assert.equal(current.sessionDate, '2026-10-02');
assert.equal(current.cutoffAt, undefined);
assert.equal(oct1Archive.sessionDate, '2026-10-01');
assert.equal(readSnapshot(oct1Archive).status, 'partial');
assert.equal(oct1Archive.cutoffAt, '2026-10-01T13:20:00.000Z');
assert.deepEqual(current.keyLevels.map(row => row.id), ['ES', 'NQ', 'YM', 'RTY']);
assert.ok(current.keyLevels.every(row => Number.isFinite(row.high) && Number.isFinite(row.low)
  && row.high > row.low && row.highTime && row.lowTime && row.asOf === '2026-10-02T13:19:00.000Z'
  && row.retrievedAt && row.source.startsWith('TradingView Official MCP')));
assert.equal(current.keyLevels.find(row => row.id === 'ES').high, 7802.75);
assert.equal(current.keyLevels.find(row => row.id === 'ES').low, 7723.25);
assert.equal(current.keyLevels.find(row => row.id === 'NQ').high, 31222.25);
assert.equal(current.keyLevels.find(row => row.id === 'NQ').low, 30760.25);
assert.match(current.keyLevels.find(row => row.id === 'YM').issue, /895 of 920/);
assert.match(current.keyLevels.find(row => row.id === 'RTY').issue, /907 of 920/);
assert.equal(current.stocks.length, 312);
assert.equal(readSnapshot(current).stocks.filter(row => row.drawdown !== null).length, 143);
assert.equal(readSnapshot(opening).status, 'partial');
assert.equal(opening.scanVariant, 'opening-0635');
assert.equal(opening.cutoffAt, '2026-10-01T13:35:00.000Z');
assert.equal(readSnapshot(opening).stocks.filter(row => row.drawdown !== null).length, 189);
assert.equal(readSnapshot(opening).sectors.filter(row => row.drawdown !== null).length, 6);
assert.equal(readSnapshot(opening).sectors.find(row => row.ticker === 'XLV').drawdown !== null, true);
assert.equal(opening.sectorQuotesRefreshedAt, '2026-10-01T18:30:22.414Z');
assert.equal(opening.sectors.length, 11);
assert.ok(opening.sectors.every(row => row.quote > 0 && row.quoteAsOf === '2026-10-01T18:23:00.000Z' && row.quoteSource.startsWith('TradingView Official MCP')));
assert.deepEqual(opening.sectors.map(row => row.quote), current.sectors.map(row => row.quote));
assert.deepEqual(Object.keys(opening.briefing).sort(), Object.keys(current.briefing).sort());
assert.deepEqual(opening.indexQuotes, current.indexQuotes);
assert.deepEqual(opening.treasuryYields, current.treasuryYields);
assert.deepEqual(opening.keyLevels, oct1Archive.keyLevels);
assert.throws(() => readSnapshot({...opening,cutoffAt:current.cutoffAt}), /cutoff/);
assert.throws(() => readSnapshot({...opening,stocks:opening.stocks.map((row,index)=>index?row:{...row,asOf:opening.cutoffAt})}), /outside/);
assert.equal(readSnapshot(archive).status, 'imported');
assert.equal(oct1Archive.previousArchiveDate, archive.sessionDate);
assert.equal(current.previousArchiveDate, oct1Archive.sessionDate);
assert.equal(current.indexQuotes.length, 2);
assert.ok(current.briefing.indices.every(note => !('indexQuotes' in note)));

const changed = edit => { const snapshot = structuredClone(current); edit(snapshot); return snapshot; };
assert.equal(readSnapshot(changed(s => { s.marketContext.find(row => row.id === 'SPY').change = -0.5; })).marketContext.find(row => row.id === 'SPY').change, -0.5);
assert.equal(readSnapshot(changed(s => { s.indexQuotes[0].value = 30_600; s.indexQuotes[0].asOf = '2026-10-01T06:12:00Z'; s.quotesRefreshedAt = '2026-10-01T06:13:00Z'; })).indexQuotes[0].value, 30_600);
assert.throws(() => readSnapshot(changed(s => { s.marketContext[0].change = 'down'; })), /marketContext/);
assert.throws(() => readSnapshot(changed(s => { s.indexQuotes[0].value = 'bad'; })), /index quote/);
assert.throws(() => readSnapshot(changed(s => { s.indexQuotes[0].value = 100; s.indexQuotes[0].asOf = null; })), /index quote/);
assert.throws(() => readSnapshot(changed(s => { s.keyLevels[0].high = 100; s.keyLevels[0].low = 200; })), /key level/);
assert.throws(() => readSnapshot(changed(s => { Object.assign(s.keyLevels[0], { high: 200, low: 100, asOf: '2026-10-01T13:20:00Z', highTime: '2026-10-01T13:19:00Z', lowTime: '2026-10-01T13:19:00Z' }); })), /key level/);
assert.throws(() => readSnapshot(changed(s => { s.previousArchiveDate = '2026-10-02'; })), /archive date/);
assert.throws(() => readSnapshot({...structuredClone(oct1Archive), status:'draft'}), /drafts/);
assert.equal(readSnapshot(changed(s => { s.briefing.indices.push({ title: 'My note', body: 'Exact wording.', source: 'Desk commentary', url: '' }); })).status, 'archived');
assert.throws(() => readSnapshot(changed(s => { s.briefing.indices.push({ title: 'External claim', body: 'News', source: 'Other', url: '' }); })), /HTTPS/);

console.log('PASS: published packets, partial scanner coverage, negative changes, quote and key-level validation, archive link, and user-authored commentary.');
