import { readFileSync } from 'node:fs';

for (const path of ['src/globals.css', 'src/MassiveConnectionTest.css']) {
  const css = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const literalTextColors = css.match(/(?:^|[;{])\s*color\s*:\s*#[\da-f]{3,8}\b/gim);
  if (literalTextColors) throw new Error(`${path} contains hard-coded text colors: ${literalTextColors.join(', ')}`);
}

console.log('PASS: text color declarations use semantic tokens.');
