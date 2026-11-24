// A tiny static server that behaves like GitHub Pages — for LOCAL TESTS of the site.
//   node service/tools/pages-server.mjs [--port=8080] [--root=<folder>] [--keys=http://127.0.0.1:8787]
//
// * a folder address serves its index.html
// * an address without a file gets the root 404.html with status 404 — this is how /<hash> reaches the router
// * --keys=<service address>: /shared/keys.js is answered with the public key of that (local) service, the way the
//   live site carries the live key in shared/keys.js. Guests then need no service at all — as in production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)=?(.*)$/.exec(a); return m ? [m[1], m[2] || true] : [a, true]; }));
const port = Number(args.port || 8080);
const root = path.resolve(args.root || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.ico': 'image/x-icon' };

let keysJs = null;
if (args.keys && args.keys !== true) {
  const res = await fetch(String(args.keys).replace(/\/+$/, '') + '/api/pubkey');
  const j = await res.json();
  keysJs = '/* local test key from ' + args.keys + ' */\nwindow.WB_KEYS = ' + JSON.stringify(j.keys.map((k) => k.key)) + ';\n';
}

function send(res, status, file) {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (keysJs && pathname === '/shared/keys.js') { res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' }); res.end(keysJs); return; }
  let file = path.join(root, pathname);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const st = fs.statSync(file);
    if (st.isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }); res.end(); return; } // as GitHub Pages does
      file = path.join(file, 'index.html');
      fs.statSync(file);
    }
    send(res, 200, file);
  } catch (e) {
    const nf = path.join(root, '404.html');
    if (fs.existsSync(nf)) send(res, 404, nf); else { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not Found'); }
  }
}).listen(port, '127.0.0.1', () => console.log('pages-server: ' + root + ' on http://127.0.0.1:' + port + (keysJs ? ' (keys from ' + args.keys + ')' : '')));
