import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('src/components/brief/numericFormat.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { formatNumeric, movementClass, formatET } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
assert.equal(formatNumeric(12345.25, 'price'), '12,345.25');
assert.equal(formatNumeric(5.237, 'yield'), '5.237%');
assert.equal(formatNumeric(0.3, 'percent'), '+0.30%');
assert.equal(formatNumeric(-0.3, 'percent'), '-0.30%');
assert.equal(formatNumeric(2.5, 'basisPoints'), '+2.5 bp');
assert.equal(formatNumeric(0, 'percent'), '0.00%');
assert.equal(formatNumeric(15.6, 'price', true), '~15.6');
assert.equal(formatNumeric(null, 'yield', true), '—');
assert.equal(formatNumeric(undefined, 'price'), '—');
assert.equal(movementClass(2.5, 'standard'), 'positive');
assert.equal(movementClass(2.5, 'inverse'), 'negative');
assert.equal(movementClass(-2.5, 'inverse'), 'positive');
assert.equal(movementClass(null, 'standard'), '');
assert.equal(movementClass(0, 'inverse'), '');
assert.equal(formatET('2026-10-12T13:19:00Z'), '9:19 AM');
assert.equal(formatET('2026-12-01T14:19:00Z'), '9:19 AM');
assert.equal(formatET(null), null);
console.log('PASS: numeric roles preserve units, precision, approximation, zero/missing values, yield direction and ET/DST timestamps.');
