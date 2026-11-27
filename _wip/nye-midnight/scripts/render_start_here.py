# START-HERE PDF, PHONE format (v2, 24 Nov 2026; P-261121-1): ONE page 5.5 x 8.5 in, links stay clickable.
# Usage: python3 render_start_here.py <start-here.html> <out.pdf> [expected link address]
# The tool FITS the page (tightens spacing, line height, body size down to 14 pt, the picture, then a narrower Barlow)
# and REFUSES to write the PDF if: the content does not fit on the one page, any text is under 14 pt, the button is
# under 20 pt, a font did not load, or the two links do not point to the expected address.
import asyncio, sys, os, json
from playwright.async_api import async_playwright
src, out = sys.argv[1], sys.argv[2]
expect = sys.argv[3] if len(sys.argv) > 3 else None
PRESETS = [dict(fs=19.4, lh=1.22, g=1.0, thumb=88), dict(fs=19.0, lh=1.2, g=0.9, thumb=84), dict(fs=18.7, lh=1.18, g=0.8, thumb=78),
           dict(fs=18.7, lh=1.15, g=0.65, thumb=72), dict(fs=18.7, lh=1.12, g=0.5, thumb=64)]
FIT = """(v) => { const r = document.documentElement.style;
  r.setProperty('--fs', v.fs + 'px'); r.setProperty('--lh', v.lh); r.setProperty('--g', v.g); r.setProperty('--thumb', v.thumb + 'px'); r.setProperty('--body', "'" + v.body + "'");
  const pg = document.querySelector('.page').getBoundingClientRect(), fl = document.querySelector('.flow').getBoundingClientRect();
  return { room: pg.bottom - fl.bottom, wide: document.querySelector('.page').scrollWidth - document.querySelector('.page').clientWidth }; }"""
CHECK = """() => { let min = 1e9, where = ''; const w = document.createTreeWalker(document.querySelector('.page'), NodeFilter.SHOW_TEXT); let n;
  while (n = w.nextNode()) { if (!n.textContent.trim()) continue; const s = parseFloat(getComputedStyle(n.parentElement).fontSize); if (s < min) { min = s; where = n.textContent.trim().slice(0, 30); } }
  const b = document.querySelector('.btn');
  return { min, where, btn: parseFloat(getComputedStyle(b).fontSize), links: [...document.querySelectorAll('a')].map(a => a.href),
    fonts: ["400 19px 'Barlow Semi Condensed'", "700 19px 'Barlow Semi Condensed'", "400 19px 'Barlow Condensed'", "600 19px Lora"].map(f => document.fonts.check(f)),
    img: [...document.images].every(i => i.complete && i.naturalWidth > 0) }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 528, 'height': 816})
        await pg.goto('file://' + os.path.abspath(src))
        await pg.evaluate("Promise.all([document.fonts.load(\"400 19px 'Barlow Semi Condensed'\"), document.fonts.load(\"600 19px 'Barlow Semi Condensed'\"), document.fonts.load(\"700 19px 'Barlow Semi Condensed'\"), document.fonts.load(\"400 19px 'Barlow Condensed'\"), document.fonts.load(\"600 19px 'Barlow Condensed'\"), document.fonts.load(\"700 19px 'Barlow Condensed'\"), document.fonts.load('600 19px Lora')])")
        await pg.evaluate('document.fonts.ready')
        chosen = None
        for body in ('Barlow Semi Condensed', 'Barlow Condensed'):
            for v in PRESETS:
                v = dict(v, body=body)
                r = await pg.evaluate(FIT, v)
                if r['room'] >= 9 and r['wide'] <= 0:
                    chosen = (v, r); break
            if chosen: break
        assert chosen, 'the content does not fit on one 5.5 x 8.5 in page even at the tightest setting - shorten the text'
        c = await pg.evaluate(CHECK)
        assert c['min'] >= 18.66, 'text under 14 pt: %.2f px at "%s"' % (c['min'], c['where'])
        assert c['btn'] >= 26.66, 'button under 20 pt: %.2f px' % c['btn']
        assert all(c['fonts']), 'a font did not load: %s' % c['fonts']
        assert c['img'], 'the picture did not load'
        assert len(c['links']) == 2 and c['links'][0] == c['links'][1], 'expected two equal links: %s' % c['links']
        if expect: assert c['links'][0] == expect, 'link is %s, expected %s' % (c['links'][0], expect)
        await pg.wait_for_timeout(200)
        await pg.pdf(path=out, width='5.5in', height='8.5in', print_background=True)
        await b.close()
        print(json.dumps({'pdf': out, 'fit': chosen[0], 'room_px': round(chosen[1]['room'], 1), 'min_text_pt': round(c['min'] * 0.75, 2), 'button_pt': round(c['btn'] * 0.75, 2), 'link': c['links'][0]}))
asyncio.run(main())
