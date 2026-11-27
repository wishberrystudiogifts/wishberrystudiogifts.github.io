#!/usr/bin/env python3
# Listing images of the New Year's Eve invitation "Midnight" (27 Nov 2026; from make-listing-images-party-door.py): HTML slides 900x675 css,
# rendered x3 = 2700x2025 with Chrome. Lettering of this product: Italiana + Cormorant Garamond (SIL OFL), named PFS / LC in the styles below.
# Usage: python3 make_listing.py <out dir> [names...]     pictures: li/img (faces, plates, envelope), lshots (phone shots)
import sys, os, asyncio
OUT = sys.argv[1]; ONLY = sys.argv[2:]
F = 'file:///home/claude/work/'
FONT = F + 'nye/prod/new-years-eve-invitation-1-2026-11-27/fonts/'
CSS = '''
@font-face{font-family:'PFS';src:url(%(f)sitaliana-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'LC';font-weight:400;src:url(%(f)scormorant-garamond-latin-500-normal.woff2) format('woff2')}
@font-face{font-family:'LC';font-weight:400;font-style:italic;src:url(%(f)scormorant-garamond-latin-500-italic.woff2) format('woff2')}
@font-face{font-family:'LC';font-weight:700;src:url(%(f)scormorant-garamond-latin-600-normal.woff2) format('woff2')}
*{box-sizing:border-box}html,body{margin:0}
.s{width:900px;height:675px;position:relative;overflow:hidden;background:#F4F2ED;font-family:'LC',Georgia,serif;color:#1B1E2B}
.h{position:absolute;left:30px;right:30px;top:30px;text-align:center}
.h h1{margin:0;font-weight:400;font-size:39px;line-height:1.1;color:#141C38}
.h h1 i{font-family:'PFS';font-style:normal;font-size:1.22em;color:#8C6A22;padding:0 .08em}
.h p{margin:9px 0 0;font-size:14.5px;letter-spacing:.2em;text-transform:uppercase;color:#666A78}
.band{position:absolute;left:0;right:0;bottom:0;height:50px;background:#141C38;color:#EEF0F6;display:flex;align-items:center;justify-content:center;font-size:17px;letter-spacing:.04em}
.band b{color:#E9D39A;font-weight:700;margin-left:.4em}
.phone{position:absolute;width:178px;height:380px;border-radius:27px;background:#151212;padding:7px;box-shadow:0 16px 32px rgba(8,10,24,.3)}
.phone img{width:100%%;height:100%%;object-fit:cover;border-radius:21px;display:block}
.cap{position:absolute;width:250px;text-align:center;font-size:17px;line-height:1.3}
.cap b{display:block;font-weight:700;font-size:18.5px;color:#141C38;margin-bottom:2px}
.num{display:inline-block;width:27px;height:27px;line-height:27px;border-radius:50%%;background:#141C38;color:#EEF0F6;font-size:15px;font-weight:700;text-align:center;margin-right:8px}
.card{position:absolute;box-shadow:0 14px 30px rgba(8,10,24,.32);display:block}
.abs{position:absolute}
''' % dict(f=FONT)
def page(body, extra=''): return '<!doctype html><meta charset="utf-8"><style>' + CSS + extra + '</style><div class="s">' + body + '</div>'
def head(h, p): return '<div class="h"><h1>%s</h1><p>%s</p></div>' % (h, p)
def band(t): return '<div class="band">%s</div>' % t
def phone(src, x, y, w=178, rot=0): return '<div class="phone" style="left:%dpx;top:%dpx;width:%dpx;height:%dpx;transform:rotate(%sdeg)"><img src="%s"></div>' % (x, y, w, round(w * 380 / 178), rot, src)
def three(shots, caps, y=128):
    o = ''
    for i, (s, c) in enumerate(zip(shots, caps)):
        cx = 170 + i * 280
        o += phone(F + 'nye/lshots/' + s, cx - 89, y) + '<div class="cap" style="left:%dpx;top:%dpx"><b><span class="num">%d</span>%s</b>%s</div>' % (cx - 125, y + 394, i + 1, c[0], c[1])
    return o
I = F + 'nye/li/img/'
TITLE = '''<div class="t1">New Year&rsquo;s Eve</div><div class="t2">Animated Invitation &middot; 3 Designs</div><div class="t3">one link &mdash; guests RSVP in one tap &mdash; or print it</div>'''
S = {}
# ---- covers (three directions; the fresh eye picks one)
TS = '.tt{text-align:center}.t1{font-family:PFS;line-height:1.05;white-space:nowrap}.t2{font-weight:700;letter-spacing:.17em;text-transform:uppercase;white-space:nowrap}.t3{font-style:italic;white-space:nowrap}'
S['cover-A'] = page('<img class="abs" src="%splate-05500.jpg" style="left:0;top:0;width:900px;height:675px">'
  '<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(6,6,12,.88) 0,rgba(6,6,12,.66) 36%%,rgba(6,6,12,0) 50%%)"></div>'
  '<img class="card" src="%sface-a.jpg" style="left:22px;top:292px;width:178px;transform:rotate(-9deg)">'
  '<img class="card" src="%sface-c.jpg" style="left:210px;top:296px;width:178px;transform:rotate(8deg)">'
  '<img class="card" src="%sface-b.jpg" style="left:102px;top:250px;width:214px;transform:rotate(-1deg)">'
  % (I, I, I, I) + phone(F + 'nye/lshots/guest-10000.png', 716, 240, 164, 4) +
  '<div class="abs tt" style="left:6px;top:30px;width:424px">' + TITLE + '</div>',
  TS + '.t1{font-size:49px;color:#F7E3B4;text-shadow:0 3px 14px rgba(0,0,0,.6)}.t2{margin-top:10px;font-size:16.5px;color:#FFF6E2}.t3{margin-top:9px;font-size:16px;color:#F1DDB6}')
S['cover-B'] = page('<img class="abs" src="%splate-blur.jpg" style="left:-60px;top:-45px;width:1020px;height:765px;filter:brightness(1.25)">'
  '<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(6,6,12,.55) 0,rgba(6,6,12,0) 36%%,rgba(6,6,12,0) 100%%)"></div>'
  '<img class="abs" src="%senv-open.png" style="left:100px;top:186px;width:246px;transform:rotate(-5deg);filter:drop-shadow(0 18px 26px rgba(0,0,0,.5))">'
  '<img class="abs" src="%senv-closed.png" style="left:404px;top:330px;width:204px;transform:rotate(7deg);filter:drop-shadow(0 16px 22px rgba(0,0,0,.5))">'
  % (I, I, I) + phone(F + 'nye/lshots/guest-10000.png', 672, 206, 190, 3) +
  '<div class="abs tt" style="left:0;right:0;top:20px">' + TITLE + '</div>',
  TS + '.t1{font-size:72px;color:#F7E3B4;text-shadow:0 3px 14px rgba(0,0,0,.7)}.t2{margin-top:6px;font-size:21px;color:#FFF6E2;text-shadow:0 2px 8px rgba(0,0,0,.7)}.t3{margin-top:7px;font-size:19px;color:#F1DDB6;text-shadow:0 2px 8px rgba(0,0,0,.7)}')
S['cover-C'] = page('<div class="abs" style="left:0;top:0;width:430px;height:675px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000 76%%,transparent 100%%);mask-image:linear-gradient(90deg,#000 76%%,transparent 100%%)"><img src="%splate-05500.jpg" style="position:absolute;left:-412px;top:0;height:675px"></div>'
  '<img class="card" src="%sface-b.jpg" style="left:296px;top:226px;width:246px;transform:rotate(-3deg)">'
  % (I, I) + phone(F + 'nye/lshots/guest-10000.png', 536, 282, 166, 4) +
  '<img class="card" src="%sface-a.jpg" style="left:722px;top:236px;width:148px;transform:rotate(5deg)"><img class="card" src="%sface-c.jpg" style="left:730px;top:440px;width:148px;transform:rotate(-4deg)">' % (I, I) +
  '<div class="abs tt" style="left:400px;right:10px;top:22px"><div class="t1">New Year&rsquo;s Eve</div><div class="t2">Animated Invitation</div><div class="t3">3 designs &middot; guests RSVP in one tap &middot; printable</div></div>',
  TS + '.t1{font-size:44px;color:#8C6A22}.t2{margin-top:6px;font-size:29px;letter-spacing:.05em;color:#1B2244}.t3{margin-top:8px;font-size:19px;color:#4A4F63}')
# ---- 2: three designs
S['designs'] = page(head('3 designs included &mdash; <i>choose yours</i>', 'pick one on your personal page &middot; switch any time') +
  ''.join('<img class="card" src="%sface-%s.jpg" style="left:%dpx;top:128px;width:236px"><div class="cap" style="left:%dpx;top:472px"><b>%s</b>%s</div>' % (I, k, 66 + i * 266, 59 + i * 266, n, d)
          for i, (k, n, d) in enumerate([('a', 'Midnight Silver', 'navy velvet, a silver clock at twelve'), ('b', 'Gold Countdown', 'black &amp; gold art deco'), ('c', 'Ivory Confetti', 'ivory with confetti balloons')])) +
  band('One purchase &mdash;<b>all three designs are yours</b>'))
# ---- 3: the envelope, close
S['envelope'] = page('<img class="abs" src="%splate-blur.jpg" style="left:-60px;top:-45px;width:1020px;height:765px">'
  '<img class="abs" src="%senv-closed.png" style="left:70px;top:44px;width:404px;transform:rotate(-4deg);filter:drop-shadow(0 22px 30px rgba(0,0,0,.55))">'
  '<div class="abs" style="left:520px;top:92px;width:340px;color:#FFF3DC;text-shadow:0 2px 10px rgba(0,0,0,.8)"><div style="font-family:PFS;font-size:43px;line-height:1.15;color:#F7E3B4;white-space:nowrap">One minute<br>to midnight</div>'
  '<div style="margin-top:20px;font-size:19px;line-height:1.5">A pearl envelope tied with a navy velvet band slides across a black marble table set for the party.</div>'
  '<div style="margin-top:16px;font-size:19px;line-height:1.5">One tap: the little silver clock on its seal strikes twelve, the band lets go, the star-lined flap opens and your invitation slides out.</div>'
  '<div style="margin-top:22px;font-size:13.5px;letter-spacing:.16em;text-transform:uppercase;color:#F1DDB6">Part of the animation your guests see on screen &mdash; not a physical envelope</div></div>' % (I, I))
# ---- 4: how it works
S['how'] = page(head('Make it online &mdash; <i>send one link</i>', 'your personal invitation page opens with your Etsy order number') +
  three(['buyer-gate-filled.png', 'buyer-form.png', 'buyer-send.png'], [('Type your order number', 'the link is in the Start Here file'), ('Add your party details', 'choose a design &mdash; about two minutes'), ('Send the link', 'by WhatsApp, text or email')]) +
  band('No Canva, no app, no account &mdash;<b>on your phone or computer</b>'))
# ---- 5: what guests see
S['guests-see'] = page(head('What your guests <i>see</i>', 'a little story on their phone &middot; no app needed') +
  three(['guest-01300.png', 'guest-05500.png', 'guest-10000.png'], [('An envelope slides in', 'across a black marble table'), ('The clock strikes twelve', 'the envelope opens, your invitation slides out'), ('Your party details', 'with buttons to reply and save the date')]) +
  band('One link for all your guests &mdash;<b>they just tap the envelope</b>'))
# ---- 6: replies
S['reply'] = page(head('Guests reply in <i>one tap</i>', 'RSVP, calendar and directions are built into your invitation') +
  three(['guest-reply.png', 'guest-calendar.png', 'guest-10000.png'], [('A ready reply to you', 'by text, WhatsApp or email'), ('Save the date', 'they add the party to their calendar'), ('Directions', 'opens your address in their maps')]) +
  band('Replies come straight to your phone or email &mdash;<b>no RSVP website to manage</b>'))
# ---- 7: make it a video
S['video'] = page(head('Make it a video &mdash; <i>with your details</i>', 'a 12-second video of your invitation opening, made right on your phone') +
  phone(F + 'nye/lshots/buyer-video.png', 96, 128) +
  ''.join('<img class="card" src="%svf-%d.jpg" style="left:%dpx;top:150px;width:150px;border-radius:10px">' % (I, k, 348 + k * 172) for k in range(3)) +
  '<div class="cap" style="left:60px;top:522px"><b><span class="num">1</span>Tap &ldquo;Make it a video&rdquo;</b>on your invitation page</div>'
  '<div class="cap" style="left:332px;top:440px;width:530px;text-align:left;font-size:18px"><b><span class="num">2</span>Your phone makes it in seconds</b>The envelope slides in, the clock strikes twelve and your party details appear &mdash; in the design you chose.</div>'
  '<div class="cap" style="left:332px;top:526px;width:530px;text-align:left;font-size:18px"><b><span class="num">3</span>Send it in any chat &mdash; or save it</b></div>' +
  band('MP4 &middot; 12 seconds &middot; vertical 1080 &times; 1920 &middot;<b>no music</b>'))
# ---- 8: what you get
def tile(x, n, t, d, inner): return '<div class="abs" style="left:%dpx;top:150px;width:168px;height:236px;display:flex;align-items:center;justify-content:center">%s</div><div class="cap" style="left:%dpx;top:402px;width:176px;font-size:15.5px"><span class="num" style="margin:0 0 8px">%s</span><b style="font-size:18px">%s</b>%s</div>' % (x, inner, x - 4, n, t, d)
S['files'] = page(head('What you get &mdash; <i>5 files</i>', 'instant download &middot; all 3 designs &middot; nothing will be shipped') +
  tile(22, '01', 'Start Here', 'the link to your personal invitation page', '<img class="card" src="%sstarthere.png" style="position:static;width:150px">' % I) +
  tile(196, '02', 'Print-shop PDF', 'write-in versions, 5&times;7, ready to print', '<img class="card" src="%swrite-b.jpg" style="position:static;width:150px">' % I) +
  tile(370, '03', '<span style="white-space:nowrap;font-size:16.5px">Print-at-home PDF</span>', 'write-in versions, US Letter &amp; A4', '<div style="width:160px;height:207px;background:#fff;box-shadow:0 10px 22px rgba(8,10,24,.25);display:flex;align-items:center;justify-content:center"><img src="%swrite-b.jpg" style="width:104px"></div>' % I) +
  tile(544, '04', 'Images', 'JPG &amp; PNG, 1500&nbsp;&times;&nbsp;2100&nbsp;px, one ZIP', '<div style="position:relative;width:168px;height:220px"><img class="card" src="%swrite-a.jpg" style="left:0;top:22px;width:118px;transform:rotate(-7deg)"><img class="card" src="%swrite-c.jpg" style="left:52px;top:22px;width:118px;transform:rotate(7deg)"><img class="card" src="%swrite-b.jpg" style="left:24px;top:8px;width:124px"></div>' % (I, I, I)) +
  tile(718, '05', 'Animated preview', 'MP4 video: what guests see', '<div class="phone" style="position:static;width:112px;height:238px;border-radius:18px;padding:5px"><img src="%snye/lshots/guest-10000.png" style="border-radius:14px"></div>' % F) +
  band('Your typed details print from your personal page &mdash;<b>files 02&ndash;04 are write-in versions</b>'))
# ---- 9: print it
S['print'] = page(head('Print it &mdash; <i>with your details</i>', '5&times;7 in &middot; US Letter &middot; A4 &mdash; at home or at a print shop') +
  '<div class="abs" style="left:112px;top:132px;width:258px;height:334px;background:#fff;box-shadow:0 14px 30px rgba(8,10,24,.25)"><img src="%sface-b.jpg" style="position:absolute;left:44px;top:48px;width:170px">' % I +
  ''.join('<i style="position:absolute;background:#222;%s"></i>' % st for st in ['left:44px;top:34px;width:1px;height:10px', 'left:214px;top:34px;width:1px;height:10px', 'left:30px;top:48px;width:10px;height:1px', 'left:218px;top:48px;width:10px;height:1px', 'left:44px;top:290px;width:1px;height:10px', 'left:214px;top:290px;width:1px;height:10px', 'left:30px;top:286px;width:10px;height:1px', 'left:218px;top:286px;width:10px;height:1px']) + '</div>'
  '<img class="card" src="%swrite-a.jpg" style="left:520px;top:160px;width:190px;transform:rotate(-8deg)"><img class="card" src="%swrite-c.jpg" style="left:630px;top:160px;width:190px;transform:rotate(8deg)"><img class="card" src="%swrite-b.jpg" style="left:570px;top:140px;width:204px">' % (I, I, I) +
  '<div class="cap" style="left:91px;top:486px;width:300px"><b>Your details printed in</b>from your invitation page &mdash; print or save as PDF</div>'
  '<div class="cap" style="left:522px;top:486px;width:300px"><b>Or write it by hand</b>write-in versions in files 02&ndash;04 (dark designs: white, silver or gold pen)</div>' +
  band('Best on matte cardstock<b>250&ndash;300 gsm (80&ndash;110 lb cover)</b>'))
# ---- 10: how to download
S['download'] = page('<div class="abs" style="left:64px;top:56px;width:470px"><div style="font-size:14.5px;letter-spacing:.2em;text-transform:uppercase;color:#A8772C;font-weight:700">After your purchase</div>'
  '<div style="font-size:41px;line-height:1.12;color:#141C38;margin-top:10px">How to download <span style="font-family:PFS;color:#8C6A22;font-size:1.15em">your files</span></div>'
  '<div style="margin-top:34px;font-size:22px;font-weight:700;color:#1B1E2B"><span class="num" style="width:34px;height:34px;line-height:34px;font-size:18px">1</span>Open etsy.com in Chrome or Safari</div><div style="margin:4px 0 0 44px;font-size:17px;color:#8C6A22">Not in the Etsy app &mdash; downloads don&rsquo;t work there</div>'
  '<div style="margin-top:26px;font-size:22px;font-weight:700"><span class="num" style="width:34px;height:34px;line-height:34px;font-size:18px">2</span>Go to You &rarr; Purchases</div>'
  '<div style="margin-top:26px;font-size:22px;font-weight:700"><span class="num" style="width:34px;height:34px;line-height:34px;font-size:18px">3</span>Tap Download files</div><div style="margin:4px 0 0 44px;font-size:17px;color:#555A68">Start with 01 Start Here</div></div>'
  '<div class="phone" style="left:604px;top:64px;width:232px;height:496px"><div style="width:100%%;height:100%%;background:#fff;border-radius:21px;padding:16px 14px;font-family:Arial,Helvetica,sans-serif;color:#222">'
  '<div style="border:1px solid #ddd;border-radius:18px;padding:7px 12px;font-size:13px;color:#444">&#128274; etsy.com</div><div style="margin-top:28px;font-weight:700;font-size:16px">Purchases</div>'
  '<div style="margin-top:14px;border:1px solid #e3e3e3;border-radius:10px;padding:10px;display:flex;gap:10px"><img src="%sface-b.jpg" style="width:50px;height:70px;object-fit:cover;border-radius:3px"><div style="font-size:12.5px;line-height:1.35">New Year&rsquo;s Eve Party Invitation&hellip;<div style="color:#777;margin-top:6px;font-size:11.5px">Digital download &middot; 5 files</div></div></div>'
  '<div style="margin-top:16px;background:#222;color:#fff;border-radius:22px;text-align:center;padding:11px;font-weight:700;font-size:14px">Download files</div></div></div>' % I +
  band('Your files stay in Purchases &mdash;<b>download them again anytime</b>'))
# ---- 11: perfect for
S['perfect'] = page('<img class="abs" src="%splate-05500.jpg" style="left:0;top:0;width:900px;height:675px"><div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(6,6,12,.86) 0,rgba(6,6,12,.7) 46%%,rgba(6,6,12,0) 66%%)"></div>'
  '<div class="abs" style="left:54px;top:44px;width:440px;color:#FFF3DC"><div style="font-family:PFS;font-size:62px;color:#F7E3B4;line-height:1.05">Perfect for</div><div style="font-size:15px;letter-spacing:.24em;text-transform:uppercase;margin-top:6px;color:#F1DDB6">every way to ring in the new year</div>' % I +
  ''.join('<div style="margin-top:%dpx;font-size:19px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">%s</div><div style="font-style:italic;font-size:19px;color:#F1DDB6;margin-top:2px">%s</div>' % (26 if i == 0 else 17, a, b)
          for i, (a, b) in enumerate([('New Year&rsquo;s Eve house parties', 'and countdown parties'), ('New Year&rsquo;s Eve dinners', 'and cocktail nights'), ('Office &amp; team parties', 'to close the year together'), ('Family, friends &amp; neighbors', 'get-togethers at home'), ('Last-minute invitations', 'ready to send in about two minutes')])) +
  '<div style="margin-top:22px;font-size:15.5px;color:#F7E3B4">You can change the heading &mdash; &ldquo;Countdown Party&rdquo;, &ldquo;New Year&rsquo;s Eve Dinner&rdquo;&hellip;</div></div>')
# ---- 12: questions
QA = [('Do my guests need an app?', 'No app and no account &mdash; for you or for them.'), ('How do I open my page?', 'With your Etsy order number &mdash; the link is in file 01.'), ('How long can I use it?', '30 days from the first opening: up to 100 invitation links.'),
      ('And after 30 days?', 'Links you sent keep working. Your 5 files are yours forever.'), ('How do guests RSVP?', 'One tap opens a ready reply in their Messages, WhatsApp or email.'), ('Can I print it?', 'Yes &mdash; with your details, or as write-in invitations: 5&times;7, Letter, A4.')]
S['questions'] = page(head('Questions? <i>Answers</i>', 'instant download &middot; nothing will be shipped') +
  ''.join('<div class="abs" style="left:%dpx;top:%dpx;width:262px;height:196px;background:#fff;border:1px solid #D9D9E2;border-radius:8px;padding:20px 18px;text-align:center"><div style="font-weight:700;font-size:16.5px;letter-spacing:.1em;text-transform:uppercase;color:#141C38;line-height:1.3">%s</div><div style="width:34px;height:1px;background:#B8893B;margin:12px auto"></div><div style="font-size:18.5px;line-height:1.38">%s</div></div>' % (36 + (i % 3) * 283, 132 + (i // 3) * 214, q, a) for i, (q, a) in enumerate(QA)) +
  band('Something not working? Message us on Etsy &mdash;<b>we reply within 24 hours</b>'))

async def main():
    from playwright.async_api import async_playwright
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg = await b.new_page(viewport={'width': 900, 'height': 675}, device_scale_factor=3)
        for k, html in S.items():
            if ONLY and k not in ONLY: continue
            f = os.path.join(OUT, k + '.html'); open(f, 'w').write(html)
            await pg.goto('file://' + os.path.abspath(f)); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(150)
            bad = await pg.evaluate("[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)")
            ok = await pg.evaluate("document.fonts.check(\"400 20px PFS\") && document.fonts.check(\"700 20px LC\")")
            await pg.screenshot(path=os.path.join(OUT, k + '.png')); print(k, 'missing:', bad, 'fonts:', ok)
        await b.close()
asyncio.run(main())
