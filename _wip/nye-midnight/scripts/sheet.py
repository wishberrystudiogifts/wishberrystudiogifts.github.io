import sys, glob
from PIL import Image, ImageDraw
pre, out, cols, th = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
fs = sorted(glob.glob(pre + '-*.png'))
ims = [Image.open(f).convert('RGB') for f in fs]
ims = [i.resize((round(i.width * th / i.height), th), Image.LANCZOS) for i in ims]
w = ims[0].width; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (cols * (w + 6), rows * (th + 6)), (30, 30, 30)); d = ImageDraw.Draw(s)
for k, (f, i) in enumerate(zip(fs, ims)):
    x, y = (k % cols) * (w + 6), (k // cols) * (th + 6); s.paste(i, (x, y)); d.text((x + 4, y + 4), f.rsplit('-', 1)[1][:-4], fill=(255, 255, 0))
s.save(out, quality=86); print(out, s.size)
