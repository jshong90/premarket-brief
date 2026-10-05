import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const scannerUrl = compile(fs.readFileSync('src/lib/scanner.ts', 'utf8'));
const rangesUrl = compile(fs.readFileSync('src/lib/ranges.ts', 'utf8').replace("'./scanner'", JSON.stringify(scannerUrl)));
const { readSnapshot } = await import(compile(fs.readFileSync('src/lib/snapshot.ts', 'utf8')
  .replace("'./scanner'", JSON.stringify(scannerUrl))
  .replace("'./ranges'", JSON.stringify(rangesUrl))));

const draft = JSON.parse(fs.readFileSync('public/data/snapshot.json', 'utf8'));
assert.equal(readSnapshot(draft).status, 'draft');
assert.equal(draft.sessionDate, '2026-10-05');
assert.equal(draft.previousArchiveDate, '2026-10-02');
assert.equal(draft.stocks.length, 0);
assert.ok(draft.marketContext.every(row => row.value === null && row.previousClose === null));
assert.ok(draft.keyLevels.every(row => row.high === null && row.low === null));
assert.ok(draft.briefing.indices.length === 0 && draft.briefing.bonds.length === 0 && draft.briefing.earnings.length === 0 && draft.briefing.news.length === 0);
assert.equal(draft.briefing.macro.length, 8);
assert.deepEqual(draft.briefing.macro.slice(0, 5).map(note => note.title), [
  'Monday, October 5', 'Tuesday, October 6', 'Wednesday, October 7',
  'Thursday, October 8', 'Friday, October 9',
]);
assert.ok(draft.briefing.macro.slice(0, 5).every(note => note.source === 'Trading Economics' && note.url.startsWith('https://')));
assert.equal(draft.briefing.macro[5].source, 'Federal Reserve Board · October 2026 calendar');
assert.equal(draft.briefing.macro[5].url, 'https://www.federalreserve.gov/newsevents/2026-october.htm');
assert.equal(draft.briefing.macro[6].source, 'U.S. Treasury · Tentative Auction Schedule');
assert.equal(draft.briefing.macro[6].url, 'https://home.treasury.gov/system/files/221/Tentative-Auction-Schedule.pdf');
assert.match(draft.briefing.macro[7].source, /FinancialJuice/);
assert.equal(draft.briefing.macro[7].url, 'https://www.financialjuice.com/News/9787779/US-Treasury-Auctions-Summary.aspx');
assert.equal(draft.indexQuotes.find(row => row.id === 'NQ').value, null);
assert.equal(draft.indexQuotes.find(row => row.id === 'ES').value, 7775.25);
assert.equal(draft.indexQuotes.find(row => row.id === 'ES').previousClose, 7779);
assert.equal(draft.indexQuotes.find(row => row.id === 'ES').asOf, '2026-10-05T12:27:00.000Z');
assert.match(draft.indexQuotes.find(row => row.id === 'NQ').issue, /bad-handshake/);
assert.equal(draft.quotesRefreshedAt, '2026-10-05T12:37:48.526Z');
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

