# builds invite.js and invite.css of the New Year's Eve invitation "Midnight" (27 Nov 2026) from:
#   the kept parts of the first NYE invitation (codec, three faces, reply / calendar / directions buttons, print view)
#   + scripts/invite-nye-head.js + scripts/invite-nye-mid.js + scripts/invite-boot.js (the guarded start of the new standard)
#   + the stylesheet below; the slide and the push of the loose discs are COMPUTED here (constant friction), so the
#   envelope and the discs it pushes always agree.
import sys, math
out_dir = sys.argv[1]
OLD = '/home/claude/site/new-years-eve/'
src = open(OLD + 'invite.js').read().split('\n')
head = open('scripts/invite-nye-head.js').read().rstrip('\n')
a = src.index("(function () {")
b = next(i for i, l in enumerate(src) if l.startswith("  /* ---------- layouts (stage units)"))
c = next(i for i, l in enumerate(src) if l.startswith("  /* ---------- RSVP, calendar, directions"))
d = next(i for i, l in enumerate(src) if l.startswith("  /* ---------- boot"))
out = head + '\n' + '\n'.join(src[a:b]) + '\n' + open('scripts/invite-nye-mid.js').read() + '\n' + '\n'.join(src[c:d]) + '\n' + open('scripts/invite-boot.js').read()
def rep(o, n):
    global out
    assert o in out, o[:60]
    out = out.replace(o, n)
rep("function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.src = src; i.alt = ''; return i; }", "function img(src, cls, style, parent) { var i = el('img', cls, style, parent); i.alt = ''; i.decoding = 'sync'; i.src = src; return i; }")
rep("rp.addEventListener('click', function () { reset(); requestAnimationFrame(function () { requestAnimationFrame(play); }); });", "rp.addEventListener('click', function () { if (!state.ready) return; state.autoplay = true; if (state.reduce) { still(); open(); } else arrive(); });")
rep("c.textContent = '\\uD83D\\uDCC5 Add to calendar';", "c.textContent = 'Add to calendar';")
rep("m.textContent = '\\uD83D\\uDCCD Directions';", "m.textContent = 'Directions';")
rep("s.textContent = '\\uD83C\\uDF81 Send an invitation like this';", "s.textContent = 'Send an invitation like this';")
rep("y.textContent = '\\u2713 I\\u2019ll be there';", "y.textContent = 'I\\u2019ll be there';")   # the tick read as 'already answered'
open(out_dir + '/invite.js', 'w').write(out); print('invite.js', len(out))

# ---------------- stylesheet ----------------
css = open(OLD + 'invite.css').read().split('\n')
fonts = [l for l in css if l.startswith('@font-face')]
fa = next(i for i, l in enumerate(css) if l.startswith('/* ---------- invitation face'))
rest = '\n'.join(css[fa:])
def rr(o, n):
    global rest
    assert o in rest, o[:60]
    rest = rest.replace(o, n)
rr(".iface{position:absolute;inset:0;overflow:hidden;background:#F3EEE3;box-shadow:0 24px 46px rgba(5,5,3,.5)}", ".iface{position:absolute;inset:0;overflow:hidden;background:#F3EEE3}")
rr(".itxt{transition:opacity 1s;will-change:opacity}", ".itxt{will-change:opacity}")
# the small lines a little larger, so they read on a phone (27 Nov 2026)
rr(".iface.d-a .note{font-style:italic;font-weight:500;font-size:1.8em}", ".iface.d-a .note{font-style:italic;font-weight:500;font-size:2.05em}")
rr(".iface.d-a .itxt{top:164px;height:392px;left:50px;right:50px}", ".iface.d-a .itxt{top:170px;height:446px;left:46px;right:46px}")
rr("font-size:1.15em;letter-spacing:.34em;color:#C7D1E3}", "font-size:1.5em;letter-spacing:.3em;color:#D3DBEA}")
rr(".iface.d-a .date{font-family:'Cinzel',Georgia,serif;font-weight:500;font-size:1.45em;letter-spacing:.22em}", ".iface.d-a .date{font-family:'Cinzel',Georgia,serif;font-weight:500;font-size:1.75em;letter-spacing:.2em}")
rr(".iface.d-a .time{font-weight:600;font-size:1.95em;letter-spacing:.04em}", ".iface.d-a .time{font-weight:600;font-size:2.15em;letter-spacing:.04em}")
rr(".iface.d-a .place{font-weight:500;font-size:2.05em}", ".iface.d-a .place{font-weight:500;font-size:2.2em}")
rr(".iface.d-b .itxt{top:222px;height:345px;left:64px;right:64px}", ".iface.d-b .itxt{top:222px;height:372px;left:62px;right:62px}")
rr(".iface.d-b .date{font-weight:600;font-size:1.35em;letter-spacing:.26em}", ".iface.d-b .date{font-weight:600;font-size:1.6em;letter-spacing:.22em}")
rr("font-size:1.45em;letter-spacing:.3em;color:#E3C37E}", "font-size:1.6em;letter-spacing:.28em;color:#E3C37E}")
rr(".iface.d-c .date{font-weight:600;font-size:1.4em;letter-spacing:.16em}", ".iface.d-c .date{font-weight:600;font-size:1.6em;letter-spacing:.14em}")
rr("font-weight:600;font-size:1.15em;letter-spacing:.3em;color:#A8792E}", "font-weight:600;font-size:1.4em;letter-spacing:.28em;color:#A8792E}")
rr(".iface.d-a .rsvp{font-style:italic;font-weight:500;font-size:1.7em;color:#B9C6DD}", ".iface.d-a .rsvp{font-style:italic;font-weight:500;font-size:2em;color:#EEF2F8}")
rr(".iface.d-a .contact{font-weight:600;font-size:1.6em;letter-spacing:.03em;color:#B9C6DD}", ".iface.d-a .contact{font-weight:600;font-size:2em;letter-spacing:.03em;color:#EEF2F8}")
rr(".iface.d-b .note{font-family:'Poiret One',Arial,sans-serif;font-style:normal;font-size:1.65em}", ".iface.d-b .note{font-family:'Poiret One',Arial,sans-serif;font-style:normal;font-size:1.8em}")
rr(".iface.d-b .rsvp{font-family:'Poiret One',Arial,sans-serif;font-style:normal;font-size:1.6em;color:#E3C37E}", ".iface.d-b .rsvp{font-family:'Poiret One',Arial,sans-serif;font-style:normal;font-size:1.8em;color:#E3C37E}")
rr(".iface.d-b .contact{font-weight:400;font-size:1.4em;color:#E3C37E}", ".iface.d-b .contact{font-weight:400;font-size:1.65em;color:#E3C37E}")
rr(".iface.d-c .note{font-style:italic;font-weight:400;font-size:1.65em}", ".iface.d-c .note{font-style:italic;font-weight:400;font-size:1.75em}")
rr("font-size:1.2em;letter-spacing:.16em;text-transform:uppercase;color:#A8792E;margin-top:1.4em}", "font-size:1.2em;letter-spacing:.1em;text-transform:uppercase;color:#A8792E;margin-top:1.4em;text-wrap:balance}")
rr(".iface.d-c .contact{font-weight:400;font-size:1.5em;color:#3A2E20}", ".iface.d-c .contact{font-weight:400;font-size:1.7em;color:#3A2E20}")
rr("font:600 16px/1 'Fraunces',Georgia,serif;padding:13px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.45);background:rgba(25,8,8,.66)", "font:600 16px/1 'Cormorant Garamond',Georgia,serif;font-size:18px;padding:12px 18px;border-radius:999px;border:1px solid rgba(214,222,238,.45);background:rgba(9,11,22,.74)")
rr(".cbtn.shop{background:rgba(203,168,76,.92);color:#2a1408;border-color:rgba(255,255,255,.2)}", ".cbtn.shop{background:rgba(9,11,22,.5);color:#E9D9A8;border-color:rgba(233,217,168,.45);font-weight:500;font-size:16.5px}")
rr(".cbtn.ghost{background:rgba(25,8,8,.45)}", ".cbtn.ghost{background:rgba(9,11,22,.5)}")
rr(".choice{background:rgba(20,8,8,.82)", ".choice{background:rgba(9,11,22,.86)")
rr(".chtitle{font:500 16px/1.35 'Fraunces',Georgia,serif", ".chtitle{font:500 18px/1.35 'Cormorant Garamond',Georgia,serif")
rr("@media (max-width:420px){.cbtn{font-size:15px;padding:12px 15px}}", "@media (max-width:420px){.cbtn{font-size:17px;padding:11px 15px}}")

def f(x, n=3):
    s = ('%.*f' % (n, x)).rstrip('0').rstrip('.'); return '0' if s in ('-0', '') else s
# the slide: constant friction - what is left of the way falls as (1-p)^2; the turn dies out a little earlier
N = 20
kf = []
for i in range(N + 1):
    p = i / N; k = (1 - p) ** 2; kr = (1 - min(1, p / 0.88)) ** 2
    kf.append('%s%%{transform:translate(calc(var(--ax) * %s),calc(var(--ay) * %s)) rotate(calc(var(--ar) * %s)) scale(calc(1 + (var(--as) - 1) * %s))}' % (f(100 * p, 1), f(k, 4), f(k, 4), f(kr, 4), f(k, 4)))
slide = '@keyframes slidein{' + ''.join(kf) + '}'
# loose discs: struck when the leading edge reaches them, they run on a little faster and stop a little beyond it
T = 2.0; TD = 2.4; TL = 720.0
DISC_K = [0.110, 0.062, 0.140]; DISC_G = [30, 20, 38]
push = []; stills = []
for j, (K, G) in enumerate(zip(DISC_K, DISC_G)):
    pc = 1 - math.sqrt(K); tc = pc * T; Dl = K + G / TL; Td = Dl * T / (1.25 * (1 - pc))
    steps = ['0%{transform:translate(0px,0px) rotate(0deg)}', '%s%%{transform:translate(0px,0px) rotate(0deg)}' % f(100 * tc / TD, 2)]
    M = 9
    for i in range(1, M + 1):
        tau = i / M; q = 1 - (1 - tau) ** 2; t = min(tc + tau * Td, TD)
        steps.append('%s%%{transform:translate(calc(var(--tx) * %s + var(--gx) * %s),calc(var(--ty) * %s + var(--gy) * %s)) rotate(calc(var(--dr) * %s))}' % (f(100 * t / TD, 2), f(K * q, 4), f(q, 4), f(K * q, 4), f(q, 4), f(q, 4)))
    if tc + Td < TD - 1e-6: steps.append('100%%{transform:translate(calc(var(--tx) * %s + var(--gx)),calc(var(--ty) * %s + var(--gy))) rotate(var(--dr))}' % (f(K, 4), f(K, 4)))
    push.append('@keyframes push%d{%s}' % (j, ''.join(steps)))
    push.append('.arrive .pd%d{animation:push%d %ss linear .3s both}' % (j, j, f(TD)))
    stills.append('.still .pd%d{transform:translate(calc(var(--tx) * %s + var(--gx)),calc(var(--ty) * %s + var(--gy))) rotate(var(--dr))}' % (j, f(K, 4), f(K, 4)))

top = r'''/* New Year's Eve invitation "Midnight" (27 Nov 2026) - guest page.
   Lettering of this product: Cinzel (engraved capitals: the words on the envelope, the hint) and Cormorant Garamond
   (the buttons) - both SIL OFL, served from fonts/; each of the three faces keeps its own fonts (21 Nov 2026).
   Motion: transform and opacity only (and one z-index step when the invitation leaves the envelope).
   Every glow is a small picture: no gradient larger than the screen is used inside the camera.
   States on #stage: arrive -> landed -> open -> done; still / instant = reduced motion. */
''' + '\n'.join(fonts) + r'''
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#09080a;overflow:hidden;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;-webkit-tap-highlight-color:transparent}
.backdrop{display:none}
#stage{position:absolute;left:50%;top:50%;overflow:hidden;z-index:1;cursor:pointer;background:#09080a}
#stage.done{cursor:default}
/* the table goes into the dark at the edges of the picture, so nothing is ever cut by a line (the envelope comes out of that dark) */
#stage::before{content:"";position:absolute;inset:-2px;z-index:4;pointer-events:none;box-shadow:inset 0 0 46px 28px #09080a}
.edge{position:absolute;left:-2px;right:-2px;z-index:4;pointer-events:none}
.edge.t{top:-2px;background:linear-gradient(#09080a 24%,rgba(9,8,10,.8) 52%,rgba(9,8,10,0))}
.edge.b{bottom:-2px;background:linear-gradient(rgba(9,8,10,0),rgba(9,8,10,.8) 48%,#09080a 76%)}
.cam{position:absolute;inset:0;transform-origin:var(--camo)}
.scene{position:absolute;left:0;top:0;transform-origin:0 0}
.scene img{position:absolute;left:0;top:0;display:block;max-width:none}
.cam>img{position:absolute;display:block;max-width:none;pointer-events:none}
.fw{opacity:0;transform:scale(.3,calc(.3 * var(--fwy)));z-index:1}
.flare{opacity:.3;z-index:1;animation:flick .74s ease-in-out infinite alternate}
.flare.f1{animation-duration:.58s}
.veil{position:absolute;inset:0;background:#06050a;opacity:0;z-index:6;pointer-events:none}
.pd{position:absolute;z-index:1}
.pd img,.cf img{position:absolute;inset:0;width:100%;height:100%;display:block}
#stage:not(.arrive):not(.still) .envroot,#stage:not(.arrive):not(.still) .pd{visibility:hidden}
/* ---------- envelope (312 x 430 units), three sheets of the same place: inside back -> invitation -> FRONT POCKET, flap, band, seal ---------- */
.envroot{position:absolute;width:312px;height:430px;transform-origin:50% 50%;pointer-events:none}
.envroot.rb{z-index:2}.envroot.rc{z-index:3}.envroot.rf{z-index:4}
.slide{position:absolute;inset:0;transform-origin:50% 50%}
.eg{position:absolute;inset:0}
.tl{transform-origin:50% 50%;transform:perspective(1100px) rotateX(var(--tilt))}
.eg img.full{position:absolute;left:0;top:0;width:312px;height:430px;display:block}
.eshadow{position:absolute;left:-34px;top:-34px;width:380px;height:498px;display:block}
.flapBbox{position:absolute;left:-12px;top:-128px;width:336px;height:128px;perspective:1100px;perspective-origin:50% 100%}
.flapin{position:absolute;left:0;top:0;width:336px;height:128px;transform-origin:50% 100%;transform:rotateX(-90deg);opacity:0}
.flapFbox{position:absolute;left:0;top:0;width:312px;height:430px;perspective:1100px;perspective-origin:50% 0}
.flapF{transform-origin:50% 0}
.hand{transform:rotate(-12deg)}
.bandh{position:absolute;top:0;width:156px;height:430px;overflow:hidden}
.bandh.bl{left:0}.bandh.br{left:156px}
.glint{position:absolute;width:140px;height:140px;display:block;opacity:0}
.elabel{position:absolute;left:0;right:0;top:141px;text-align:center;font:500 12.5px/1.2 'Cinzel',Georgia,serif;letter-spacing:.36em;text-indent:.36em;text-transform:uppercase;color:#1b2452;opacity:.74;white-space:nowrap}
.cardrig{position:absolute;left:156px;top:424px;width:0;height:0}
.card{position:absolute;left:-240px;bottom:0;width:480px;height:672px;transform-origin:50% 100%;transform:scale(var(--c0))}
.card::before{content:"";position:absolute;inset:0;box-shadow:0 22px 54px rgba(2,1,4,.82),0 3px 9px rgba(2,1,4,.55);opacity:0}
.paper{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:soft-light;pointer-events:none}
.gloss{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.03) 38%,rgba(255,255,255,0) 60%);pointer-events:none}
.fwl{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.fwl i{position:absolute;display:block;width:150%;height:62%;border-radius:50%;opacity:0}
.fwl .l1{left:-70%;top:-22%;background:radial-gradient(closest-side,rgba(255,214,140,.34),rgba(255,214,140,0))}
.fwl .l2{left:22%;top:20%;background:radial-gradient(closest-side,rgba(226,234,255,.28),rgba(226,234,255,0))}
.fwl .l3{left:-40%;top:58%;background:radial-gradient(closest-side,rgba(150,180,255,.26),rgba(150,180,255,0))}
#stage .itxt{opacity:0}
.conf{position:absolute;inset:0;z-index:5;pointer-events:none}
.cf{position:absolute;opacity:0}
.near{position:absolute;inset:0;overflow:hidden;z-index:3;pointer-events:none}
.nf{position:absolute;display:block;opacity:0}
.hint{position:absolute;z-index:5;text-align:center;font-family:'Cinzel',Georgia,serif;font-weight:500;letter-spacing:.24em;text-transform:uppercase;color:#F4EEE0;text-shadow:0 2px 6px rgba(0,0,0,.95),0 0 18px rgba(0,0,0,.85);opacity:0;transition:opacity .4s;pointer-events:none}
.landed .hint{opacity:1;animation:hintpulse 2.2s ease-in-out infinite}
.open .hint,.wait .hint{opacity:0;animation:none}
#stage.wait{cursor:progress}
/* ---------- 1. ARRIVAL: slid across the marble (2 s of sliding from 0.3 s; the discs it strikes run on to 2.7 s) ---------- */
.arrive .slide{animation:slidein 2s linear .3s both}
''' + slide + '\n' + '\n'.join(push) + '\n' + '\n'.join(stills) + r'''
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes fadeout{from{opacity:1}to{opacity:0}}
@keyframes hintpulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes flick{0%{opacity:.22;transform:scale(.92)}100%{opacity:.42;transform:scale(1.05)}}
/* ---------- 2. MIDNIGHT (tap): the seal's hand reaches twelve, the band slips off, the flap opens;
              3. the invitation slides out of the pocket and comes to the lens; 4. the table celebrates (5.6 s from the tap) ---------- */
.open .cam{animation:camstrike 3.1s linear both}
.open .hand{animation:tick .55s linear .15s both}
.open .glint{animation:strike .8s ease-out .66s both}
.open .bandh.bl{animation:bandl .8s cubic-bezier(.5,0,.3,1) .85s both}
.open .bandh.br{animation:bandr .8s cubic-bezier(.5,0,.3,1) .9s both}
.open .flapsh{animation:fadeout .3s ease-in 1.3s both}
.open .flapF{animation:flapA .4s cubic-bezier(.5,0,.9,.5) 1.3s both}
.open .flapin{animation:flapB .45s cubic-bezier(.1,.5,.4,1) 1.7s both}
.open .cardrig{animation:cardout 1.1s cubic-bezier(.45,0,.3,1) 2s both,cardfin 1.3s cubic-bezier(.45,0,.2,1) 3.1s forwards}
.open .envroot.rc{animation:rcup .01s linear 3.1s both}
.open .cardbox{animation:cardflat 1.3s cubic-bezier(.45,0,.2,1) 3.1s both}
.open .card{animation:cardgrow 1.3s cubic-bezier(.45,0,.2,1) 3.1s both}
.open .card::before{animation:fadein 1.3s ease 3.1s both}
.open .veil{animation:veilin 1.3s ease-in-out 3.1s both}
.open .itxt{animation:fadein .9s ease 4.3s both}
.open .fw{animation:fwpop 1.9s ease-out var(--dl) both,fwloop var(--per) ease-out calc(var(--dl) + 3s) infinite}
.open .flare{animation:flareup 1.3s ease-out .7s both,flick2 .62s ease-in-out 2s infinite alternate}
.open .flare.f1{animation-duration:1.3s,.5s}
.open .cf{animation:cfall var(--du) cubic-bezier(.3,.45,.6,1) var(--dl) both}
.open .cf img{animation:cflip var(--du) cubic-bezier(.3,.45,.6,1) var(--dl) both}
.open .nf{animation:nfall var(--du) linear var(--dl) both}
.open .fwl i{animation:fwlight 3.4s ease-in-out 3.5s infinite}
.open .fwl .l2{animation-delay:4.6s;animation-duration:4.1s}
.open .fwl .l3{animation-delay:5.5s;animation-duration:3.8s}
@keyframes camstrike{0%{transform:scale(1);animation-timing-function:cubic-bezier(.4,0,.2,1)}22.6%{transform:scale(1.5)}42%{transform:scale(1.5);animation-timing-function:cubic-bezier(.42,0,.58,1)}100%{transform:scale(1)}}
@keyframes tick{0%{transform:rotate(-12deg)}16%{transform:rotate(-5deg)}24%{transform:rotate(-6deg)}62%{transform:rotate(-6deg)}80%{transform:rotate(1deg)}90%{transform:rotate(0deg)}100%{transform:rotate(0deg)}}
@keyframes strike{0%{transform:scale(.3) rotate(0deg);opacity:0}30%{transform:scale(1) rotate(20deg);opacity:.95}100%{transform:scale(.7) rotate(46deg);opacity:0}}
@keyframes bandl{0%{transform:translate(0px,0px) rotate(0deg)}100%{transform:translate(-178px,10px) rotate(-7deg)}}
@keyframes bandr{0%{transform:translate(0px,0px) rotate(0deg)}100%{transform:translate(180px,-6px) rotate(5deg)}}
@keyframes flapA{0%{transform:rotateX(0deg);opacity:1}99%{opacity:1}100%{transform:rotateX(90deg);opacity:0}}
@keyframes flapB{0%{transform:rotateX(-90deg);opacity:1}100%{transform:rotateX(0deg);opacity:1}}
@keyframes cardout{0%{transform:translate(0px,0px)}100%{transform:translate(0px,var(--out))}}
@keyframes cardfin{0%{transform:translate(0px,var(--out))}100%{transform:translate(var(--fx),var(--fy))}}
@keyframes cardgrow{0%{transform:rotate(0deg) scale(var(--c0))}100%{transform:rotate(var(--unrot)) scale(var(--c1))}}
@keyframes cardflat{0%{transform:perspective(1100px) rotateX(var(--tilt))}100%{transform:perspective(1100px) rotateX(0deg)}}
@keyframes rcup{from{z-index:3}to{z-index:7}}
@keyframes veilin{from{opacity:0}to{opacity:.4}}
@keyframes fwpop{0%{transform:scale(.3,calc(.3 * var(--fwy)));opacity:0}12%{opacity:.78}45%{opacity:.5}100%{transform:scale(1.15,calc(1.15 * var(--fwy)));opacity:0}}
@keyframes fwloop{0%{transform:scale(.3,calc(.3 * var(--fwy)));opacity:0}5%{opacity:.5}16%{opacity:.32}36%{transform:scale(1.15,calc(1.15 * var(--fwy)));opacity:0}100%{transform:scale(1.15,calc(1.15 * var(--fwy)));opacity:0}}
@keyframes flareup{0%{opacity:.3;transform:scale(1)}22%{opacity:1;transform:scale(1.7)}100%{opacity:.62;transform:scale(1.25)}}
@keyframes flick2{0%{opacity:.5;transform:scale(1.14)}100%{opacity:.74;transform:scale(1.3)}}
@keyframes cfall{0%{transform:translate(var(--ox),var(--oy)) scale(var(--z)) rotate(0deg);opacity:0}30%{opacity:.85}100%{transform:translate(0px,0px) scale(1) rotate(var(--rz));opacity:1}}
@keyframes cflip{0%{transform:rotateX(var(--fl))}100%{transform:rotateX(0deg)}}
@keyframes nfall{0%{transform:translate(0px,0px) rotate(0deg);opacity:0}8%{opacity:var(--o)}92%{opacity:var(--o)}100%{transform:translate(var(--sw),var(--fall)) rotate(150deg);opacity:0}}
@keyframes fwlight{0%{opacity:0}18%{opacity:1}55%{opacity:.35}100%{opacity:0}}
/* reduced motion: no arrival, the finale appears at once and stays calm */
.instant *{animation-duration:.001s!important;animation-delay:0s!important;animation-iteration-count:1!important}
.instant .fw,.instant .nf,.instant .fwl i,.instant .flare{animation:none!important}
@media (prefers-reduced-motion:reduce){.hint,.flare{animation:none!important}}
/* inside-only preview mode */
html.inside-view,body.inside-view{background:transparent}
body.inside-view #ivwrap{position:absolute;left:50%;top:50%;width:480px;height:672px}
body.inside-view #stage,body.inside-view .backdrop,body.inside-view #controls{display:none}
'''
rest += '''
/* buttons (27 Nov 2026): the four answers in two equal columns; "watch again" and "send one like this" are quiet */
.cbtn{text-align:center}
#controls:not(.wide) .crow{display:grid;grid-template-columns:1fr 1fr;width:336px;max-width:100%}
#controls:not(.wide) .crow:last-child{display:flex;width:auto}
#controls:not(.wide) .crow>.cbtn:only-child{grid-column:1/-1}
.cbtn.again,.cbtn.shop{background:transparent;border-color:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;font-size:16px;padding:8px 12px;color:#D9CFB4;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(217,207,180,.45)}
.cbtn.again{text-decoration:none}
#controls:not(.wide) .again .lbl{display:inline}
'''
open(out_dir + '/invite.css', 'w').write(top + rest); print('invite.css', len(top + rest))
