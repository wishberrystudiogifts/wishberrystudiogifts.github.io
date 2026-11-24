// The few HTML pages the service itself shows (the owner sees them while connecting the shop).
import { settings } from './settings.js';

export const ETSY_NOTICE = "The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.";

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#FBF7EE;color:#2A2620;font:18px/1.55 'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
main{max-width:34em;margin:0 auto;padding:36px 20px 48px}
h1{font:600 28px/1.2 Georgia,'Times New Roman',serif;color:#1F3326;margin:0 0 14px}
p{margin:0 0 14px}
.ok{color:#2E6B3A;font-weight:700}
.bad{color:#9B1C1C;font-weight:700}
code{background:#F1ECE0;padding:2px 6px;border-radius:6px;font-size:16px;word-break:break-all}
.note{font-size:16px;color:#6B6157;border-top:2px solid #EADFCB;margin-top:26px;padding-top:14px}
a{color:#1F3326}
</style>
</head>
<body><main>
${bodyHtml}
<p class="note">${esc(ETSY_NOTICE)}</p>
</main></body></html>`;
}

export function html(status, title, bodyHtml) {
  return new Response(page(title, bodyHtml), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' },
  });
}

export function homePage(env) {
  const cfg = settings(env);
  return html(200, 'Wishberry product link service', `
<h1>Wishberry Studio Gifts</h1>
<p>This address is a small helper for our shop. It checks an Etsy order number and opens the buyer&rsquo;s personal page for the card or invitation they bought.</p>
<p>There is nothing to see here. If you bought one of our cards, open the link in your <b>01 START HERE</b> file.</p>
<p><a href="${esc(cfg.shopUrl)}">Visit our shop on Etsy</a></p>`);
}

export function connectError(code, extra) {
  const msgs = {
    no_api_key: ['Ključevi nisu podešeni', 'Servis nema tajne <code>ETSY_KEYSTRING</code> i <code>ETSY_SHARED_SECRET</code>. Upisuju se u Cloudflare → Worker product-link → Settings → Variables and Secrets.'],
    already_connected: ['Radnja je već povezana', 'Servis je već povezan sa radnjom' + (extra ? ' <b>' + esc(extra) + '</b>' : '') + '. Ništa više ne treba. (Ponovno povezivanje: uputstvo je u <code>service/README.md</code>, odeljak „Etsy — ponovno povezivanje“.)'],
    denied: ['Povezivanje nije odobreno', 'Na Etsy stranici nije kliknuto „Allow“ (Etsy je vratio: <code>' + esc(extra) + '</code>). Otvori ponovo <code>/etsy/connect</code> kad budeš spreman.'],
    bad_request: ['Neispravan zahtev', 'Ova adresa se otvara samo povratkom sa Etsy-ja. Kreni od <code>/etsy/connect</code>.'],
    state: ['Zahtev je istekao', 'Od otvaranja <code>/etsy/connect</code> prošlo je više od 15 minuta ili je ova stranica već jednom iskorišćena. Otvori <code>/etsy/connect</code> ponovo.'],
    token_network: ['Etsy trenutno ne odgovara', 'Zamena koda za pristup nije uspela (mreža). Pokušaj ponovo za nekoliko minuta — otvori <code>/etsy/connect</code>.'],
    token: ['Etsy je odbio povezivanje', 'Etsy nije izdao pristup (HTTP ' + esc(extra) + '). Najčešći uzrok: callback adresa u Etsy aplikaciji nije ista kao ova adresa servisa + <code>/etsy/callback</code>, ili ključevi u Cloudflare-u nisu tačni.'],
    shop_unknown: ['Radnja nije prepoznata', 'Etsy nije vratio broj radnje za ovaj nalog.'],
    shop_network: ['Etsy trenutno ne odgovara', 'Provera radnje nije uspela (mreža). Pokušaj ponovo — otvori <code>/etsy/connect</code>.'],
    shop_lookup: ['Provera radnje nije uspela', 'Etsy nije vratio podatke o radnji (HTTP ' + esc(extra) + '). Ništa nije sačuvano. Javi Claude-u ovu poruku.'],
    wrong_shop: ['Ovo nije naša radnja', 'Nalog koji je kliknuo „Allow“ nije vlasnik radnje iz podešavanja servisa. Ništa nije sačuvano.'],
  };
  const m = msgs[code] || ['Greška', 'Nepoznata greška: <code>' + esc(code) + '</code>'];
  const status = code === 'already_connected' ? 200 : 400;
  return html(status, m[0], `<h1>${m[0]}</h1><p class="${code === 'already_connected' ? 'ok' : 'bad'}">${m[1]}</p>`);
}

export function connectDone(shop) {
  return html(200, 'Povezano', `
<h1>Povezano &#10003;</h1>
<p class="ok">Servis je povezan sa radnjom <b>${esc(shop)}</b>.</p>
<p>Od sada servis broj porudžbine proverava kod Etsy-ja (samo čitanje, jedan zahtev po kupcu). Ovu stranicu možeš da zatvoriš.</p>`);
}
