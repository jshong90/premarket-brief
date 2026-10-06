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
assert.equal(draft.sessionDate, '2026-10-06');
assert.equal(draft.previousArchiveDate, '2026-10-05');
assert.equal(draft.stocks.length, 0);
assert.ok(['SPY', 'QQQ', 'VIX', 'US10Y'].every(id => {
  const row = draft.marketContext.find(item => item.id === id);
  return row.value !== null && row.previousClose !== null && row.asOf && row.source;
}));
assert.equal(draft.marketContext.find(row => row.id === 'SPX').value, null);
assert.ok(draft.treasuryYields.every(row => row.value !== null && row.previousClose !== null && row.asOf && row.previousCloseAt && row.source));
assert.deepEqual(draft.keyLevels.map(row => row.id), ['ES', 'NQ', 'YM', 'RTY']);
const esLevels = draft.keyLevels.find(row => row.id === 'ES');
assert.equal(esLevels.high, 7867.75);
assert.equal(esLevels.low, 7829);
assert.equal(esLevels.highTime, '2026-10-06T12:16:00Z');
assert.equal(esLevels.lowTime, '2026-10-06T00:01:00Z');
const esQuote = draft.indexQuotes.find(row => row.id === 'ES');
assert.equal(esQuote.value, 7861.5);
assert.equal(esQuote.previousClose, 7830);
assert.equal(esQuote.asOf, '2026-10-06T13:19:00Z');
assert.ok(['NQ', 'YM', 'RTY'].every(id => {
  const row = draft.keyLevels.find(item => item.id === id);
  return row.high !== null && row.low !== null && row.asOf && row.highTime && row.lowTime && row.issue;
}));
assert.equal(draft.briefing.indices.length, 1);
assert.equal(draft.briefing.bonds.length, 1);
assert.equal(draft.briefing.indices[0].source, 'Desk commentary');
assert.equal(draft.briefing.bonds[0].source, 'Desk commentary');
assert.match(draft.briefing.indices[0].body, /Oil is trading at around \$86, below the \$88 key technical level/);
assert.match(draft.briefing.indices[0].body, /Equities are defying high energy prices and elevated bond yields\./);
assert.match(draft.briefing.bonds[0].body, /Treasury yields made a new high yesterday at 5\.32%\./);
assert.match(draft.briefing.bonds[0].body, /French 10-year yields cooling from 4\.95% to 4\.75%/);
assert.ok(draft.briefing.earnings.length === 0 && draft.briefing.news.length === 0);
assert.equal(draft.briefing.macro.length, 15);
assert.ok(draft.briefing.macro.every(note => note.sourceKey));
const normalizedMacro = normalizeMacroCalendar(draft.briefing.macro, draft.sessionDate);
assert.equal(normalizedMacro.length, 15);
assert.deepEqual(normalizedMacro.map(row => row.sortKey), [...normalizedMacro.map(row => row.sortKey)].sort((a, b) => a - b));
assert.ok(normalizedMacro.every(row => row.sortKey % 86400000 < 16 * 60 * 60 * 1000));
const withAfterClose = normalizeMacroCalendar([...draft.briefing.macro, {
  title: 'Tuesday, October 6', body: '7:00 p.m. ET — FED · Lorie Logan speaks',
  source: 'Econoday', url: 'https://us.econoday.com/byweek?day=5&lid=0&month=10&year=2026',
}], draft.sessionDate);
assert.equal(withAfterClose.length, normalizedMacro.length);
assert.ok(!withAfterClose.some(row => row.event.includes('Lorie Logan')));

const macroDayOrder = new Map([
  ['Tuesday, October 6', 0], ['Wednesday, October 7', 1],
  ['Thursday, October 8', 2], ['Friday, October 9', 3],
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
assert.equal(draft.briefing.macro.filter(note => note.body.includes('FED ·') && note.body.includes('speaks')).length, 4);
assert.ok(!draft.briefing.macro.some(note => /Lorie Logan speaks/.test(note.body)));
assert.ok(draft.briefing.macro.some(note => note.body.includes('FOMC minutes')));
assert.ok(draft.briefing.macro.some(note => note.body.includes('$39B reopened 10-year notes')
  && note.relatedSources.some(source => /TreasuryDirect · upcoming auctions/.test(source.source))
  && note.relatedSources.some(source => /U.S. Treasury · quarterly refunding/.test(source.source))));
assert.ok(draft.briefing.macro.some(note => note.body.includes('$22B reopened 30-year bonds')
  && note.relatedSources.some(source => /TreasuryDirect · upcoming auctions/.test(source.source))
  && note.relatedSources.some(source => /U.S. Treasury · quarterly refunding/.test(source.source))));
assert.ok(draft.indexQuotes.find(row => row.id === 'NQ').value !== null);
assert.ok(draft.indexQuotes.find(row => row.id === 'NQ').previousClose !== null);
assert.equal(draft.indexQuotes.find(row => row.id === 'ES').value, 7861.5);
assert.ok(draft.quotesRefreshedAt);
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
