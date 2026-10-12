import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import postcss from 'postcss';

const declarations = new Set();
const paths = new Set();
function visit(path) {
  if (paths.has(path)) return;
  paths.add(path);
  const root = postcss.parse(readFileSync(path, 'utf8'));
  root.walkAtRules('import', rule => {
    const match = rule.params.match(/^['"](\.[^'"]+)['"]$/);
    if (!match) return;
    const child = relative(process.cwd(), resolve(dirname(path), match[1]));
    if (child.startsWith('src/')) visit(child);
  });
  if (path === 'src/globals.css' && root.nodes.some(node => node.type !== 'comment' && !(node.type === 'atrule' && node.name === 'import'))) {
    throw new Error('globals.css is an import manifest; put authored styles with their documented owner');
  }
}
visit('src/globals.css');
visit('src/features/connections/MassiveConnectionTest.css');
for (const path of paths) {
  const css = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const literalTextColors = css.match(/(?:^|[;{])\s*color\s*:\s*#[\da-f]{3,8}\b/gim);
  if (literalTextColors) throw new Error(`${path} contains hard-coded text colors: ${literalTextColors.join(', ')}`);
  const root = postcss.parse(css, { from: path });
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

