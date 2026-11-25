// Runs everything that must pass before a push:  node service/test/run-all.mjs   (or: npm test, from service/)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ['settings are consistent', ['node', path.join(here, '..', 'tools', 'check-consistency.mjs')]],
  ['the Worker builds (dry run, nothing is deployed)', ['npx', 'wrangler', 'deploy', '--dry-run', '--outdir', '.wrangler/dry-run']],
  ['API tests', ['node', path.join(here, 'api.test.mjs')]],
  ['browser tests', ['node', path.join(here, 'site.test.mjs')]],
  ['worked example: a card turned into a new-standard product', ['node', path.join(here, 'card-recipe.test.mjs')]],
];
let failed = 0;
for (const [name, cmd] of steps) {
  console.log('\n######## ' + name);
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: path.join(here, '..'), stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });
  if (r.status !== 0) { failed++; console.log('######## FAILED: ' + name); }
}
console.log(failed ? '\n' + failed + ' step(s) failed.' : '\nAll steps passed.');
process.exit(failed ? 1 : 0);
