#!/usr/bin/env python3
# New Year's Eve invitation "Midnight" (27 Nov 2026) - the scene and its loose pieces.
#   tall  : nye/src/scene-tall.webp  (ours: Z-Image-Turbo, 1152x2048, seed 20270102) - black marble table from above,
#           a clear lane down the middle (the envelope slides in from the bottom edge)
#   wide  : nye/src/scene-wide.jpg   (the scene the invitation already had, 1728x1296)
# Out (OUT): bg.jpg, bg-land.jpg, bg-blur.jpg, bg-blur-land.jpg (the table out of focus, while the invitation is held up),
#   disc-a.webp, disc-b.webp, disc-s.webp (confetti discs cut from OUR tall scene: pushed by the envelope, and falling at
#   midnight), disc-far.webp (one disc out of focus, close to the lens), star.webp, fw-gold/-silver/-blue.webp
#   (fireworks as they are reflected in polished stone: soft, never sharp), flare.webp (the sparkler flaring up).
# No CSS gradient larger than the screen is used anywhere: every glow is a small picture (PIPELINE 20, rule 6).
import os, sys, json
import numpy as np, cv2
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
tall = Image.open(os.path.join(SRC, 'scene-tall.webp')).convert('RGB')
wide = Image.open(os.path.join(SRC, 'scene-wide.jpg')).convert('RGB')
assert tall.size == (1152, 2048) and wide.size == (1728, 1296)
tall.save(os.path.join(OUT, 'bg.jpg'), quality=86, optimize=True, progressive=True)
wide.save(os.path.join(OUT, 'bg-land.jpg'), quality=86, optimize=True, progressive=True)
def soft(im, sig, dark):
    a = np.asarray(im).astype(np.float32)
    b = cv2.GaussianBlur(a, (0, 0), sig)
    hi = np.clip(cv2.GaussianBlur(np.clip(a - 150, 0, 255), (0, 0), sig * 2.2) * 1.6, 0, 255)      # bright points bloom when out of focus
    return Image.fromarray(np.clip(b * dark + hi, 0, 255).astype(np.uint8))
soft(tall, 9, 0.80).save(os.path.join(OUT, 'bg-blur.jpg'), quality=80, optimize=True, progressive=True)
soft(wide, 9, 0.80).save(os.path.join(OUT, 'bg-blur-land.jpg'), quality=80, optimize=True, progressive=True)

def save(rgba, name, q=88):
    Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name), 'WEBP', quality=q, method=6, alpha_quality=95)
T = np.asarray(tall).astype(np.float32)
def disc(cx, cy, r, name, size=96, blur=0.0, gain=1.0, silver=False):
    p = int(r + 6); c = T[cy - p:cy + p, cx - p:cx + p].copy()
    if silver:                                        # the dull bronze disc of the photo becomes silver foil (on pearl paper bronze read as a stain)
        g = c.mean(2, keepdims=True); c = np.clip((g - g.mean()) * 1.6 + 132, 50, 226) * np.array([0.98, 0.99, 1.03], np.float32)
    yy, xx = np.mgrid[0:2 * p, 0:2 * p].astype(np.float32); d = np.hypot(xx - p + .5, yy - p + .5)
    al = np.clip((r - 1.5 - d) / 1.6 + .5, 0, 1)
    rgba = np.dstack([c * gain, al * 255])
    if not blur:                                      # a small soft shadow under the disc (seen when it lies on the pearl envelope)
        shd = np.clip(cv2.GaussianBlur(np.roll(np.roll(al, 3, 0), -3, 1), (0, 0), 2.6) * 0.6, 0, 1) * (1 - al)
        rgba = np.dstack([c * gain * al[..., None], np.maximum(al, shd) * 255])
    rgba = cv2.resize(rgba, (size, size), interpolation=cv2.INTER_AREA)
    if blur:
        pad = int(blur * 3); big = np.zeros((size + 2 * pad, size + 2 * pad, 4), np.float32); big[pad:-pad, pad:-pad] = rgba
        a = big[..., 3:] / 255; pm = cv2.GaussianBlur(big[..., :3] * a, (0, 0), blur); ab = cv2.GaussianBlur(a[..., 0], (0, 0), blur)[..., None]
        rgba = np.dstack([pm / np.maximum(ab, 1e-3), ab * 255])
    save(rgba, name)
disc(172, 1323, 44, 'disc-a.webp', gain=1.12)
disc(248, 1858, 48, 'disc-b.webp', gain=1.12)
disc(130, 1643, 46, 'disc-s.webp', gain=1.3, silver=True)
def bokeh(name, n=160):                               # a disc close to the lens: an even, bright circle with a soft rim (out of focus), not a smudge
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); d = np.hypot(xx - n / 2 + .5, yy - n / 2 + .5) / (n / 2)
    a = np.clip((0.86 - d) / 0.16, 0, 1) * (0.62 + 0.38 * np.clip((d - 0.55) / 0.3, 0, 1))
    col = np.array([238, 190, 96], np.float32)[None, None] * (0.92 + 0.08 * (1 - yy / n))[..., None]
    save(np.dstack([np.broadcast_to(col, (n, n, 3)), a * 255]), name)
bokeh('disc-far.webp')

# a small gold foil star
def star(name, n=72):
    yy, xx = np.mgrid[0:n * 4, 0:n * 4].astype(np.float32); c = n * 2
    ang = np.arctan2(yy - c, xx - c) + np.pi / 2; rad = np.hypot(xx - c, yy - c) / (n * 2)
    k = np.cos(np.mod(ang, 2 * np.pi / 5) - np.pi / 5)
    edge = 0.36 / np.maximum(np.cos(np.abs(np.mod(ang, 2 * np.pi / 5) - np.pi / 5) * 1.0 - 0.0) + 0.92 * np.abs(np.sin(np.mod(ang, 2 * np.pi / 5) - np.pi / 5)) * 1.9, 1e-3)
    al = np.clip((edge * 0.92 - rad) * n * 2 / 4 + .5, 0, 1)
    g = cv2.GaussianBlur(np.random.default_rng(5).standard_normal(al.shape).astype(np.float32), (0, 0), 6)
    col = np.array([226, 178, 78], np.float32)[None, None] * (1 + 0.16 * g[..., None]) * (0.9 + 0.25 * (1 - yy / (n * 4)))[..., None]
    save(cv2.resize(np.dstack([col, al * 255]), (n, n), interpolation=cv2.INTER_AREA), name)
star('star.webp')

# fireworks as a polished table shows them: no drawn burst - a wash of coloured light blooming in the stone, with a
# scatter of soft points in it (sparks out of focus); three different pictures
def firework(name, col, seed, n=384):
    r = np.random.default_rng(seed); c = n / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); d = np.hypot(xx - c, yy - c) / (n / 2)
    a = 0.46 * np.exp(-(d / 0.46) ** 2) + 0.16 * np.exp(-(d / 0.8) ** 2)
    pts = np.zeros((n, n), np.float32)
    for i in range(70 + 20 * (seed % 3)):
        rr = (r.random() ** 0.6) * 0.8 * (n / 2); th = r.random() * 2 * np.pi
        cv2.circle(pts, (int(c + np.cos(th) * rr), int(c + np.sin(th) * rr)), int(1 + r.integers(0, 3)), float(0.35 + 0.65 * r.random()), -1, cv2.LINE_AA)
    a = a + cv2.GaussianBlur(pts, (0, 0), 3.4) * 1.5 + cv2.GaussianBlur(pts, (0, 0), 9) * 2.2
    a = np.clip(a, 0, 1) * np.clip((1 - d) / 0.35, 0, 1)
    rgb = np.array(col, np.float32)[None, None] * (0.8 + 0.2 * np.clip(a * 1.4, 0, 1))[..., None]
    save(np.dstack([np.clip(rgb, 0, 255), a * 255]), name, q=82)
firework('fw-gold.webp', (255, 200, 112), 1)
firework('fw-silver.webp', (224, 232, 250), 2)
firework('fw-blue.webp', (140, 172, 255), 3)

# the sparkler flaring up: warm glow with a few rays
def flare(name, n=320):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32); c = n / 2; d = np.hypot(xx - c, yy - c) / (n / 2); th = np.arctan2(yy - c, xx - c)
    r = np.random.default_rng(8); a = 0.9 * np.exp(-(d / 0.20) ** 2) + 0.42 * np.exp(-(d / 0.55) ** 2)
    for i in range(14):
        t0 = r.random() * 2 * np.pi; w = 0.012 + 0.02 * r.random(); L = 0.45 + 0.5 * r.random()
        dd = np.abs(np.angle(np.exp(1j * (th - t0))))
        a += 0.55 * np.exp(-(dd / w) ** 2) * np.clip(1 - d / L, 0, 1) ** 1.5
    a = np.clip(cv2.GaussianBlur(a, (0, 0), 1.4), 0, 1) * np.clip((1 - d) / 0.1, 0, 1)
    rgb = np.dstack([np.full_like(a, 255), 214 + 36 * np.clip(a, 0, 1), 150 + 90 * np.clip(a * 1.2 - .2, 0, 1)])
    save(np.dstack([rgb, a * 255]), name, q=84)
flare('flare.webp')

geom = {
  'tall': {'w': 1152, 'h': 2048, 'sparklers': [[1121, 870], [1068, 1554]], 'rest': [560, 1040]},
  'wide': {'w': 1728, 'h': 1296, 'sparklers': [[1240, 828]], 'rest': [760, 640]},
}
json.dump(geom, open(os.path.join(OUT, 'geom-scene.json'), 'w'), indent=1)
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(os.path.join(OUT, f)))
