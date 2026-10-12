import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const output = ts.transpileModule(fs.readFileSync('src/lib/macroCalendar.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { normalizeMacroCalendar, groupMacroCalendarRows } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const undated = [{ title: 'Fed speakers', body: 'Speaker timing unconfirmed.', source: '', url: '', sourceKey: 'federalReserveBoard' }];
const rows = normalizeMacroCalendar(undated, '2026-10-12');
assert.equal(rows[0].date, 'Fed speakers');
assert.equal(rows[0].time, '—');
assert.equal(rows[0].sources[0].url, 'https://www.federalreserve.gov/newsevents/2026-october.htm');
assert.equal(groupMacroCalendarRows(rows, '2026-10-12')[0].relative, null);
const dated = normalizeMacroCalendar([{ ...undated[0], title: 'Monday, November 2, 2026', body: '10:00 a.m. ET — Test event' }], '2026-10-12');
assert.equal(dated[0].sources[0].url, 'https://www.federalreserve.gov/newsevents/2026-november.htm');
assert.equal(dated[0].time, '10:00 a.m.');
console.log('PASS: undated macro titles remain renderable without invented event dates; dated source months remain correct.');
