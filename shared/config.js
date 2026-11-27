/* Wishberry — site settings for the PRODUCT LINK (new standard for listings published from 26 Nov 2026).
   Guide: service/README.md.  Words: product link = the link the BUYER gets; invitation link = the link the buyer SENDS.

   Each new product has ONE permanent buyer address (…/product/<folder>/<entry>) and TWO modes from the same files:
     mode: 'hash'    new standard — the buyer types the Etsy order number, gets a personal link  /<hash>  with a
                     deadline and an opening counter, and the invitation links are signed (the recipient page checks).
     mode: 'direct'  reserve, the old flow — the buyer address opens the maker straight away; no order number,
                     no deadline, no counter, no signature. In this mode the pages never call the service.
   Switching a product = changing its ONE line "mode: …" below. (Published older products are not listed here at all.) */
window.WB_CONFIG = {
  serviceUrl: 'https://product-link.wishberrystudiogifts.workers.dev',
  shopUrl: 'https://wishberrystudiogifts.etsy.com',
  messageUrl: 'https://wishberrystudiogifts.etsy.com',

  /* What the pages SAY about the limits. Must equal "defaults" in service/config.json
     (service/tools/check-consistency.mjs compares the two files; maxLinks here = maxSigns there, 0 = no limit). */
  limits: { ttlHours: 720, maxOpens: 300, maxLinks: 100 },

  products: {
    'christmas-card-2': {
      mode: 'hash',   // SWITCH of Christmas Card 2 — this ONE line: 'hash' or 'direct'
      folder: 'product/christmas-card-2-2026-11-24',
      entry: 'personalize-gvhm.html',
      name: 'Christmas card “Snowy Cabin”',
      kind: 'card',
      allowBare: true   // the bare page address shows the sample card (no personal words), as the older cards do
    },
    'christmas-card-1': {
      mode: 'hash',   // SWITCH of the Christmas card "Gold Lantern" (new version "A light in the window") — this ONE line: 'hash' or 'direct'
      folder: 'product/christmas-card-1-2026-11-27',
      entry: 'personalize-q7ln.html',
      name: 'Christmas card “Gold Lantern”',
      kind: 'card',
      allowBare: true   // the bare page address shows the sample card (no personal words), as the older cards do
    },
    'christmas-party-1': {
      mode: 'hash',   // SWITCH of the Christmas Party invitation "The party's behind this door" — this ONE line: 'hash' or 'direct'
      folder: 'product/christmas-party-invitation-1-2026-11-26',
      entry: 'personalize-w6kd.html',
      name: 'Christmas Party invitation',
      kind: 'invitation'
    },
    'lab-party-1': {
      mode: 'hash',   // <-- THE SWITCH for this product: 'hash' or 'direct'
      folder: 'product/lab-party-1-2026-11-24',
      entry: 'personalize-l4b7.html',
      name: 'Christmas Party invitation (TEST COPY)',
      kind: 'invitation'
    }
  }
};
