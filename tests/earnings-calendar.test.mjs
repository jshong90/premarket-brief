import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/earningsCalendar.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
const { EARNINGS_MARKET_CAP_FLOOR, isEligibleEarningsCompany, eligibleEarningsSessions, hasStructuredEarnings } = await import(moduleUrl);

const company = (marketCap, overrides = {}) => ({
  ticker: 'ABC', name: 'Example Corp', marketCap, marketCapAsOf: '2026-10-09',
  marketCapSource: 'StockAnalysis · market capitalization',
  marketCapUrl: 'https://stockanalysis.com/stocks/abc/market-cap/',
  ...overrides,
});
assert.equal(EARNINGS_MARKET_CAP_FLOOR, 25_000_000_000);
assert.equal(isEligibleEarningsCompany(company(25_000_000_001)), true);
assert.equal(isEligibleEarningsCompany(company(25_000_000_000)), false);
assert.equal(isEligibleEarningsCompany(company(null)), false);
assert.equal(isEligibleEarningsCompany(company(30_000_000_000, { marketCapAsOf: null })), false);

const notes = [{ title: 'Tuesday, October 13', body: '', source: 'Earnings Whispers', url: 'https://example.com', sessions: [
  { period: 'Before Open', companies: [company(30_000_000_000), company(20_000_000_000, { ticker: 'XYZ' })] },
  { period: 'After Close', companies: [company(25_000_000_000, { ticker: 'DEF' })] },
] }];
assert.equal(hasStructuredEarnings(notes), true);
assert.deepEqual(eligibleEarningsSessions(notes[0]).map(session => session.companies.map(row => row.ticker)), [['ABC']]);
assert.equal(hasStructuredEarnings([{ title: 'Legacy', body: 'Old format', source: 'Earnings Whispers', url: 'https://example.com' }]), false);

const packet = JSON.parse(fs.readFileSync('public/data/snapshot.json', 'utf8'));
const entries = packet.briefing.earnings.flatMap(day => (day.sessions ?? []).flatMap(session => session.companies));
// A draft may have no earnings until its calendar is collected.
assert.ok(entries.every(row => row.marketCap > EARNINGS_MARKET_CAP_FLOOR && typeof row.marketCapAsOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.marketCapAsOf) && row.marketCapUrl.startsWith('https://')));
assert.ok(packet.briefing.earnings.every(day => /^https:\/\/(www\.)?earningswhispers\.com\//.test(day.url)));
console.log('PASS: earnings screen enforces a strict $25B market-cap floor and requires dated, sourced company-cap data.');

