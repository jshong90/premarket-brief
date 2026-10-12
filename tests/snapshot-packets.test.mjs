import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const scannerUrl = compile(fs.readFileSync('src/lib/scanner.ts', 'utf8'));
const rangesUrl = compile(fs.readFileSync('src/lib/ranges.ts', 'utf8').replace("'./scanner'", JSON.stringify(scannerUrl)));
const { normalizeMacroCalendar, groupMacroCalendarRows } = await import(compile(fs.readFileSync('src/lib/macroCalendar.ts', 'utf8')));
const { readSnapshot } = await import(compile(fs.readFileSync('src/lib/snapshot.ts', 'utf8')
  .replace("'./scanner'", JSON.stringify(scannerUrl))
  .replace("'./ranges'", JSON.stringify(rangesUrl))));

const draft = JSON.parse(fs.readFileSync('public/data/snapshot.json', 'utf8'));
assert.equal(readSnapshot(draft).sessionDate, draft.sessionDate);
if (draft.status === 'draft') assert.equal(draft.cutoffAt, undefined);
if (draft.previousArchiveDate) {
  const previous = JSON.parse(fs.readFileSync(`public/data/snapshot-${draft.previousArchiveDate}.json`, 'utf8'));
  assert.equal(previous.sessionDate, draft.previousArchiveDate);
  assert.ok(previous.sessionDate < draft.sessionDate);
}
// A draft may be partially populated before its final capture. Validate provenance
// for values that are present instead of assuming that every draft stays blank.
assert.ok(draft.marketContext.every(row => row.value === null || (row.asOf && row.source && row.retrievedAt)));
assert.ok(draft.treasuryYields.every(row => row.value === null || (row.asOf && row.source && row.retrievedAt)));
assert.ok(draft.indexQuotes.every(row => row.value === null || (row.asOf && row.source && row.retrievedAt)));
assert.ok(draft.keyLevels.every(row => row.high === null || (row.low !== null && row.asOf && row.highTime && row.lowTime && row.source && row.retrievedAt)));
assert.deepEqual(Object.keys(draft.briefing).sort(), ['bonds', 'earnings', 'indices', 'macro', 'news']);
const normalizedMacro = normalizeMacroCalendar(draft.briefing.macro, draft.sessionDate);
assert.deepEqual(normalizedMacro.map(row => row.sortKey), [...normalizedMacro.map(row => row.sortKey)].sort((a, b) => a - b));
assert.ok(normalizedMacro.every(row => row.time === '—' || row.sortKey % 86400000 < 16 * 60 * 60 * 1000));
const agendaRows = normalizeMacroCalendar([
  { title: 'Wednesday, October 14, 2026', body: '10:00 a.m. ET — Later event\n8:30 a.m. ET — Earlier event', source: 'Calendar', url: 'https://example.com/calendar' },
  { title: 'Thursday, October 15, 2026', body: '8:30 a.m. ET — Next day event', source: 'Calendar', url: 'https://example.com/calendar' },
], '2026-10-13');
const agendaGroups = groupMacroCalendarRows(agendaRows, '2026-10-13');
assert.deepEqual(agendaGroups.map(group => [group.heading, group.relative]), [['Wednesday, Oct 14', 'Tomorrow'], ['Thursday, Oct 15', null]]);
assert.deepEqual(agendaGroups[0].rows.map(row => row.event), ['Earlier event', 'Later event']);
const withAfterClose = normalizeMacroCalendar([...draft.briefing.macro, {
  title: 'Thursday, October 15', body: '7:00 p.m. ET — FED · after-close event',
  source: 'Desk calendar', url: 'https://example.com/calendar',
}], draft.sessionDate);
assert.equal(withAfterClose.length, normalizedMacro.length);
for (const note of draft.briefing.macro) {
  assert.ok(note.url.startsWith('https://'));
  assert.ok((note.relatedSources ?? []).every(source => source.url.startsWith('https://')));
}
assert.ok(!normalizedMacro.some(row => /after-close event/i.test(row.event)));
const oct8Archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-08.json', 'utf8'));
assert.equal(readSnapshot(oct8Archive).status, 'archived');
assert.equal(oct8Archive.sessionDate, '2026-10-08');
assert.equal(oct8Archive.marketContext.find(row => row.id === 'SPY').value, 774.98);
const oct7Archive = JSON.parse(fs.readFileSync('public/data/snapshot-2026-10-07.json', 'utf8'));
assert.equal(readSnapshot(oct7Archive).status, 'archived');
assert.equal(oct7Archive.sessionDate, '2026-10-07');
assert.equal(oct7Archive.previousArchiveDate, '2026-10-06');
assert.equal(oct7Archive.marketContext.find(row => row.id === 'SPY').value, 775.9632);

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

