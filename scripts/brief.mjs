import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makePlan, collect, digest } from './pipeline/collection.mjs';
import { generateSnapshot, rolloverDraft, validatePacket } from './pipeline/snapshot.mjs';
import { readJson, writeJson, applyCandidate, replayAdapter } from './pipeline/files.mjs';
import { sourceMarkdown } from './pipeline/sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const [command, ...args] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--')) throw new Error(`Unexpected argument: ${args[i]}`);
  const key = args[i].slice(2);
  if (key in flags) throw new Error(`Duplicate option: ${key}`);
  flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
}
const required = key => { if (typeof flags[key] !== 'string') throw new Error(`--${key} is required`); return flags[key]; };
const dataDir = path.join(root, 'public/data');
const currentPath = path.join(dataDir, 'snapshot.json');
const readBase = () => readJson(flags.base ?? currentPath);
function run(binary, argv) {
  const result = spawnSync(binary, argv, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error(`${binary} ${argv.join(' ')} failed`);
}
function git(argv) {
  const result = spawnSync('git', argv, { cwd: root, encoding: 'utf8', shell: false });
  if (result.error || result.status !== 0) throw new Error(result.stderr || 'Git operation failed');
  return result.stdout.trim();
}
async function output(value) {
  const target = path.resolve(required('output'));
  if (target === dataDir || target.startsWith(`${dataDir}${path.sep}`)) throw new Error('Preparation outputs belong outside public/data; use apply to publish them');
  await writeJson(target, value);
  console.log(`Prepared ${target}`);
}

try {
  if (command === 'plan') {
    const base = await readBase();
    const cache = await readJson(flags.cache ?? '.collection/cache.json').catch(e => { if (e.code !== 'ENOENT') throw e; return {}; });
    await output(makePlan(flags.date ?? base.sessionDate, await readJson(required('calendar')), new Date().toISOString(), cache));
  } else if (command === 'collect') {
    const plan = await readJson(required('plan'));
    const cachePath = flags.cache ?? '.collection/cache.json';
    const cache = await readJson(cachePath).catch(e => { if (e.code !== 'ENOENT') throw e; return {}; });
    let adapter;
    if (flags.adapter) adapter = await import(pathToFileURL(path.resolve(required('adapter'))));
    else { const input = await readJson(required('input')); adapter = replayAdapter(input.responses ?? input); }
    if (typeof adapter.fetchBatch !== 'function') throw new Error('Adapter must export fetchBatch(provider, requests)');
    const capture = await collect(plan, adapter, { cache });
    await output(capture);
    await writeJson(cachePath, cache);
    console.log(`${Object.keys(capture.canonical).length}/${plan.requests.length} instruments returned normalized records; ${capture.timing.elapsedMs} ms since planning, ${capture.timing.processingMs} ms processing time.`);
  } else if (command === 'generate') {
    const base = await readBase();
    const capture = await readJson(required('capture'));
    const packet = generateSnapshot(base, capture, { scannerBenchmarks: flags['scanner-benchmarks'] === true });
    packet.collection.baseHash = digest(base);
    validatePacket(packet);
    await output(packet);
  } else if (command === 'rollover') {
    const base = await readBase();
    const transaction = rolloverDraft(base, required('date'), await readJson(required('calendar')));
    await output({ baseHash: digest(base), ...transaction });
  } else if (command === 'apply') {
    const candidate = await readJson(required('input'));
    await applyCandidate(dataDir, candidate, candidate.baseHash ?? candidate.collection?.baseHash);
    console.log('Candidate applied locally; dated archives preserved. Run brief:publish to validate, commit and optionally push.');
  } else if (command === 'validate') {
    const packet = await readJson(flags.input ?? currentPath);
    validatePacket(packet.draft ?? packet);
    if (packet.archive) validatePacket(packet.archive);
    console.log('Snapshot validation passed.');
  } else if (command === 'sources') {
    const document = `# Approved collection sources\n\nGenerated from scripts/pipeline/sources.mjs. Run npm run brief:sources after an intentional source change.\n\n${sourceMarkdown()}\n`;
    const file = path.join(root, 'docs/data-sources.md');
    if (flags.check) { if (await fs.readFile(file, 'utf8') !== document) throw new Error('Source documentation is out of sync'); }
    else { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, document); }
  } else if (command === 'publish') {
    validatePacket(await readBase());
    if (git(['diff', '--cached', '--name-only'])) throw new Error('Stage is not empty; finish the existing change before publishing data');
    const outsideData = [...git(['diff', '--name-only', 'HEAD']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')]
      .filter(p => p && !p.startsWith('public/data/'));
    if (outsideData.length) throw new Error('Commit code changes separately before publishing data, so validation matches the deployed code');
    // Reject edits to archives that are already in Git. New dated archives are allowed.
    const modified = git(['diff', '--name-only', 'HEAD', '--', 'public/data']).split('\n').filter(Boolean);
    if (modified.some(p => /snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(p))) throw new Error('Previously committed dated archives are immutable');
    run('npm', ['test']); run('npm', ['run', 'build']);
    const files = [...new Set([...git(['diff', '--name-only', 'HEAD', '--', 'public/data']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard', '--', 'public/data']).split('\n')])]
      .filter(p => /^public\/data\/(snapshot(?:-\d{4}-\d{2}-\d{2})?\.json|archive-index\.json)$/.test(p));
    if (!files.length) { console.log('No snapshot changes to commit.'); }
    else {
      for (const file of files.filter(p => /snapshot/.test(p))) validatePacket(await readJson(file));
      git(['add', '--', ...files]);
      git(['commit', '-m', `Publish briefing ${(await readBase()).sessionDate}`]);
      console.log(`Committed ${git(['rev-parse', '--short', 'HEAD'])}.`);
    }
    if (flags.push) run('git', ['push']);
  } else {
    console.log('Commands: plan, collect, generate, validate, apply, rollover, sources, publish. See docs/collection-workflow.md.');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
