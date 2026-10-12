import { readFileSync } from 'node:fs';
import postcss from 'postcss';

for (const path of ['src/globals.css', 'src/features/connections/MassiveConnectionTest.css']) {
  const css = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const literalTextColors = css.match(/(?:^|[;{])\s*color\s*:\s*#[\da-f]{3,8}\b/gim);
  if (literalTextColors) throw new Error(`${path} contains hard-coded text colors: ${literalTextColors.join(', ')}`);
  const root = postcss.parse(css, { from: path });
  const declarations = new Set();
  root.walkRules(rule => {
    if (!rule.selector.trim()) throw new Error(`${path} contains an empty selector`);
    const context = [];
    for (let parent = rule.parent; parent && parent !== root; parent = parent.parent) {
      context.unshift(`@${parent.name} ${parent.params}`);
    }
    if (context.some(item => /keyframes/.test(item))) return;
    for (const selector of rule.selectors) {
      rule.walkDecls(declaration => {
        const key = `${context.join('|')}|${selector}|${declaration.prop}`;
        if (declarations.has(key)) throw new Error(`${path}: repeated declaration ${key}; edit the existing role instead of appending a patch`);
        declarations.add(key);
        const reducedMotion = context.some(item => /prefers-reduced-motion\s*:\s*reduce/.test(item)) || selector.includes('data-dev-reduced-motion');
        if (declaration.important && !reducedMotion) throw new Error(`${path}: !important is reserved for reduced-motion safeguards (${selector})`);
        if (['font', 'font-family'].includes(declaration.prop) && /Source Sans 3|Newsreader/.test(declaration.value)) throw new Error(`${path}: use the shared font tokens (${selector})`);
      });
    }
  });
}

console.log('PASS: semantic text/font roles, unique selector declarations, and accessibility-only priority safeguards.');

