#!/usr/bin/env python3
# New Year's Eve invitation "Midnight" (27 Nov 2026) - the product's OWN envelope, computed layer by layer.
# Pearl paper with a fine linen weave and a little shimmer, portrait 5.25 x 7.25 in (312 x 430 units), a wide shallow
# flap with rounded corners on the short top edge, midnight-navy liner with small silver and gold stars, closed by a
# wide navy velvet band around the middle with a round silver clock seal whose hands stand at two minutes to twelve.
# Nothing is cut from another product's envelope (PRAVILA 5); shared on purpose: the shop signature (blind embossed).
# The light is the scene's: dim room, sparklers burning on the right - the right side of the paper is warm and lit,
# the left falls off cool and darker (so the envelope never glows like a sticker on the black marble).
# Layers -> OUT: env-back (inside back + liner), env-flapin (open flap, liner side), env-pocket (front pocket),
# env-flap (closed flap), env-flapshadow, env-band (velvet band + its shadow), env-seal (bezel, dial, hour hand),
# env-hand (minute hand at twelve; turned by CSS about the seal's centre), env-dropshadow (contact shadow on the table),
# env-streak (the closed envelope smeared along its travel: shown while it slides fast), closed.png (for checks).
import os, sys
import numpy as np, cv2
from PIL import Image
OUT, SIG = sys.argv[1], sys.argv[2]
S = int(os.environ.get('ENV_S', 3)); W, H = 312, 430
F = 112                      # flap depth
SC, SR = (156.0, 214.0), 36.0   # seal centre and radius
BT, BB = 191.0, 237.0        # velvet band: top and bottom
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(2027)
def grid(w=W, h=H, x0=0.0, y0=0.0):
    yy, xx = np.mgrid[0:int(h * S), 0:int(w * S)].astype(np.float32); return (xx + .5) / S + x0, (yy + .5) / S + y0
def aa(d): return np.clip(0.5 - np.asarray(d, np.float32) * S, 0, 1)
def blur(a, sig): return cv2.GaussianBlur(np.asarray(a, np.float32), (0, 0), sig * S)
def noise(shape, sig, seed):
    n = cv2.GaussianBlur(np.random.default_rng(seed).standard_normal(shape).astype(np.float32), (0, 0), sig); return n / (n.std() + 1e-6)
def save(rgb, al, name, q=86):
    rgb = cv2.GaussianBlur(np.asarray(rgb, np.float32), (0, 0), 0.3 * S); al = cv2.GaussianBlur(np.asarray(al, np.float32), (0, 0), 0.3 * S)
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8), 'RGBA')
    im.save(os.path.join(OUT, name), 'WEBP' if name.endswith('.webp') else 'PNG', **(dict(quality=q, method=6, alpha_quality=92) if name.endswith('.webp') else dict(optimize=True)))
    return im
xx, yy = grid()
def rrect(x0, y0, x1, y1, r, X=None, Y=None):
    X = xx if X is None else X; Y = yy if Y is None else Y
    qx = np.abs(X - (x0 + x1) / 2) - ((x1 - x0) / 2 - r); qy = np.abs(Y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
def seg_d(X, Y, p, q):
    px, py = X - p[0], Y - p[1]; dx, dy = q[0] - p[0], q[1] - p[1]
    t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1); return np.hypot(px - t * dx, py - t * dy)

# ---------- the scene's light on the envelope (closed orientation)
u = np.clip(xx / W, 0, 1)
LF = (0.50 + 0.50 * u ** 1.15) * (1.02 - 0.06 * yy / H)
GL = np.exp(-((1 - u) / 0.40) ** 2)                                   # the sparklers' glow on the side that faces them
SH = 0.05 * np.exp(-(((xx - 0.72 * yy) - 60) / 46.0) ** 2)             # a pearl sheet has a soft satin sheen
TINT = (1 - u)[..., None] * np.array([0.93, 0.955, 1.0], np.float32) + u[..., None] * np.array([1.07, 0.965, 0.83], np.float32)
LIGHT = (LF + SH)[..., None] * TINT * (1 + GL[..., None] * np.array([0.10, -0.02, -0.20], np.float32))
light = np.array([0.82, -0.42]); light /= np.hypot(*light)
def edge_light(d, width=1.3, amt=0.10):
    d = np.asarray(d, np.float32); gx = cv2.Sobel(d, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(d, cv2.CV_32F, 0, 1, ksize=3); n = np.hypot(gx, gy) + 1e-6
    f = (gx / n * light[0] + gy / n * light[1]); rim = np.clip(1 + d / width, 0, 1) * (d < 0)
    return 1 + amt * f * rim

# ---------- pearl paper: linen weave, grain, mottling, shimmer
PEARL = np.array([229, 228, 230], np.float32)
def pearl(seed, tone=1.0):
    sh = xx.shape
    wob = noise(sh, 9 * S, seed) * 0.5
    weave = 0.021 * np.sin((xx + wob) * 2 * np.pi / 1.05) * (0.7 + 0.3 * noise(sh, 3 * S, seed + 1)) + 0.021 * np.sin((yy + wob.T[:sh[0], :sh[1]] if False else yy) * 2 * np.pi / 1.05) * (0.7 + 0.3 * noise(sh, 3 * S, seed + 2))
    t = weave + 0.022 * noise(sh, 0.55, seed + 3) + 0.02 * noise(sh, 40 * S / 3, seed + 4) + 0.012 * noise(sh, 6 * S, seed + 6)
    sp = (np.random.default_rng(seed + 5).random(sh) < 0.0035).astype(np.float32); sp = cv2.GaussianBlur(sp, (0, 0), 0.6) * 2.2      # mica shimmer
    return PEARL[None, None, :] * tone * (1 + t[..., None]) + 34 * sp[..., None] * np.array([1.0, 0.97, 0.9], np.float32)

# ---------- liner: midnight navy with small silver and gold stars
def star_mask(X, Y, cx, cy, r, rot):
    ang = np.arctan2(Y - cy, X - cx) + rot; rad = np.hypot(X - cx, Y - cy)
    a = np.abs(np.mod(ang, 2 * np.pi / 5) - np.pi / 5)
    lim = r * 0.40 / np.maximum(np.cos(a) + 1.25 * np.sin(a) * 0.0 + np.sin(a) * 1.18, 1e-3) * 1.0
    return np.clip((np.minimum(lim, r) - rad) * S + .5, 0, 1)
def liner(X, Y, seed):
    sh = X.shape
    base = np.array([20, 28, 68], np.float32)[None, None] * (1 + 0.035 * noise(sh, 0.6, seed)[..., None] + 0.05 * noise(sh, 30, seed + 1)[..., None])
    r = np.random.default_rng(seed + 2); pts = []
    tries = 0
    while len(pts) < 96 and tries < 6000:
        tries += 1; p = (r.uniform(4, W - 4), r.uniform(-4, H))
        if all(np.hypot(p[0] - q[0], p[1] - q[1]) > 17 for q in pts): pts.append(p)
    out = base.copy()
    for i, (cx, cy) in enumerate(pts):
        rr = r.choice([4.2, 5.4, 6.8, 8.6], p=[.34, .34, .22, .1]); gold = r.random() < 0.42
        x0, x1 = int(max(0, (cx - X[0, 0] - rr - 1) * S)), int(min(sh[1], (cx - X[0, 0] + rr + 1) * S)); y0, y1 = int(max(0, (cy - Y[0, 0] - rr - 1) * S)), int(min(sh[0], (cy - Y[0, 0] + rr + 1) * S))
        if x1 <= x0 or y1 <= y0: continue
        m = star_mask(X[y0:y1, x0:x1], Y[y0:y1, x0:x1], cx, cy, rr, r.uniform(0, 6.28))[..., None]
        col = np.array([222, 180, 96] if gold else [214, 220, 232], np.float32) * (0.9 + 0.2 * r.random())
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - m) + col * m
    return out

BODY = rrect(1.6, 1.6, W - 1.6, H - 1.6, 3.0)
FLAP = np.maximum(rrect(1.6, -70, W - 1.6, F, 30.0), BODY)
THROAT = np.minimum(yy - 84.0, np.hypot(xx - W / 2, yy - 84.0) - 13.0)   # the pocket's top edge: straight, with a round thumb notch in the middle                                                    # < 0 above the edge (open throat)

# ---------- shop signature, blind embossed
def signature():
    m = np.asarray(Image.open(SIG).convert('L')).astype(np.float32) / 255
    bw, bh = 121 * S, round(25.67 * S); m = cv2.resize(m, (bw, bh), interpolation=cv2.INTER_AREA)
    full = np.zeros((H * S, W * S), np.float32); x0, y0 = round(95.67 * S), round(389.33 * S); full[y0:y0 + bh, x0:x0 + bw] = m
    hgt = blur(full, 0.2); gx = cv2.Sobel(hgt, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(hgt, cv2.CV_32F, 0, 1, ksize=3)
    return 1 + np.clip((gx * light[0] + gy * light[1]) * -0.42, -0.15, 0.10) - blur(full, 0.15) * 0.05

# ---------- POCKET (front): four seams meeting under the seal, bottom flap on top
pk = pearl(1)
C0 = (W / 2, 214.0)
for p, sg in (((0, 70), 1.0), ((W, 70), -1.0)):                     # side seams: soft folds, the side that faces the sparklers a little lighter
    d = seg_d(xx, yy, p, C0); side = np.sign((xx - p[0]) * (C0[1] - p[1]) - (yy - p[1]) * (C0[0] - p[0])) * sg
    pk *= (1 - 0.085 * np.exp(-(d / 1.3) ** 2) + 0.05 * side * np.exp(-((d - 2.4) / 1.6) ** 2))[..., None]
bf = np.maximum(-(xx * (H - C0[1]) / (W / 2) - (H - yy)) , -((W - xx) * (H - C0[1]) / (W / 2) - (H - yy)))   # < 0 inside the bottom flap triangle
bfn = bf / np.hypot(1, (H - C0[1]) / (W / 2))
pk *= (1 + 0.03 * np.clip(-bfn / 40, 0, 1))[..., None]
pk *= (1 - 0.22 * np.exp(-np.maximum(bfn, 0) / 2.6) * (bfn > 0) * (yy > C0[1] - 4))[..., None]
pk *= (1 + 0.06 * np.exp(-((bfn + 1.2) / 1.2) ** 2))[..., None]
pk *= signature()[..., None]
pal = aa(BODY) * aa(-THROAT)
pk *= edge_light(np.maximum(BODY, -THROAT), 1.3, 0.07)[..., None]
pk *= LIGHT
vsh = np.clip(blur(aa(-THROAT), 2.4) * 1.1 - 0.06, 0, 0.55) * aa(THROAT) * aa(BODY)      # the pocket's edge shades what lies inside
save(np.where(pal[..., None] > 0.001, pk, 0), np.maximum(pal, vsh), 'env-pocket.webp')

# ---------- BACK (inside back panel, lined)
LN = liner(xx, yy, 11)
bk = pearl(2, 0.9)
la = aa(np.maximum(BODY + 7.0, -(yy - 0.5)))
bk = bk * (1 - la[..., None]) + LN * la[..., None]
bk *= LIGHT * (0.78 + 0.22 * np.clip(yy / 60, 0, 1))[..., None]
save(bk, aa(BODY) * (yy < 112), 'env-back.webp')

# ---------- FLAP closed (outside)
fl = pearl(3, 1.03)
fl *= edge_light(FLAP, 1.5, 0.12)[..., None]
fl *= (1.02 - 0.04 * yy / F)[..., None] * LIGHT
fal = aa(FLAP)
save(fl, fal, 'env-flap.webp')
fs = blur(np.roll(np.roll(fal, round(2.6 * S), 0), round(-1.4 * S), 1), 2.4) * 0.40 + blur(np.roll(fal, round(0.9 * S), 0), 0.8) * 0.22
save(np.zeros(fs.shape + (3,), np.float32), np.clip(fs * aa(BODY) * (1 - fal), 0, 1), 'env-flapshadow.png')

# ---------- FLAP open, liner side: drawn in closed orientation, then mirrored about the hinge (tip up)
fi = pearl(4, 0.97)
fa = aa(np.maximum(FLAP + 8.0, -(yy - 0.5)))
fi = fi * (1 - fa[..., None]) + liner(xx, yy, 23) * fa[..., None]
fi *= edge_light(FLAP, 1.2, 0.08)[..., None]
fi *= LIGHT * (0.56 + 0.44 * np.clip(yy / 30, 0, 1) ** 0.8)[..., None] * (1 + 0.07 * np.clip(yy / F, 0, 1))[..., None]      # deep shade at the hinge, the lip catches the light
rows = int(F * S); PX, PY = 12 * S, 16 * S                           # padded: the open flap lies on the table and has its own shadow
frgb = np.zeros((rows + PY, W * S + 2 * PX, 3), np.float32); fal2 = np.zeros((rows + PY, W * S + 2 * PX), np.float32)
frgb[PY:, PX:PX + W * S] = fi[:rows][::-1]; fal2[PY:, PX:PX + W * S] = fal[:rows][::-1]
fsh = np.clip(blur(np.roll(np.roll(fal2, round(-3.0 * S), 1), round(2.0 * S), 0), 3.2) * 0.6 + blur(fal2, 1.0) * 0.45, 0, 0.85) * (1 - fal2)
save(frgb * fal2[..., None], np.maximum(fal2, fsh), 'env-flapin.webp')

# ---------- velvet BAND around the middle (+ its shadow on the paper)
bd = np.maximum(np.maximum(BT - yy, yy - BB), BODY - 0.6)
ba = aa(bd)
v = (yy - BT) / (BB - BT)
nap = cv2.GaussianBlur(np.random.default_rng(31).standard_normal(xx.shape).astype(np.float32), (0, 0), sigmaX=0.5, sigmaY=5 * S); nap /= nap.std() + 1e-6
fine = noise(xx.shape, 0.7, 32)
sheen = 0.78 * np.exp(-((v - 0.30) / 0.18) ** 2) + 0.2 * np.exp(-((v - 0.82) / 0.10) ** 2)
velvet = np.array([24, 33, 78], np.float32)[None, None] * (0.72 + sheen + 0.10 * nap + 0.07 * fine)[..., None]
velvet *= (1 - 0.55 * np.exp(-np.minimum(xx, W - xx) / 4.5))[..., None]                    # it turns round the edges
velvet *= (0.75 + 0.35 * u)[..., None] * (1 - u[..., None] * np.array([0.0, 0.06, 0.22], np.float32))
velvet += 26 * (np.exp(-np.abs(yy - BT - 0.9) / 0.5) + 0.6 * np.exp(-np.abs(yy - BB + 0.9) / 0.5))[..., None] * np.array([0.6, 0.7, 1.0], np.float32)   # stitched edges
bsh = (blur(np.roll(np.roll(ba, round(3.0 * S), 0), round(-1.8 * S), 1), 2.4) * 0.6 + blur(ba, 0.7) * 0.3) * aa(BODY) * (1 - ba)
save(velvet * ba[..., None], np.maximum(ba, np.clip(bsh, 0, 1)), 'env-band.webp')

# ---------- SEAL: a small silver clock (bezel, ivory dial, batons, hour hand at twelve)
dc = np.hypot(xx - SC[0], yy - SC[1]); ang = np.arctan2(yy - SC[1], xx - SC[0])
sa = aa(dc - SR)
RI = SR - 6.5
bez = 176 + 46 * np.cos(2 * ang - 0.9) + 24 * np.cos(6 * ang + 0.4) + 6 * noise(xx.shape, 0.6, 41)
nb = (dc - (SR + RI) / 2) / ((SR - RI) / 2)                          # -1 inner lip .. +1 outer rim
bez = bez * (0.80 + 0.30 * (1 - nb ** 2)) + 50 * np.exp(-((nb + 0.55) / 0.22) ** 2) * (0.5 + 0.5 * np.cos(ang - np.arctan2(light[1], light[0])))
bez -= 40 * np.clip(nb - 0.75, 0, 1) * 4
seal = np.dstack([bez * 0.985, bez * 0.99, bez * 1.02])
dial = np.array([240, 235, 224], np.float32)[None, None] * (1 - 0.07 * (dc / RI) ** 2)[..., None] * (1 + 0.012 * noise(xx.shape, 0.6, 42))[..., None]
dial *= (1 - 0.38 * np.exp(-np.maximum(RI - dc, 0) / 1.6) * (dc < RI))[..., None]                      # the bezel shades the rim of the dial
ink = np.zeros(xx.shape, np.float32)
for k in range(60):
    th = 2 * np.pi * k / 60 - np.pi / 2; c, s_ = np.cos(th), np.sin(th)
    if k % 5 == 0:
        r0, r1, wd = RI - 9.5, RI - 3.2, (0.9 if k else 0.0)
        if k == 0:
            for off in (-1.5, 1.5):
                px, py = -s_ * off, c * off
                ink = np.maximum(ink, aa(seg_d(xx, yy, (SC[0] + c * r0 + px, SC[1] + s_ * r0 + py), (SC[0] + c * r1 + px, SC[1] + s_ * r1 + py)) - 0.7))
        else:
            ink = np.maximum(ink, aa(seg_d(xx, yy, (SC[0] + c * r0, SC[1] + s_ * r0), (SC[0] + c * r1, SC[1] + s_ * r1)) - wd * (1.0 if k % 15 == 0 else 0.62)))
    else:
        ink = np.maximum(ink, 0.55 * aa(seg_d(xx, yy, (SC[0] + c * (RI - 4.6), SC[1] + s_ * (RI - 4.6)), (SC[0] + c * (RI - 3.2), SC[1] + s_ * (RI - 3.2))) - 0.22))
INK = np.array([26, 30, 52], np.float32)
dial = dial * (1 - ink[..., None]) + INK * ink[..., None]
def hand(length, back, w0, w1, deg):
    th = np.deg2rad(deg) - np.pi / 2; c, s_ = np.cos(th), np.sin(th)
    X = (xx - SC[0]) * c + (yy - SC[1]) * s_; Y = -(xx - SC[0]) * s_ + (yy - SC[1]) * c
    t = np.clip((X + back) / (length + back), 0, 1); wd = w0 + (w1 - w0) * t
    d = np.maximum(np.maximum(-back - X, X - length), np.abs(Y) - wd)
    return aa(d)
hh = hand(13.5, 3.0, 1.9, 1.0, -1.0)
hsh = blur(np.roll(np.roll(hh, round(0.9 * S), 0), round(-0.6 * S), 1), 0.5) * 0.35
dial = dial * (1 - hsh[..., None]); dial = dial * (1 - hh[..., None]) + INK * hh[..., None]
dm = aa(dc - RI)[..., None]
seal = seal * (1 - dm) + dial * dm
gl = np.clip(1 - np.abs(dc - RI * 0.62) / 5.0, 0, 1) * np.clip(np.cos(ang - np.arctan2(light[1], light[0])) - 0.55, 0, 1) * 2.2      # glass highlight
seal = seal + 60 * (gl * (dc < RI))[..., None]
seal *= (0.80 + 0.26 * u)[..., None] * (1 - u[..., None] * np.array([0.0, 0.04, 0.14], np.float32))
ssh = (blur(np.roll(np.roll(sa, round(2.8 * S), 0), round(-1.8 * S), 1), 2.6) * 0.55 + blur(sa, 0.8) * 0.3) * (1 - sa)
save(seal * sa[..., None], np.maximum(sa, np.clip(ssh, 0, 1) * aa(BODY)), 'env-seal.webp', q=90)
# minute hand (at twelve) with the centre cap
mh = hand(RI - 6.0, 4.5, 1.25, 0.6, 0.0)
cap = aa(dc - 2.6)
hm = np.maximum(mh, cap)
hrgb = np.where(cap[..., None] > 0.5, np.array([168, 172, 184], np.float32) * (0.8 + 0.4 * np.clip((SC[1] - yy + 2) / 4, 0, 1))[..., None], INK[None, None])
msh = blur(np.roll(np.roll(hm, round(1.2 * S), 0), round(-0.8 * S), 1), 0.6) * 0.4 * (1 - hm) * aa(dc - RI)
save(hrgb * hm[..., None], np.maximum(hm, msh), 'env-hand.webp', q=92)

# ---------- contact shadow on the table (padded 24 units all round)
P = 34; xs, ys = grid(W + 2 * P, H + 2 * P, -P, -P)
body_p = aa(rrect(1.6, 1.6, W - 1.6, H - 1.6, 3.0, xs, ys))
sh = blur(np.roll(np.roll(body_p, round(6.0 * S), 0), round(-8.0 * S), 1), 9.0) * 0.66 + blur(np.roll(np.roll(body_p, round(1.2 * S), 0), round(-1.6 * S), 1), 1.2) * 0.85      # wide soft ambient + tight contact, both away from the sparklers
sh = np.clip(sh, 0, 0.94)
save(np.zeros(sh.shape + (3,), np.float32), sh, 'env-dropshadow.png')

# ---------- the closed envelope, for checks and for the streak shown while it slides fast
def over(dst, name):
    im = np.asarray(Image.open(os.path.join(OUT, name)).convert('RGBA')).astype(np.float32); a = im[..., 3:] / 255
    dst[..., :3] = dst[..., :3] * (1 - a) + im[..., :3] * a; dst[..., 3:] = dst[..., 3:] + a * (1 - dst[..., 3:]); return dst
cl = np.zeros((H * S, W * S, 4), np.float32)
for n in ('env-pocket.webp', 'env-flapshadow.png', 'env-flap.webp', 'env-band.webp', 'env-seal.webp', 'env-hand.webp'): cl = over(cl, n)
Image.fromarray(np.dstack([np.clip(cl[..., :3], 0, 255), np.clip(cl[..., 3], 0, 1) * 255]).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'closed.png'))
sm = cv2.GaussianBlur(cl, (0, 0), 1.6 * S)        # the afterimage shown while it slides fast: the closed envelope, a little soft
save(sm[..., :3], sm[..., 3], 'env-closed.webp', q=78)
for f in sorted(os.listdir(OUT)):
    if f.startswith('env-') or f == 'closed.png': print(f, os.path.getsize(os.path.join(OUT, f)))
