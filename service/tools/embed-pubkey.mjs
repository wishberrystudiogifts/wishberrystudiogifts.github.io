// Copies the PUBLIC key of the running service into shared/keys.js, so that guests' pages can check invitation links
// without ever calling the service. Run once, right after the service first runs in production (and again only if the
// service ever gets a new key):
//   node service/tools/embed-pubkey.mjs                 -> reads the address from shared/config.js
//   node service/tools/embed-pubkey.mjs https://…       -> another address (for example a preview)
//   node service/tools/embed-pubkey.mjs --key <key>     -> the key itself, when this computer cannot reach the service
// A key already in the file is kept: invitations signed with an older key must keep opening. Then commit shared/keys.js.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const keysFile = path.join(REPO, 'shared', 'keys.js');

function loadWindowFile(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  return sandbox.window[name];
}

const cfg = loadWindowFile(path.join(REPO, 'shared', 'config.js'), 'WB_CONFIG');
const KEY_RE = /^[A-Za-z0-9_-]{80,100}$/;
const args = process.argv.slice(2);
let fresh = [];
let base = '(typed in by hand)';
const at = args.indexOf('--key');
if (at >= 0) {
  // the key was read some other way (for example by opening <service address>/api/pubkey in a browser)
  fresh = args.slice(at + 1).filter((k) => KEY_RE.test(k));
  if (!fresh.length) { console.error('After --key give the key itself: the value of "key" from /api/pubkey (87 characters).'); process.exit(1); }
} else {
  base = String(args[0] || cfg.serviceUrl).replace(/\/+$/, '');
  let res;
  try { res = await fetch(base + '/api/pubkey'); } catch (e) {
    console.error('Could not reach ' + base + '/api/pubkey from this computer (' + (e && e.message) + ').');
    console.error('Open that address in a browser, copy the value of "key", and run:  node service/tools/embed-pubkey.mjs --key <the key>');
    process.exit(1);
  }
  if (!res.ok) { console.error('The service did not answer: HTTP ' + res.status + ' from ' + base + '/api/pubkey'); process.exit(1); }
  const body = await res.json();
  fresh = (body.keys || []).map((k) => k.key).filter((k) => typeof k === 'string' && KEY_RE.test(k));
  if (!fresh.length) { console.error('No key in the answer.'); process.exit(1); }
}

const have = loadWindowFile(keysFile, 'WB_KEYS') || [];
const all = [...have];
for (const k of fresh) if (!all.includes(k)) all.push(k);

const text = fs.readFileSync(keysFile, 'utf8');
const head = text.slice(0, text.indexOf('window.WB_KEYS'));
const lines = all.map((k) => "  '" + k + "'").join(',\n');
fs.writeFileSync(keysFile, head + 'window.WB_KEYS = [\n' + lines + '\n];\n');
console.log('shared/keys.js now holds ' + all.length + ' key(s) (' + (all.length - have.length) + ' new) from ' + base);
console.log('Next: commit shared/keys.js and push it with the site.');
