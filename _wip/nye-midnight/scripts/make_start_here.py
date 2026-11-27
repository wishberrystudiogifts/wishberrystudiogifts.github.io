#!/usr/bin/env python3
# START-HERE (file 01) in the PHONE format (P-261121-1, 24 Nov 2026): ONE page of 5.5 x 8.5 in (396 pt wide), every
# text at least 14 pt, the button at least 20 pt. On a phone the page fills the screen width, so 14 pt on paper is
# about 14 pt on the screen - readable without zooming (measure in PRAVILA §4: text >= 13 pt at a width of 390 pt).
# It still prints on Letter and A4 (a half-letter page). Same content as the Letter version it replaces; one line is
# new: "04 Pictures (JPG, PNG) - in one ZIP file; on a phone, tap it in Files to open".
#
# One generator for every product:   python3 make_start_here.py <key> <out.html>      (keys: see PRODUCTS)
# Then:                              python3 render_start_here.py <out.html> <out.pdf>  (fits, checks, writes the PDF)
# Next to the HTML: the picture named in "img" (face.jpg = the card 750x1050, or face3.png for the invitations) and
# fonts/ with Barlow Semi Condensed + Barlow Condensed (npm @fontsource/barlow-semi-condensed, @fontsource/barlow-condensed,
# weights 400/600/700, latin). Lora comes from the system fonts (file:///usr/share/fonts/truetype/google-fonts/).
import sys, html

SITE = 'https://wishberrystudiogifts.github.io/'
ICON = {
 'send': '<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-3.5-7-7-3.5z"/>',
 'print': '<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><rect x="7" y="13" width="10" height="8"/>',
 'phone': '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10.5 9l4 3-4 3z"/>',
 'video': '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
}
F04 = 'Pictures (JPG, PNG) &mdash; in one ZIP file; on a phone, tap it in Files to open'
HELP = '<b>Can&rsquo;t find your files?</b> Open <b>etsy.com</b> in a web browser (Chrome or Safari), not in the Etsy app. Then go to <b>You &rarr; Purchases &rarr; Download files</b>.'
FOOT = ['<b>Stuck?</b> Message us on Etsy &mdash; we reply within 24 hours.', 'Loved it? A short review helps our small shop.']
NOTE = 'Printing at home? Choose <b>&ldquo;Actual size&rdquo;</b> and cut on the corner marks.'
CARD_FILES = ['Start here &mdash; this page', 'For a print shop &mdash; 5x7 card', 'For your printer &mdash; Letter &amp; A4', F04, 'Ready-made video for phones']
INV_FILES = ['Start here &mdash; this page', 'For a print shop &mdash; 5&times;7', 'For your printer &mdash; Letter &amp; A4', F04, 'Preview video: what guests see']
LEAD = 'Thank you for your order! Add your own words and send it to anyone &mdash; it takes about one minute.'
AFTER = 'Type your words, tap <b>Send my card</b> and share the link by WhatsApp, text or email &mdash; or tap <b>Make it a video</b>.'
VIDEO_WAY = ('phone', 'Send a video', 'Tap <b>Make it a video</b> on the same page: your words in a 12&#8209;second video. File 05 is a ready one.')
INV_WAYS = [('send', 'Send it online', 'Guests open the envelope, reply to you and add the party to their calendar.'),
            ('video', 'Make it a video', 'Tap <b>Make it a video</b> on the same page: a 12&#8209;second video with your details, for any chat.'),
            ('print', 'Print it', 'Tap <b>5&nbsp;&times;&nbsp;7</b>, <b>Letter</b> or <b>A4</b> on the same page &mdash; or write by hand on files 02&ndash;04.')]
INV_LEAD = 'Thank you for your order! Pick one of the 3 designs, add your party details and send one link to all your guests by WhatsApp, text or email.'

PRODUCTS = {
 'christmas': dict(title='Start here — Merry Christmas and Happy New Year card', dark='#1E3A2F', band='Merry Christmas &amp; Happy New Year',
   img='face.jpg', alt='The Christmas card: a golden lantern with pine branches on deep green velvet', h1='Your Christmas card is ready', lead=LEAD,
   btn='WRITE YOUR MESSAGE', url='christmas/personalize-k7q2.html', after=[AFTER], h2='Three ways to use your card',
   ways=[('send', 'Send it online', 'Click the gold button. They tap the envelope and it opens.'), ('print', 'Print it', 'Print it as it is, then write your message on the back.'), VIDEO_WAY],
   files_h='Your 5 files', files=CARD_FILES, note=NOTE),
 'birthday': dict(title='Start here — Happy Birthday card', dark='#1E3A2F', band='Happy Birthday',
   img='face.jpg', alt='The birthday card: a three-tier cake with gold drip and glowing candles on deep forest green', h1='Your birthday card is ready', lead=LEAD,
   btn='WRITE YOUR MESSAGE', url='birthday/personalize-b4w8.html', after=[AFTER], h2='Three ways to use your card',
   ways=[('send', 'Send it online', 'Click the gold button. They tap the envelope and it opens.'), ('print', 'Print it', 'Print it as it is, then write your message on the back.'), VIDEO_WAY],
   files_h='Your 5 files', files=CARD_FILES, note=NOTE),
 'gift': dict(title='Start here — Christmas gift card (gift voucher)', dark='#1E3A2F', band='A Christmas Gift For You',
   img='face.jpg', alt='The gift card: a green velvet gift box with a gold bow and a blank gift tag', h1='Your gift card is ready',
   lead='Thank you for your order! Write the gift you are giving and send it to anyone &mdash; it takes about one minute.',
   btn='WRITE YOUR GIFT', url='christmas-gift/personalize-v3n6.html',
   after=['Type your gift, tap <b>Send my gift</b> and share the link by WhatsApp, text or email &mdash; or tap <b>Make it a video</b>.'], h2='Three ways to give your gift',
   ways=[('send', 'Send it online', 'Click the gold button. They open it and see your gift.'), ('print', 'Print it', 'Print the card and the note. Write your gift on the note.'),
         ('phone', 'Send a video', 'Tap <b>Make it a video</b> on the same page: your gift in a 12&#8209;second video. File 05 is a ready one.')],
   files_h='Your 5 files', files=[CARD_FILES[0], 'Print shop &mdash; card + gift note', CARD_FILES[2], F04, CARD_FILES[4]], note=NOTE),
 'party': dict(title='Start here — Christmas Party Invitation', dark='#1E3A2F', band='Christmas Party Invitation',
   img='face3.png', wide=True, alt='The three invitation designs: Emerald and Gold, Ivory and Holly, Champagne Night', h1='Your invitation is ready', lead=INV_LEAD,
   btn='MAKE YOUR INVITATION', url='christmas-party/personalize-p8x5.html', after=[], h2='Three ways to use it', ways=INV_WAYS,
   files_h='Your 5 files &middot; all 3 designs', files=INV_FILES, note=NOTE + ' Writing on a dark design by hand? Use a white or gold pen.'),
 'nye': dict(title='Start here — New Year’s Eve Party Invitation', dark='#16213F', band='New Year&rsquo;s Eve Party Invitation',
   img='face3.png', wide=True, alt='The three invitation designs: Midnight Silver, Gold Countdown, Ivory Confetti', h1='Your invitation is ready', lead=INV_LEAD,
   btn='MAKE YOUR INVITATION', url='new-years-eve/personalize-m1d9.html', after=[], h2='Three ways to use it', ways=INV_WAYS,
   files_h='Your 5 files &middot; all 3 designs', files=INV_FILES, note=NOTE + ' Writing on a dark design by hand? Use a white, silver or gold pen.'),
}
# Christmas Card 2 "Snowy Cabin" - NEW STANDARD: the address is the product's permanent entry address (the same in both modes).
B2 = dict(title='Start here — Christmas card “Snowy Cabin”', dark='#16233D', band='Christmas Card &middot; Snowy Cabin',
   img='face.jpg', alt='The Christmas card: a log cabin with glowing windows in the snow at dusk', h1='Your Christmas card is ready',
   btn='WRITE YOUR MESSAGE', url='product/christmas-card-2-2026-11-24/personalize-%(code)s.html', h2='Three ways to use your card',
   ways=[('send', 'Send it online', 'The envelope arrives on a cabin doorstep; they tap it and your card slides out.'), ('print', 'Print it', 'Print it as it is, then write your message on the back.'), VIDEO_WAY],
   files_h='Your 5 files', files=CARD_FILES, note=NOTE)
# B-direct (reserve, the old flow): no order number, no limits.
PRODUCTS['christmas-2-B-direct'] = dict(B2, lead=LEAD, after=[AFTER])
# A-hash (new standard): the step with the Etsy order number and the limits of the personal page (texts: SEO document,
# "Product link (hes) - NACRT tekstova", section 5; the numbers must equal shared/config.js -> limits: since 24 Nov 2026
# 30 days from the first opening, 100 links, 300 openings - Nikola: "100 klikova i mesec dana koriscenja prihvatam").
PRODUCTS['christmas-2-A-hash'] = dict(B2, lead='Thank you for your order! Add your own words and send it to anyone.',
   after=['On that page, type your <b>Etsy order number</b> &mdash; it is in the email Etsy sent you about this order, after &ldquo;Order&nbsp;#&rdquo;. Then type your words, tap <b>Send my card</b> and share the link &mdash; or tap <b>Make it a video</b>.',
          'Your personal page stays open for <b>30 days</b> after you first open it &mdash; make and send up to 100 cards (up to 300 visits to the page). Links you send keep working after that, and your files never expire.'],
   urlintro='Button not working? Type this address:')

# Christmas Party invitation, new version "The party's behind this door" (26 Nov 2026) - NEW STANDARD (product link):
# the step with the Etsy order number and the limits of the personal page; numbers = shared/config.js -> limits.
PRODUCTS['party-1-hash'] = dict(title='Start here — Christmas Party Invitation', dark='#5E161B', band='Christmas Party Invitation',
   img='face3.png', wide=True, alt='The three invitation designs: Emerald and Gold, Ivory and Holly, Champagne Night', h1='Your invitation is ready',
   lead='Thank you! Pick a design, add your party details and send one link to all your guests.',
   btn='MAKE YOUR INVITATION', url='product/christmas-party-invitation-1-2026-11-26/personalize-%(code)s.html',
   after=['On that page, type your <b>Etsy order number</b> (in Etsy&rsquo;s email, after &ldquo;Order&nbsp;#&rdquo;), add your party details and tap <b>Send my invitation</b>.',
          'Your page stays open for <b>30 days</b> after you first open it: up to 100 invitation links, 300 visits. Sent links and your files never expire.'],
   urlintro='Button not working? Type this address:', h2='Three ways to use it',
   ways=[('send', 'Send it online', 'Guests open the envelope, reply and save the date.'),
         ('video', 'Make it a video', 'Tap <b>Make it a video</b>: 12 seconds, with your details.'),
         ('print', 'Print it', 'Tap <b>5&nbsp;&times;&nbsp;7</b>, <b>Letter</b> or <b>A4</b> &mdash; or write by hand on files 02&ndash;04.')],
   files_h='Your 5 files &middot; all 3 designs', files=INV_FILES, note=NOTE + ' Dark design? Use a white or gold pen.')

# New Year's Eve Party invitation "Midnight" (27 Nov 2026) - NEW STANDARD (product link).
PRODUCTS['nye-1-hash'] = dict(title='Start here — New Year’s Eve Party Invitation', dark='#16213F', band='New Year&rsquo;s Eve Party Invitation',
   img='face3-nye.png', wide=True, alt='The three invitation designs: Midnight Silver, Gold Countdown, Ivory Confetti', h1='Your invitation is ready',
   lead='Thank you! Pick a design, add your party details and send one link to all your guests.',
   btn='MAKE YOUR INVITATION', url='product/new-years-eve-invitation-1-2026-11-27/personalize-%(code)s.html',
   after=['On that page, type your <b>Etsy order number</b> (in Etsy&rsquo;s email, after &ldquo;Order&nbsp;#&rdquo;), add your party details and tap <b>Send my invitation</b>.',
          'Your page stays open for <b>30 days</b> after you first open it: up to 100 invitation links, 300 visits. Sent links and your files never expire.'],
   urlintro='Button not working? Type this address:', h2='Three ways to use it',
   ways=[('send', 'Send it online', 'Guests open the envelope, reply and save the date.'),
         ('video', 'Make it a video', 'Tap <b>Make it a video</b>: 12 seconds, with your details.'),
         ('print', 'Print it', 'Tap <b>5&nbsp;&times;&nbsp;7</b>, <b>Letter</b> or <b>A4</b> &mdash; or write by hand on files 02&ndash;04.')],
   files_h='Your 5 files &middot; all 3 designs', files=INV_FILES, note=NOTE + ' Dark design? Use a white, silver or gold pen.')
# Christmas card "Gold Lantern", new version "A light in the window" (27 Nov 2026) - NEW STANDARD (product link).
PRODUCTS['christmas-1-hash'] = dict(title='Start here — Christmas card “Gold Lantern”', dark='#1E3A2D', band='Christmas Card &middot; Gold Lantern',
   img='face-b1.jpg', alt='The Christmas card: a golden lantern with a glowing candle on deep green velvet', h1='Your Christmas card is ready',
   lead='Thank you for your order! Add your own words and send it to anyone.',
   btn='WRITE YOUR MESSAGE', url='product/christmas-card-1-2026-11-27/personalize-%(code)s.html',
   after=['On that page, type your <b>Etsy order number</b> &mdash; it is in the email Etsy sent you about this order, after &ldquo;Order&nbsp;#&rdquo;. Then type your words, tap <b>Send my card</b> and share the link &mdash; or tap <b>Make it a video</b>.',
          'Your personal page stays open for <b>30 days</b> after you first open it &mdash; make and send up to 100 cards (up to 300 visits to the page). Links you send keep working after that, and your files never expire.'],
   urlintro='Button not working? Type this address:', h2='Three ways to use your card',
   ways=[('send', 'Send it online', 'Their name appears on a misty window; they tap the envelope and your card slides out.'), ('print', 'Print it', 'Print it as it is, then write your message on the back.'), VIDEO_WAY],
   files_h='Your 5 files', files=CARD_FILES, note=NOTE)

# Birthday card "Gold Drip Cake", new version "Make a wish" (27 Nov 2026) - NEW STANDARD (product link).
PRODUCTS['birthday-1-hash'] = dict(title='Start here — Birthday card “Gold Drip Cake”', dark='#1F4D3A', band='Birthday Card &middot; Gold Drip Cake',
   img='face-r1.jpg', alt='The birthday card: a three-tier cake with gold drips and three lit candles on dark green', h1='Your birthday card is ready',
   lead='Thank you for your order! Add your own words and send it to anyone.',
   btn='WRITE YOUR MESSAGE', url='product/birthday-card-1-2026-11-27/personalize-%(code)s.html',
   after=['On that page, type your <b>Etsy order number</b> &mdash; it is in the email Etsy sent you about this order, after &ldquo;Order&nbsp;#&rdquo;. Then type your words, tap <b>Send my card</b> and share the link &mdash; or tap <b>Make it a video</b>.',
          'Your personal page stays open for <b>30 days</b> after you first open it &mdash; make and send up to 100 cards (up to 300 visits to the page). Links you send keep working after that, and your files never expire.'],
   urlintro='Button not working? Type this address:', h2='Three ways to use your card',
   ways=[('send', 'Send it online', 'Their name is on the envelope; they tap it, your card slides out and the candles are blown out.'), ('print', 'Print it', 'Print it as it is, then write your message on the back.'), VIDEO_WAY],
   files_h='Your 5 files', files=CARD_FILES, note=NOTE)

CSS = '''
@font-face{font-family:'Lora';src:url('file:///usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf');font-weight:400 700;font-style:normal}
@font-face{font-family:'Barlow Semi Condensed';src:url('fonts/barlow-semi-condensed-latin-400-normal.woff2') format('woff2');font-weight:400}
@font-face{font-family:'Barlow Semi Condensed';src:url('fonts/barlow-semi-condensed-latin-600-normal.woff2') format('woff2');font-weight:600}
@font-face{font-family:'Barlow Semi Condensed';src:url('fonts/barlow-semi-condensed-latin-700-normal.woff2') format('woff2');font-weight:700}
@font-face{font-family:'Barlow Condensed';src:url('fonts/barlow-condensed-latin-400-normal.woff2') format('woff2');font-weight:400}
@font-face{font-family:'Barlow Condensed';src:url('fonts/barlow-condensed-latin-600-normal.woff2') format('woff2');font-weight:600}
@font-face{font-family:'Barlow Condensed';src:url('fonts/barlow-condensed-latin-700-normal.woff2') format('woff2');font-weight:700}
@page{size:5.5in 8.5in;margin:0}
/* the render tool tightens these four until everything fits on the ONE page (never below 14 pt = 18.67 px) */
:root{--fs:19.4px;--lh:1.22;--g:1;--thumb:88px;--body:'Barlow Semi Condensed'}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--body),sans-serif;color:#24352B;font-size:var(--fs);line-height:var(--lh)}
.page{width:5.5in;height:8.5in;background:#FBF7EE;position:relative;overflow:hidden}
.band{background:var(--dark);color:#F4ECDD;min-height:40px;padding:6px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.band b{font-family:'Lora';font-weight:600;line-height:1.15}
.band span{color:#D9C08A;white-space:nowrap}
.flow{padding:calc(11px*var(--g)) 20px 0}
.hero{display:flex;gap:13px;align-items:flex-start}
.hero img{width:var(--thumb);aspect-ratio:5/7;object-fit:cover;border-radius:3px;box-shadow:0 6px 14px rgba(20,30,40,.28);flex:none}
.hero img.wide{aspect-ratio:200/215;object-fit:contain;box-shadow:none;width:calc(var(--thumb) + 26px);margin:-2px -4px 0 -6px}
h1{font-family:'Lora';font-weight:600;font-size:24px;line-height:1.1;color:var(--dark);margin:0 0 calc(5px*var(--g))}
p{margin:0}
.btn{display:flex;align-items:center;justify-content:center;gap:12px;background:#A8772C;color:#fff;text-decoration:none;font-weight:700;font-size:27px;line-height:1.1;letter-spacing:.04em;padding:calc(12px*var(--g)) 14px;border-radius:40px;margin-top:calc(9px*var(--g));box-shadow:0 4px 12px rgba(168,119,44,.35)}
.btn svg{flex:none}
.blk{margin-top:calc(7px*var(--g))}
.url a{color:var(--dark);font-weight:600;text-decoration:none;overflow-wrap:anywhere}
h2{font-family:'Lora';font-weight:600;font-size:21px;line-height:1.15;color:var(--dark);margin:calc(10px*var(--g)) 0 calc(4px*var(--g))}
.way{display:flex;gap:9px;align-items:flex-start;margin-top:calc(4px*var(--g))}
.way .n{width:26px;height:26px;border-radius:50%;background:var(--dark);flex:none;display:flex;align-items:center;justify-content:center}
.way b.t{color:var(--dark)}
.file{display:flex;gap:8px}
.file .k{font-weight:700;color:#A8772C;flex:none;width:25px}
.help{margin-top:calc(9px*var(--g));background:var(--dark);color:#F4ECDD;border-radius:10px;padding:calc(8px*var(--g)) 13px}
.help b{color:#fff}
.foot{margin-top:calc(8px*var(--g));border-top:1px solid #DCCDAF;padding-top:calc(6px*var(--g));text-align:center;color:#5E5446}
.foot b{color:var(--dark)}
'''

def build(key, code='xxxx'):
    p = PRODUCTS[key]
    url = SITE + (p['url'] % {'code': code})
    shown = url.replace('https://', '').replace('/', '/<wbr>')
    o = ['<!doctype html>', '<html lang="en"><head><meta charset="utf-8">', '<title>%s</title>' % html.escape(p['title']),
         '<!-- START-HERE (01), PHONE format: one page 5.5 x 8.5 in, text >= 14 pt, button >= 20 pt (P-261121-1, 24 Nov 2026).',
         '     Made by make_start_here.py (key: %s). The button and the printed address = the buyer page; never change that address after the first sale.' % key,
         '     Render: python3 render_start_here.py <this file> 01_START-HERE.pdf   (fits the page, checks sizes and links) -->',
         '<style>' + CSS + ':root{--dark:%s}' % p['dark'] + '</style></head>', '<body>', '<div class="page">',
         '  <div class="band"><b>%s</b><span>Instant download</span></div>' % p['band'], '  <div class="flow">',
         '    <div class="hero">', '      <img src="%s"%s alt="%s">' % (p['img'], ' class="wide"' if p.get('wide') else '', html.escape(p['alt'])),
         '      <div><h1>%s</h1><p class="lead">%s</p></div>' % (p['h1'], p['lead']), '    </div>',
         '    <a class="btn" href="%s">%s <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' % (url, p['btn'])]
    for a in p['after']:
        o.append('    <p class="blk after">%s</p>' % a)
    o.append('    <p class="blk url">%s <a href="%s">%s</a></p>' % (p.get('urlintro', 'Button not working? Type this address into your browser:'), url, shown))
    o.append('    <h2>%s</h2>' % p['h2'])
    for ic, t, d in p['ways']:
        o.append('    <div class="way"><div class="n"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4ECDD" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg></div><p><b class="t">%s.</b> %s</p></div>' % (ICON[ic], t, d))
    o.append('    <h2>%s</h2>' % p['files_h'])
    for i, f in enumerate(p['files']):
        o.append('    <div class="file"><span class="k">%02d</span><span>%s</span></div>' % (i + 1, f))
    o.append('    <p class="blk note">%s</p>' % p['note'])
    o.append('    <div class="help">%s</div>' % HELP)
    o.append('    <div class="foot"><div>%s</div><div>%s</div></div>' % tuple(FOOT))
    o += ['  </div>', '</div>', '</body></html>', '']
    return '\n'.join(o)

if __name__ == '__main__':
    key, out = sys.argv[1], sys.argv[2]
    code = sys.argv[3] if len(sys.argv) > 3 else 'xxxx'
    open(out, 'w', encoding='utf-8').write(build(key, code))
    print('wrote', out, '(' + key + ')')
