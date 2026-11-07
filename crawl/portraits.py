"""Download student portraits (立绘), downscale and store locally."""
import json, os, io, hashlib, urllib.request, concurrent.futures
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'build', 'students')
OUT = os.path.join(ROOT, 'data', 'build', 'portraits')
CACHE = os.path.join(ROOT, 'cache', 'portraits')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

HDR = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.gamekee.com/'}
WIDTH = 420

urls = []
for f in os.listdir(SRC):
    s = json.load(open(os.path.join(SRC, f), encoding='utf-8'))
    for p in s.get('portraits', []):
        if p.get('url'):
            urls.append(p['url'])
urls = list(dict.fromkeys(urls))
print('portraits', len(urls), flush=True)


def backdrop(size):
    w, h = size
    base = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        base.putpixel((0, y), (int(26 + 10 * t), int(34 + 12 * t), int(48 + 16 * t)))
    return base.resize((w, h), Image.BILINEAR).convert('RGBA')


def work(url):
    key = hashlib.sha1(url.encode()).hexdigest() + '.png'
    cache = os.path.join(CACHE, key)
    h = hashlib.sha1(url.encode()).hexdigest()[:16]
    dest = os.path.join(OUT, h + '.jpg')
    if os.path.exists(dest) and os.path.getsize(dest) > 2000:
        return url, h, os.path.getsize(dest)
    try:
        if not os.path.exists(cache):
            req = urllib.request.Request(url, headers=HDR)
            open(cache, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
        im = Image.open(cache)
        if im.mode in ('P', 'LA'):
            im = im.convert('RGBA')
        elif im.mode != 'RGBA':
            im = im.convert('RGB').convert('RGBA')
        flat = backdrop(im.size)
        flat.alpha_composite(im)
        out = flat.convert('RGB')
        ratio = WIDTH / out.width
        out = out.resize((WIDTH, max(1, int(out.height * ratio))), Image.LANCZOS)
        out.save(dest, 'JPEG', quality=80, optimize=True, progressive=True)
        return url, h, os.path.getsize(dest)
    except Exception as e:  # noqa
        return url, None, str(e)


def main():
    mapping = {}
    total = 0
    fails = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for url, h, size in ex.map(work, urls):
            if h:
                mapping[url] = h
                total += size
            else:
                fails += 1
    json.dump(mapping, open(os.path.join(ROOT, 'data', 'build', 'portraitmap.json'), 'w'), ensure_ascii=False)
    print('mapped', len(mapping), 'fails', fails, 'MB', round(total / 1048576, 2))


if __name__ == '__main__':
    main()
