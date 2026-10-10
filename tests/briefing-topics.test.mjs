import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await import('node:fs/promises').then(fs => fs.readFile('src/lib/briefingTopics.ts', 'utf8'));
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
const { BRIEFING_TOPICS, DEFAULT_BRIEFING_TOPICS, visibleBriefingSectionKeys, saveBriefingTopics, readBriefingTopics } = await import(moduleUrl);

assert.deepEqual(BRIEFING_TOPICS.map(topic => topic.label), ['Equities', 'Bonds', 'Energy', 'Macro Events', 'Earnings', 'Overnight News']);
assert.deepEqual(visibleBriefingSectionKeys({ equities: true, bonds: false, energy: false, macro: true, earnings: false, news: true }), ['indices', 'keyLevels', 'macro', 'news']);
assert.deepEqual(visibleBriefingSectionKeys({ equities: false, bonds: true, energy: false, macro: false, earnings: true, news: false }), ['indices', 'bonds', 'earnings']);
assert.deepEqual(visibleBriefingSectionKeys({ equities: false, bonds: false, energy: false, macro: false, earnings: false, news: false }), []);

const stored = new Map();
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
assert.equal(readBriefingTopics(), null);
saveBriefingTopics(DEFAULT_BRIEFING_TOPICS);
assert.deepEqual(readBriefingTopics(), DEFAULT_BRIEFING_TOPICS);
stored.delete('warren-briefing-topics-v2');
stored.set('warren-briefing-topics-v1', JSON.stringify({ equities: false, bonds: true, energy: false, macro: true, earnings: false }));
assert.deepEqual(readBriefingTopics(), { equities: false, bonds: true, energy: false, macro: true, earnings: false, news: true });
console.log('PASS: topic selection maps to visible sections and persists as expected.');
