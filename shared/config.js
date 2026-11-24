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
     (service/tools/check-consistency.mjs compares the two files). */
  limits: { ttlHours: 24, maxOpens: 300 },

  products: {
    'lab-party-1': {
      mode: 'hash',   // <-- THE SWITCH for this product: 'hash' or 'direct'
      folder: 'product/lab-party-1-2026-11-24',
      entry: 'personalize-l4b7.html',
      name: 'Christmas Party invitation (TEST COPY)',
      kind: 'invitation'
    }
  }
};
