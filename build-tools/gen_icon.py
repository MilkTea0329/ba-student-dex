"""Generate the app icon (1024) plus web icons."""
import os, math
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024
img = Image.new('RGB', (S, S), (46, 92, 230))
dr = ImageDraw.Draw(img)

# diagonal gradient
for y in range(S):
    t = y / (S - 1)
    r = int(62 + (30 - 62) * t)
    g = int(130 + (84 - 130) * t)
    b = int(255 + (206 - 255) * t)
    dr.line([(0, y), (S, y)], fill=(r, g, b))

dr = ImageDraw.Draw(img, 'RGBA')

# diagonal light bands (Blue Archive-ish)
band = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
for i, x0 in enumerate(range(-S, S * 2, 190)):
    bd.polygon([(x0, S), (x0 + 74, S), (x0 + 74 + S, 0), (x0 + S, 0)], fill=(255, 255, 255, 9))
img = Image.alpha_composite(img.convert('RGBA'), band)

ov = Image.new('RGBA', (S, S), (0, 0, 0, 0))
dr = ImageDraw.Draw(ov)

# halo rings
for rad, alpha, w in [(344, 30, 7), (436, 16, 5)]:
    dr.ellipse([S / 2 - rad, S / 2 - rad, S / 2 + rad, S / 2 + rad], outline=(255, 255, 255, alpha), width=w)

# 2x2 grid tiles, one gold
tile, gap = 246, 46
ox = (S - (tile * 2 + gap)) / 2
oy = (S - (tile * 2 + gap)) / 2
colors = [
    (255, 255, 255, 247), (255, 255, 255, 158),
    (255, 255, 255, 158), (245, 191, 72, 255),
]
for i in range(4):
    cx = ox + (i % 2) * (tile + gap)
    cy = oy + (i // 2) * (tile + gap)
    dr.rounded_rectangle([cx, cy, cx + tile, cy + tile], radius=62, fill=colors[i])


def star(cx, cy, r, fill):
    pts = []
    for k in range(10):
        ang = -math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.42
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    dr.polygon(pts, fill=fill)


# star inside the gold tile
gx = ox + tile + gap + tile / 2
gy = oy + tile + gap + tile / 2
star(gx, gy, 74, (255, 255, 255, 250))

img = Image.alpha_composite(img.convert('RGBA'), ov)
img = img.convert('RGB').filter(ImageFilter.SMOOTH)

out = os.path.join(ROOT, 'build-tools', 'generated')
os.makedirs(out, exist_ok=True)
img.save(os.path.join(out, 'icon-1024.png'))
for s in (512, 192, 180):
    img.resize((s, s), Image.LANCZOS).save(os.path.join(out, f'icon-{s}.png'))
print('icons written to', out)
