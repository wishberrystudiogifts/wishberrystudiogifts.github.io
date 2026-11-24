# Product link — servis i sajt (novi standard od 26. nov 2026)

Stanje ovog uputstva: 24. nov 2026. Sve ovde je ispitano **lokalno** (servis u `wrangler dev`, sajt na lokalnom serveru
koji se ponaša kao GitHub Pages, pravi pregledač). **Nije ispitano uživo**: Cloudflare (produkcija i preview) i pravi Etsy
API. Šta tačno nije ispitano piše u odeljku 13.

Reči koje se koriste svuda:

- **product link** — link koji dobija KUPAC: `https://wishberrystudiogifts.github.io/<heš>` (22 znaka). Njegova lična stranica za pravljenje.
- **invitation link** — link koji kupac ŠALJE gostima: `https://wishberrystudiogifts.github.io/product/<folder>/#m=<podaci>&s=<potpis>`.
- **ulazna adresa** — jedna stalna adresa proizvoda koja piše u START HERE PDF-u: `…/product/<folder>/personalize-<4 znaka>.html`.

---

## 1. Kako radi (režim „hash“)

1. Kupac iz START HERE PDF-a otvara **ulaznu adresu**. Vidi jedno polje: „Etsy order number“ i jedno dugme.
2. Stranica šalje broj servisu (`POST /api/activate`). Servis pita Etsy da li je to plaćena porudžbina naše radnje sa tim
   proizvodom (jedan zahtev, odgovor se pamti) i vraća **heš** — isti broj porudžbine uvek daje isti heš.
3. Pregledač prelazi na `/<heš>`. Takav fajl ne postoji, pa GitHub Pages prikazuje `404.html` — naš **usmerivač**. On pita
   servis (`POST /api/open/<heš>`): servis u jednoj naredbi proveri rok i brojač i upiše otvaranje.
4. Ako je sve u redu, usmerivač u istu adresu učita stranicu za pravljenje. Na vrhu piše:
   „Your personal link works until <vreme> · opened X of 300“.
5. Kad kupac napravi pozivnicu/čestitku, stranica traži od servisa **potpis** (`POST /api/sign`). Servisu ide samo otisak
   podataka (SHA-256), nikad tekst. Potpis se dobija samo dok product link važi.
6. Gost otvara invitation link. Stranica primaoca proverava potpis **javnim ključem koji je u samom sajtu**
   (`shared/keys.js`) — bez servisa. Zato pozivnice poslate pre isteka rade i posle isteka, i kad servis ne radi.

Ograničenja (Nikolina pravila, 23. nov): **24 sata od PRVOG otvaranja** i **najviše 300 otvaranja**. Posle toga
`/<heš>` prikazuje „This link has expired“. Ista porudžbina nikad ne dobija nov rok.

## 2. Dva režima — ista stranica, jedna linija

| | `mode: 'hash'` (novi standard) | `mode: 'direct'` (rezerva = stari tok) |
|---|---|---|
| Ulazna adresa | traži broj porudžbine | odmah otvara stranicu za pravljenje |
| Rok i brojač | 30 dana od prvog otvaranja, 300 otvaranja, najviše 100 linkova (Nikola, 24. nov u 23:03) | nema |
| Invitation link | potpisan (`&s=…`), stranica primaoca proverava | bez potpisa, sve se prikazuje |
| Servis | potreban kupcu (ne gostu) | **ne zove se nijednom** |

**Koja linija menja režim:** u `shared/config.js`, kod proizvoda, linija `mode: 'hash',   // <-- THE SWITCH`.
Ništa drugo se ne menja — ni fajlovi, ni ulazna adresa, ni PDF.

Važno: **režim se bira PRE prve prodaje.**

- `hash` → `direct` može u svakom trenutku: već poslati potpisani linkovi nastavljaju da rade.
- `direct` → `hash` posle prodaje NE: linkovi poslati u „direct“ periodu nemaju potpis i prestali bi da se otvaraju.

Objavljeni stari proizvodi (Božić, Rođendan, Božićni poklon, Božićna žurka) **nisu** u `shared/config.js` i nisu dirani.

## 3. Šta je već podešeno (ne menjati)

- Cloudflare (besplatan plan): Worker **product-link** → `https://product-link.wishberrystudiogifts.workers.dev`,
  baza D1 **product-link-db** (`9261c19a-3f8b-4b77-891e-0b39074a5a4c`), Workers Builds vezan za GitHub repozitorijum
  `wishberrystudiogifts/wishberrystudiogifts.github.io`: grana `main` → `npx wrangler deploy` (produkcija), ostale grane →
  `npx wrangler preview` (preview), root `/service`, prati `service/*`.
- Tajne Worker-a (Production i Previews), uneo Nikola: `ETSY_KEYSTRING`, `ETSY_SHARED_SECRET`. **Nikad u repozitorijum.**
- Etsy aplikacija „Wishberry Order Check“ (Seller App, odobrena 23. nov). Callback adresa i „Allow“ — odeljak 9.
- Preview ove grane (kad stigne na GitHub): `https://product-link-hash-product-link.wishberrystudiogifts.workers.dev`.
  Preview koristi istu bazu, ali **svoje tabele** (prefiks `pv_`), svoje ključeve i nikad ne zove Etsy (`VERIFIER=mock`).
- Tabele u bazi servis pravi sam pri prvom zahtevu. Ključeve (HASH_KEY i ključ za potpis) pravi sam i čuva u D1.
  Niko ih ne kuca. **Nikad ne brisati** redove `hash_key` i `sign_key_1` iz tabele `kv` — svi linkovi bi prestali da važe.

## 4. Mapa fajlova

```
404.html                         usmerivač: /<heš> -> servis -> stranica kupca; ostalo -> „Page not found“
shared/config.js                 podešavanja SAJTA: adresa servisa, tekst o ograničenjima, proizvodi i REŽIM
shared/keys.js                   javni ključ(evi) za proveru potpisa (puni se jednom, posle prvog puštanja)
shared/product-link.js           sav zajednički kod (ProductLink.*)
shared/product-link.css          izgled forme, poruka i statusne trake
shared/terms.html                uslovi i privatnost (link na formi)
product/lab-party-1-2026-11-24/  LAB: probni proizvod (kopija Božićne žurke od 24. nov, pre izmene u 10:20) — primer za pozivnicu
service/config.json              podešavanja SERVISA: ograničenja, proizvodi -> Etsy listing ID, probne porudžbine
service/wrangler.jsonc           Cloudflare: ime, baza, dnevno čišćenje, preview
service/src/                     index.js (adrese), links.js (aktivacija, otvaranje, potpis), etsy.js (Etsy API),
                                 verifiers.js (Etsy / probni), db.js (tabele, ključevi), crypto.js, settings.js, pages.js
service/tools/check-consistency.mjs   provera da sajt i servis govore isto + da su stranice proizvoda ispravno vezane
service/tools/embed-pubkey.mjs        prepisuje javni ključ servisa u shared/keys.js
service/tools/pages-server.mjs        lokalni „GitHub Pages“ za ispitivanje
service/test/                    api.test.mjs · site.test.mjs · card-recipe.test.mjs (primer za ČESTITKU) · run-all.mjs
```

---

## 5. KAKO NOV PROIZVOD ULAZI U SISTEM (korak po korak)

Dva gotova primera:

- **Pozivnica:** `product/lab-party-1-2026-11-24/` u ovom repozitorijumu. Šta je promenjeno u odnosu na staru stranicu vidi se
  komandom `diff christmas-party/personalize-p8x5.html product/lab-party-1-2026-11-24/personalize-l4b7.html`.
- **Čestitka:** `service/test/card-recipe.test.mjs`, funkcija `convertCard()` — ista pretvorba urađena programom nad
  kopijom objavljene Božićne čestitke, red po red „pre → posle“, sa proverom u pregledaču (uključujući „Make it a video“).

Primer u koracima ispod: Božić 2 = ključ `christmas-card-2`, folder `product/christmas-card-2-2026-11-24/`.

### Korak 1 — folder
`product/<prilika>-<vrsta>-<broj>-<datum nastanka>/`, mala slova, npr. `product/christmas-card-2-2026-11-24/`. U njemu:

| Fajl | Šta je |
|---|---|
| `index.html` | stranica PRIMAOCA (otvara invitation link) |
| `personalize-<4 nasumična znaka>.html` | stranica KUPCA = **ulazna adresa** (mala slova i cifre, npr. `personalize-q7m3.html`) |
| `card.js` / `invite.js`, `.css`, `assets/` | motor i slike proizvoda (sopstvena kopija u folderu, relativne putanje ostaju) |

Zajednički kod se NE kopira — učitava se iz `/shared/`.

### Korak 2 — proizvod u OBA podešavanja (isti ključ)

`shared/config.js` → `products`:
```js
'christmas-card-2': {
  mode: 'hash',   // <-- THE SWITCH for this product: 'hash' or 'direct'
  folder: 'product/christmas-card-2-2026-11-24',
  entry: 'personalize-q7m3.html',
  name: 'Christmas Card — Snowy Cabin',   // piše na formi za broj porudžbine
  kind: 'card',                           // 'card' ili 'invitation' (reč u koracima na formi)
  allowBare: true                         // samo ako gola adresa foldera treba da prikaže uzorak bez ličnih reči
},
```
`service/config.json` → `products` (i jedna probna porudžbina u `mock.orders`):
```json
"christmas-card-2": { "name": "Christmas Card 2 - Snowy Cabin", "listingIds": [] }
```
```json
"1000000201": { "status": "paid", "products": ["christmas-card-2"] }
```
- `listingIds` = Etsy ID listinga (broj). To je broj u adresi stranice za uređivanje listinga i u adresi objavljenog listinga
  (`etsy.com/listing/<broj>/…`). Upisati čim listing postoji. **Dok je prazno, proizvod otključava BILO koja plaćena
  porudžbina naše radnje** (da prvi kupac ne bude odbijen ako ID kasni) — `/api/status` to prijavljuje u `attention`.
- Probna porudžbina radi **samo lokalno i na preview-u**. Na živom servisu probni broj nikad ne otvara pravi proizvod.

### Korak 3 — stranica primaoca (`index.html`)
U `<head>`, posle sopstvenog stila stranice:
```html
<link rel="stylesheet" href="/shared/product-link.css?v=20261124">
<script src="/shared/config.js?v=20261124"></script>
<script src="/shared/keys.js?v=20261124"></script>
<script src="/shared/product-link.js?v=20261124"></script>
<script>ProductLink.recipientPage({ product: 'christmas-card-2' });</script>
```
`og:url` i `og:image` → adresa novog foldera. Na kraju motora (`card.js` / `invite.js`) stranica se pokreće kroz čuvara:

```js
// PRE
window.addEventListener('hashchange', boot);
boot();
// POSLE
var start = window.ProductLink ? window.ProductLink.guard(boot)
  : function () { document.body.textContent = 'This page could not load completely. Please reload it.'; };
window.addEventListener('hashchange', start);
start();
```
Čuvar u režimu „hash“ pušta samo ispravno potpisan link (ili pregled unutar kupčeve stranice); u „direct“ pušta sve.
Ako zajednički kod nije učitan, stranica ostaje zatvorena — nikad se ne otvara „za svaki slučaj“.

### Korak 4 — stranica kupca (`personalize-xxxx.html`)
1. Na kraj `<head>`: ista četiri reda iz koraka 3, a peti je `<script>ProductLink.entry({ product: 'christmas-card-2' });</script>`.
2. Ceo kod stranice se umota: umesto `(function () { … })();` piše **`ProductLink.ready(function (session) { … });`**.
   (U režimu „hash“ kod se izvršava tek kad je stranica otvorena kroz `/<heš>`.)
3. Link koji kupac šalje pravi **samo** `ProductLink.invitationLink(podaci)` — vraća obećanje (Promise):
```js
// PRE
var link = cardUrl();            // ili inviteUrl(): new URL('./', location.href) …
// POSLE  (funkcija cardUrl / inviteUrl se briše)
$('linkerr').hidden = true;
ProductLink.invitationLink(C.encode(data())).then(showLink, function (err) {
  $('linkerr').textContent = ProductLink.linkErrorText(err); $('linkerr').hidden = false;
});
// showLink(link) = dosadašnji nastavak: upis u polje, WhatsApp, mejl, prikaz kutije
```
   U HTML dodati mesto za poruku: `<p id="linkerr" role="alert" hidden></p>` i rečenicu uz link:
   „Send this link — not the address of the page you are on. That one is your personal page.“
4. **Nijedna putanja sa `../`** (pod `/<heš>` pokazuje na pogrešno mesto). Putanje unutar foldera ostaju relativne
   (`index.html#…`, `assets/…`) — usmerivač dodaje `<base>` na folder proizvoda. Sve van foldera ide apsolutno, od `/`.
5. **„Make it a video“:** `<script src="/video/videomaker.js"></script>` i u pozivu `root: '/video/'` (ne `../video/`).
   Šablon i osnovni video novog proizvoda prave se kao i do sada (PIPELINE, odeljak o videu).
6. Ključ nacrta u `localStorage` neka nosi ključ proizvoda (`cardDraft-christmas-card-2`).

### Korak 5 — provera
```
node service/tools/check-consistency.mjs      -> mora da piše „Settings are consistent.“
cd service && npm test                        -> sve (podešavanja, build, API, pregledač, primer čestitke)
```
`check-consistency` hvata: različita ograničenja u dva fajla, pogrešno ime foldera ili ulazne stranice, fajl koji fali,
stranicu bez `ProductLink.entry / ready / invitationLink / recipientPage / guard`, putanju sa `../`, skriptu sa drugog sajta.

Ručno, lokalno (dva prozora terminala):
```
cd service && npm ci && cp .dev.vars.example .dev.vars && npm run dev          # servis: http://127.0.0.1:8787
node service/tools/pages-server.mjs --port=8080 --keys=http://127.0.0.1:8787   # sajt:   http://127.0.0.1:8080
```
Otvoriti `http://127.0.0.1:8080/product/<folder>/personalize-xxxx.html`, ukucati probni broj (za LAB: bilo koji od
`1000001000` do `1000001999`), napraviti link, otvoriti ga u drugom prozoru. Proveriti i režim „direct“ (promeniti onu
jednu liniju, osvežiti): ulazna adresa mora odmah da otvori pravljenje, a link nema `&s=`.

### Korak 6 — START HERE PDF i listing
- U PDF ide **ulazna adresa** (`https://wishberrystudiogifts.github.io/product/<folder>/personalize-xxxx.html`) — ista u oba
  režima — i korak sa brojem porudžbine. Gotovi tekstovi: dokument „Etsy listinzi — prva 3 SEO paketa“, odeljak
  „Product link (heš) — NACRT tekstova, nije na Etsy-ju“.
- Pravila (rok, broj otvaranja, da fajlovi ostaju zauvek) moraju da pišu u listingu PRE kupovine — isti odeljak.

### Korak 7 — pre objave proizvoda u režimu „hash“
`node service/tools/check-consistency.mjs --release` — tada su greške i: prazan `shared/keys.js`, prazan `listingIds`.

---

## 6. Podešavanja

**Rok i broj otvaranja** — jedan broj, na dva mesta koja moraju biti ista (`check-consistency` ih poredi):
`service/config.json → defaults.ttlHours / maxOpens / maxSigns` i `shared/config.js → limits.ttlHours / maxOpens / maxLinks`.
Za 30 dana: `ttlHours: 720` u oba fajla. Važi za linkove nastale posle izmene; postojeći zadržavaju svoj rok.
Proizvod može imati svoja ograničenja (isti nazivi unutar proizvoda, u oba fajla).

`service/config.json → activation` (sve je opisano i u samom fajlu, u `_activation_note`):

| Postavka | Vrednost | Značenje |
|---|---|---|
| `maxAttemptsPerHour` | 10 | pokušaja po posetiocu i satu (brojem se smatra provera kod Etsy-ja ili promašaj) |
| `negativeCacheMinutes` | 2 | koliko dugo se „nema takve porudžbine“ ne pita ponovo |
| `retryCheckSeconds` | 60 | najranije ponovno pitanje za „još nije plaćeno“ i za neproverenu porudžbinu |
| `recheckMinutes` / `maxRechecks` / `slowRecheckHours` | 30 / 5 / 6 | kasnija provera neproverene porudžbine: prvih 5 puta najviše na 30 min, zatim najviše na 6 h |
| `maxUncheckedPerHour` | 30 | najviše NOVIH neproverenih porudžbina na sat, ukupno |
| `uncheckedMaxSigns` | 5 | koliko linkova može da napravi neproveren link dok traje kratak prekid Etsy-ja |
| `maxEtsyPerMinute` / `maxEtsyPerDay` | 20 / 2000 | naša kočnica za zahteve ka Etsy-ju (dozvoljeno je 10/s i 10.000/dan) |
| `maxOpensPerVisitorHour` / `maxSignsPerVisitorHour` | 60 / 40 | otvaranja / novih linkova sa jedne internet adrese na sat |

`defaults.maxSigns: 100` — koliko invitation linkova može da potpiše jedan product link (0 = bez ograničenja).
**Ovo je Claude-ov dodatak posle bezbednosnog pregleda, nije Nikolino pravilo** — vidi odeljak 14.

## 7. Adrese servisa

| Adresa | Odgovor |
|---|---|
| `POST /api/activate` `{order, product}` | 200 `{links:[{product, hash}], verified}` · 400 `bad_order` · 404 `not_found` (isto za „ne postoji“ i „nije naš proizvod“) · 409 `not_paid` · 429 `rate_limited` · 503 `busy` |
| `POST /api/open/<heš>` | 200 `{product, opens, maxOpens, firstOpen, lastOpen, expires}` · 404 · 410 `{reason: time / opens / withdrawn}` · 429 `slow_down` |
| `POST /api/sign` `{hash, d}` | 200 `{s, kid}` · 409 `not_opened` / `signing_off` · 410 · 429 `sign_limit` / `slow_down` |
| `GET /api/pubkey` | javni ključ |
| `GET /api/status` | da li radi, da li je radnja povezana, `attention` = šta traži pažnju (bez tajni, bez podataka o kupcima) |
| `GET /etsy/connect`, `/etsy/callback` | povezivanje radnje (otvara ih samo Nikola) |

API prima zahteve samo sa našeg sajta i sa `localhost`. Jednom dnevno (03:17 UTC) servis čisti sopstvene tabele; to
čišćenje **nikad ne zove Etsy**.

## 8. Šta servis čuva (privatnost)

- Tekst pozivnice/čestitke **nikad ne stiže** do servisa (šalje se samo otisak za potpis).
- Broj porudžbine se ne čuva u izvornom obliku: čuva se kôd (HMAC) napravljen iz njega. Izuzetak: dok Etsy ne može da
  potvrdi porudžbinu, broj se čuva šifrovan, najduže 7 dana.
- IP adresa se ne čuva: u brojaču pokušaja je kôd napravljen iz nje, briše se u roku od dva dana.
- Po hešu: proizvod, nastanak, prvo i poslednje otvaranje, broj otvaranja i potpisa, rok. Zapis linka se nikad ne briše.
- Nema administratorskog ključa: zapisi se gledaju u Cloudflare → D1 → product-link-db → Console (odeljak 10).
- Poštena napomena: ključ za te kodove je u istoj bazi. Ko bi dobio celu bazu, mogao bi nagađanjem da vrati brojeve
  porudžbina. Zato u uslovima piše samo ono što je tačno („ne čuvamo broj kako je ukucan“), bez obećanja „nepovratno“.

---

## 9. Puštanje u rad — redosled

| # | Ko | Šta | Min |
|---|---|---|---|
| 1 | Claude (razgovor) | Grana `product-link-hash` na GitHub (iz razgovora koji ima pristup repozitorijumu). Cloudflare sam pravi preview. Provera: `<preview>/api/status` → `"ok": true`, `"tables": "pv_"`, `"verifier": "mock"`. | — |
| 2 | Nikola | Kaže „ide“. Claude spaja granu sa `main`. Cloudflare sam pušta servis, GitHub Pages sajt. | 1 |
| 3 | Claude | Provera produkcije: `https://product-link.wishberrystudiogifts.workers.dev/api/status` → `"ok": true`, `"stage": "production"`, `etsy.apiKey: true`. | — |
| 4 | Claude | Javni ključ u sajt: `node service/tools/embed-pubkey.mjs` (ako radni prostor ne vidi servis: otvoriti `/api/pubkey` u pregledaču i pokrenuti `… embed-pubkey.mjs --key <vrednost "key">`), pa `shared/keys.js` na `main`. | — |
| 5 | Nikola | LAB na telefonu: otvoriti `https://wishberrystudiogifts.github.io/product/lab-party-1-2026-11-24/personalize-l4b7.html`, ukucati `1000001001`, napraviti pozivnicu, poslati link sebi, otvoriti ga na drugom uređaju. | 5 |
| 6 | Nikola | **Etsy — callback adresa** (ručno, može sa telefona): 1) etsy.com/developers/your-apps 2) u redu aplikacije „Wishberry Order Check“ meni → „Edit callback URLs“ 3) dodati `https://product-link.wishberrystudiogifts.workers.dev/etsy/callback` i sačuvati. | 2 |
| 7 | Nikola | **Etsy — „Allow“** (ručno): 1) otvoriti `https://product-link.wishberrystudiogifts.workers.dev/etsy/connect` 2) na Etsy stranici potvrditi pristup 3) mora da piše „Povezano ✓“. | 2 |
| 8 | Claude | Etsy listing ID novog proizvoda u `service/config.json` → `listingIds`, na `main`. Zatim `check-consistency --release`. | — |

Koraci 6 i 7 mogu da sačekaju (vidi izveštaj od 24. nov, ocena za žuti nivo): **dok radnja nije povezana, servis pušta
svaki ispravno napisan broj porudžbine** i to piše u `/api/status → attention`. Rok, brojač i potpisi rade i tada.
Posle povezivanja: dok servis prvi put uspešno ne pročita jednu pravu porudžbinu, Etsy-jevo „ne postoji“ se ne uzima kao
konačno (kupac se pušta, a u dnevnik ide beleška) — kôd nikad nije radio uživo i naša greška ne sme da odbije kupca.

Za preview (pre spajanja): na preview adresi `/etsy/connect` NE koristiti — preview nikad ne zove Etsy.

## 10. Svakodnevno — D1 konzola (Cloudflare → Storage & Databases → D1 → product-link-db → Console)

```sql
-- poslednji linkovi
SELECT hash, product, datetime(created/1000,'unixepoch') AS made, datetime(first_open/1000,'unixepoch') AS first_open,
       datetime(expires/1000,'unixepoch') AS expires, opens, max_opens, signs, max_signs, verified, revoked
FROM links ORDER BY created DESC LIMIT 20;

-- beleške servisa (bez brojeva porudžbina i bez adresa)
SELECT datetime(at/1000,'unixepoch') AS at, kind, detail FROM log ORDER BY id DESC LIMIT 50;

-- kupac traži još vremena: +7 dana / još 300 otvaranja / sve ispočetka (nov rok kreće od sledećeg otvaranja)
UPDATE links SET expires = expires + 7 * 86400000 WHERE hash = 'OVDE_HES';
UPDATE links SET max_opens = max_opens + 300 WHERE hash = 'OVDE_HES';
UPDATE links SET opens = 0, signs = 0, first_open = NULL, last_open = NULL, expires = NULL WHERE hash = 'OVDE_HES';

-- zatvoriti link zbog zloupotrebe (kôd ga nikad sam ne otvara) / otvoriti ga ponovo
UPDATE links SET revoked = 2 WHERE hash = 'OVDE_HES';
UPDATE links SET revoked = 0 WHERE hash = 'OVDE_HES';

-- vlasnikov link za pravi proizvod bez porudžbine (vraća heš; otvoriti https://wishberrystudiogifts.github.io/<heš>)
INSERT INTO links (hash, product, order_key, created, max_opens, ttl_ms, max_signs, verified)
VALUES (substr(lower(hex(randomblob(16))), 1, 22), 'christmas-card-2', 'owner-test',
        CAST(strftime('%s','now') AS INTEGER) * 1000, 300, 86400000, 100, 1) RETURNING hash;
```
Vremena su u UTC. Heš kupca = 22 znaka na kraju adrese njegove lične stranice (zamoliti ga da pošalje adresu), ili ga
naći po vremenu u prvoj listi. `revoked`: 0 = u redu, 1 = povukao servis (sam vraća kad Etsy potvrdi porudžbinu),
2 = zatvorio vlasnik.

**Etsy — ponovno povezivanje.** Ako `/api/status` kaže `reconnectNeeded: true` (pristup nije korišćen 90 dana ili je
uklonjen na Etsy-ju): otvoriti `/etsy/connect` i potvrditi. Dok se to ne uradi, kupci se puštaju neprovereni.

## 11. Zloupotreba — šta može, šta ne može (PRAVILA §2)

| Pokušaj | Režim „hash“ | Režim „direct“ |
|---|---|---|
| Neko ko nije kupio otvara ulaznu adresu | vidi samo formu; bez plaćene porudžbine nema linka (kad je radnja povezana sa Etsy-jem) | pravi šta hoće — kao kod starih proizvoda |
| Ručno napravljen invitation link sa svojim tekstom | odbijen („This link isn’t complete“) — nema potpisa | radi |
| Kupac podeli svoj product link | svi dele isti rok i isti brojač (300), i najviše 100 linkova | — |
| Kupac podeli broj porudžbine | isto kao da je podelio link; ko zna broj može i da potroši otvaranja (kočnica: 60 otvaranja na sat sa jedne adrese; vlasnik vraća brojač u D1) | — |
| Pogađanje brojeva porudžbina | 10 pokušaja na sat po adresi (IPv6: po mreži /64); Etsy brojevi su retki u ogromnom rasponu | — |
| Pogađanje heša | 22 znaka = 132 bita, nije izvodljivo | — |
| Posle isteka roka | `/<heš>` zatvoren, nema novih potpisa; već poslati linkovi rade; ista porudžbina ne dobija nov rok | — |
| Stranica ostavljena otvorena posle isteka | štampa i video se prave na uređaju, pa u već otvorenom prozoru i dalje rade; nov link ne može | — |
| Slike lica čestitke | javni fajlovi na sajtu — mogu se preuzeti u oba režima (kao i do sada) | isto |

Šta kupcu ostaje posle isteka: svi fajlovi sa Etsy-ja (zauvek) i svaki link koji je već poslao.

## 12. Etsy pravila (zaključak, izvori čitani 24. nov 2026, svaki jednom)

- Digitalni proizvodi su dozvoljeni; listing mora tačno da opiše šta kupac dobija (Seller Policy,
  `etsy.com/legal/sellers/`). Ograničenje koje ne piše u listingu = rizik spora „not as described“.
- Usluge, „pristup“ i iznajmljivanje su zabranjeni (`etsy.com/legal/policy/services/242665313101`): zato je **proizvod pet
  fajlova** koji ostaju zauvek („There are generally no limits for when or how many times you can download a file“,
  `help.etsy.com/hc/articles/115013328108`), a lična stranica je **besplatan dodatak**. Reči „access“, „unlock“,
  „subscription“ ne koristiti kao opis proizvoda.
- Na stranici nema prodaje, plaćanja ni prikupljanja imena/mejla (zabrana transakcija van Etsy-ja; podaci kupca samo za
  Etsy porudžbinu).
- Uslovi Etsy API-ja (`etsy.com/legal/api`, izmena 18. avg 2026): obavezna napomena o žigu (stoji na formi, na stranici
  uslova i na svakoj stranici servisa), odricanje od garancije (u `shared/terms.html`), uslovi i privatnost za korisnike
  (isti fajl, link na formi), najmanje moguće podataka i zahteva (čitamo jednu porudžbinu, čuvamo samo ID-jeve listinga).
- **Nejasno i nepotvrđeno:** uslovi kažu da je lična upotreba „building tools for your own Etsy shop“, a aplikacija je
  odobrena kao Seller App (samo za svoju radnju). Mi čitamo samo sopstvene porudžbine, ali odgovor koristimo na stranici za
  kupce. Predlog: jedno pitanje na `developer@etsy.com` (nacrt je u izveštaju). Uslovi traže i „monitored email address“ —
  odluka za Nikolu (adresa radnje, ne privatna).
- Stranica „Creativity Standards“ (`etsy.com/legal/creativity`) nije mogla da se učita; nije ponovo pokušavano.

## 13. Šta NIJE ispitano uživo

- Pravi Etsy API: OAuth (connect/callback), osvežavanje pristupa, čitanje porudžbine, tačan oblik odgovora i grešaka.
  Kôd je pisan po dokumentaciji (`developer.etsy.com/documentation`) i ispitan na lokalnoj zameni koja je pravljena po
  istoj dokumentaciji — greška u razumevanju dokumentacije bila bi u oba.
- Cloudflare produkcija i preview: `wrangler deploy --dry-run` prolazi; `wrangler preview`, dnevno čišćenje (cron) i
  ponašanje D1 u oblaku nisu pokrenuti. Radni prostor u kome je ovo pravljeno ne vidi `*.workers.dev` ni `github.io`.
- GitHub Pages: da `404.html` zaista dobija adrese `/<heš>` (lokalni server to oponaša; GitHub tako radi po dokumentaciji).
- Pravi telefoni (iPhone Safari, Android Chrome): ispitano u Chromium-u na širini 390 px.

## 14. Odluke koje čekaju Nikolu

1. **Rok — ODLUČENO 24. nov u 23:03: 30 dana od prvog otvaranja i najviše 100 linkova** (uz 300 otvaranja). Ranije pitanje: rok 24 h ili 30 dana. Za pozivnice je 24 h kratko (izmena pozivnice posle dva dana = poruka nama). Jedan broj, dva fajla.
2. **`maxSigns: 100`** (najviše linkova po product linku) — Claude-ov dodatak; bez njega jedan kupac može da potpiše
   neograničeno tuđih pozivnica. Ako ostaje, rečenica je u nacrtu tekstova; ako ne: `0` u oba fajla.
3. **Kad povezati Etsy** (koraci 6 i 7) — ocena je u izveštaju.
4. **Mejl za podršku** na stranici uslova (traže ga uslovi API-ja).
5. Kasnije, po želji: ključ za kodove premestiti iz baze u tajnu Worker-a (jača privatnost ako baza procuri).
