// Checks that the SITE settings (shared/config.js) and the SERVICE settings (service/config.json) say the same thing,
// and that every product listed for the new standard really has its files. Run before every push:
//   node service/tools/check-consistency.mjs
//   node service/tools/check-consistency.mjs --release    (before a product in mode 'hash' goes on sale: an empty
//                                                           shared/keys.js or an empty listingIds is then an ERROR)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RELEASE = process.argv.includes('--release');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function loadWindowFile(rel, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(REPO, rel), 'utf8'), sandbox, { filename: rel });
  return sandbox.window[name];
}

const site = loadWindowFile('shared/config.js', 'WB_CONFIG');
const keys = loadWindowFile('shared/keys.js', 'WB_KEYS');
const svc = JSON.parse(fs.readFileSync(path.join(REPO, 'service', 'config.json'), 'utf8'));
const wranglerText = fs.readFileSync(path.join(REPO, 'service', 'wrangler.jsonc'), 'utf8');

if (!site || !site.products) err('shared/config.js: window.WB_CONFIG.products is missing');
if (!/^https:\/\/[a-z0-9.-]+$/.test(site.serviceUrl || '')) err('shared/config.js: serviceUrl must be an https address without a trailing slash');
if (!/"name":\s*"product-link"/.test(wranglerText)) err('service/wrangler.jsonc: name must be "product-link" (Workers Builds fails otherwise)');
if (!(svc.allowedOrigins || []).includes(svc.site)) err('service/config.json: allowedOrigins must contain the site address');

const d = svc.defaults || {};
const sl = site.limits || {};
if (Number(sl.ttlHours) !== Number(d.ttlHours)) err(`limits differ: shared/config.js says ttlHours ${sl.ttlHours}, service/config.json says ${d.ttlHours} — the pages would tell buyers a wrong deadline`);
if (Number(sl.maxOpens) !== Number(d.maxOpens)) err(`limits differ: shared/config.js says maxOpens ${sl.maxOpens}, service/config.json says ${d.maxOpens}`);
if (Number(sl.maxLinks || 0) !== Number(d.maxSigns || 0)) err(`limits differ: shared/config.js says maxLinks ${sl.maxLinks}, service/config.json says maxSigns ${d.maxSigns} — the terms page would tell buyers a wrong number`);
if (d.ttlStartsAt !== 'firstOpen') warn(`service/config.json: ttlStartsAt is "${d.ttlStartsAt}" — the pages say "from the first time you open it"`);

let hashProducts = 0;
for (const [key, p] of Object.entries(site.products || {})) {
  const where = `product "${key}"`;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(key)) err(`${where}: the key must be lower-case letters, digits and dashes`);
  if (p.mode !== 'hash' && p.mode !== 'direct') err(`${where}: mode must be 'hash' or 'direct'`);
  if (!/^product\/[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}$/.test(p.folder || '')) err(`${where}: folder must look like product/<occasion>-<kind>-<number>-<yyyy-mm-dd> (lower case), got "${p.folder}"`);
  if (!/^personalize-[a-z0-9]{4}\.html$/.test(p.entry || '')) err(`${where}: entry must look like personalize-<4 characters>.html, got "${p.entry}"`);
  const dir = path.join(REPO, p.folder || '');
  const entryFile = path.join(dir, p.entry || '');
  const guestFile = path.join(dir, 'index.html');
  if (!fs.existsSync(entryFile)) { err(`${where}: missing file ${p.folder}/${p.entry}`); continue; }
  if (!fs.existsSync(guestFile)) { err(`${where}: missing file ${p.folder}/index.html`); continue; }
  const entry = fs.readFileSync(entryFile, 'utf8');
  const guest = fs.readFileSync(guestFile, 'utf8');
  const q = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`ProductLink\\.entry\\(\\s*\\{\\s*product:\\s*'${q}'`).test(entry)) err(`${where}: ${p.entry} must call ProductLink.entry({ product: '${key}' }) in <head>`);
  if (!/ProductLink\.ready\(/.test(entry)) err(`${where}: ${p.entry} must run its maker code inside ProductLink.ready(function (session) { … })`);
  if (!/ProductLink\.invitationLink\(/.test(entry)) err(`${where}: ${p.entry} must build the link to send with ProductLink.invitationLink(…)`);
  if (!new RegExp(`ProductLink\\.recipientPage\\(\\s*\\{\\s*product:\\s*'${q}'`).test(guest)) err(`${where}: index.html must call ProductLink.recipientPage({ product: '${key}' }) in <head>`);
  for (const [file, text] of [[p.entry, entry], ['index.html', guest]]) {
    for (const need of ['/shared/config.js', '/shared/keys.js', '/shared/product-link.js', '/shared/product-link.css']) {
      if (!text.includes(need)) err(`${where}: ${file} must load ${need} (absolute path)`);
    }
    if (/src=["']\.\.\//.test(text) || /href=["']\.\.\//.test(text)) err(`${where}: ${file} uses a "../" path — under /<hash> it points to the wrong place; use an absolute path such as /video/videomaker.js`);
    if (/<script[^>]+src=["']https?:\/\//i.test(text)) err(`${where}: ${file} loads a script from another website — not allowed on a page that the router writes`);
  }
  if (/new URL\(\s*['"]\.\/['"]\s*,\s*location\.href\s*\)/.test(entry)) err(`${where}: ${p.entry} builds a link from location.href — under /<hash> that is the wrong folder; use ProductLink.invitationLink`);
  const engine = fs.readdirSync(dir).filter((f) => /\.js$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  if (!/ProductLink\.guard\(/.test(engine + guest)) err(`${where}: the recipient page must start through ProductLink.guard(boot) (see the end of invite.js in the LAB product)`);
  if (/window\.ProductLink\s*\?\s*window\.ProductLink\.guard\(\s*boot\s*\)\s*:\s*boot\b/.test(engine + guest)) err(`${where}: the recipient page falls back to boot() when the shared code is missing — it must stay closed instead (see the end of invite.js in the LAB product)`);
  if (p.mode === 'hash' && /\bfunction\s+inviteUrl\b|\bfunction\s+cardUrl\b/.test(entry)) warn(`${where}: ${p.entry} still has its own link-building function — make sure every link the buyer gets comes from ProductLink.invitationLink`);

  const sp = svc.products && svc.products[key];
  if (p.mode === 'hash') {
    hashProducts++;
    if (!sp) err(`${where}: mode 'hash' but the product is not in service/config.json → products`);
  }
  if (sp) {
    const pl = p.limits || {};
    for (const f of ['ttlHours', 'maxOpens']) {
      const a = pl[f] !== undefined ? pl[f] : sl[f];
      const b = sp[f] !== undefined ? sp[f] : d[f];
      if (Number(a) !== Number(b)) err(`${where}: ${f} differs — site says ${a}, service says ${b}`);
    }
    if (!sp.lab && !(sp.listingIds || []).length) (RELEASE ? err : warn)(`${where}: listingIds is empty in service/config.json — until the Etsy listing ID is filled in, ANY paid order of the shop unlocks this product`);
    if (sp.lab && p.mode === 'hash' && !/TEST COPY/.test(guest)) warn(`${where}: a lab product should mark its pages as a TEST COPY`);
  }
}
for (const key of Object.keys(svc.products || {})) {
  if (key[0] === '_') continue;
  if (!site.products[key]) warn(`service/config.json has product "${key}" that shared/config.js does not list`);
}
if (hashProducts && !(Array.isArray(keys) && keys.length)) {
  (RELEASE ? err : warn)("shared/keys.js is empty: fine before the first release; after the service first runs in production run  node service/tools/embed-pubkey.mjs  and commit the file (until then guests' pages have to ask the service for the key)");
}
for (const k of (Array.isArray(keys) ? keys : [])) {
  if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{80,100}$/.test(k)) err('shared/keys.js: an entry is not a public key (87 base64url characters expected)');
}

for (const w of warnings) console.log('note:  ' + w);
for (const e of errors) console.log('ERROR: ' + e);
console.log(errors.length ? `\n${errors.length} problem(s) — fix before pushing.` : '\nSettings are consistent.');
process.exit(errors.length ? 1 : 0);
