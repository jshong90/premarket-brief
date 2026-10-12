import fs from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

// Use the application's validator and time rules; do not maintain a second model.
const root = fileURLToPath(new URL('../../', import.meta.url));
const compiled = new Map();
async function moduleUrl(name) {
  if (compiled.has(name)) return compiled.get(name);
  let source = fs.readFileSync(`${root}src/lib/${name}.ts`, 'utf8');
  for (const dependency of ['scanner', 'ranges']) {
    if (source.includes(`'./${dependency}'`)) source = source.replaceAll(`'./${dependency}'`, JSON.stringify(await moduleUrl(dependency)));
  }
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
  compiled.set(name, url);
  return url;
}
export const { readSnapshot } = await import(await moduleUrl('snapshot'));
export const { windows, easternTime } = await import(await moduleUrl('ranges'));
export const { etParts, rangeDrawdown } = await import(await moduleUrl('scanner'));
