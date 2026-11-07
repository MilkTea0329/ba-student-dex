"""Download student avatars, downscale them and store as JPEG for bundling."""
import json, os, io, hashlib, urllib.request, concurrent.futures
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = json.load(open(os.path.join(ROOT, 'data', 'build', 'index.json'), encoding='utf-8'))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'data', 'build', 'avatars')
CACHE = os.path.join(ROOT, 'cache', 'avatars')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

HDR = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.gamekee.com/'}
SIZE = (320, 360)


def fetch(url):
    key = hashlib.sha1(url.encode()).hexdigest() + '.png'
    p = os.path.join(CACHE, key)
    if os.path.exists(p):
        return open(p, 'rb').read()
    req = urllib.request.Request(url, headers=HDR)
    data = urllib.request.urlopen(req, timeout=40).read()
    open(p, 'wb').write(data)
    return data


def work(item):
    sid = item['id']
    raw = json.load(open(os.path.join(RAW, f'{sid}.json'), encoding='utf-8'))
    url = raw['icon']
    if url.startswith('//'):
        url = 'https:' + url
    dest = os.path.join(OUT, f'{sid}.jpg')
    if os.path.exists(dest) and os.path.getsize(dest) > 3000:
        return sid, True, 0
    try:
        data = fetch(url)
        im = Image.open(io.BytesIO(data)).convert('RGB')
        im.thumbnail((SIZE[0] * 2, SIZE[1] * 2), Image.LANCZOS)
        im.save(dest, 'JPEG', quality=86, optimize=True, progressive=True)
        return sid, True, os.path.getsize(dest)
    except Exception as e:  # noqa
        return sid, False, str(e)


def main():
    total = 0
    fails = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for sid, ok, size in ex.map(work, IDX):
            if ok:
                total += size
            else:
                fails.append((sid, size))
    print('avatars:', len(IDX) - len(fails), 'fails:', fails[:5], 'total MB:', round(total / 1048576, 2))


if __name__ == '__main__':
    main()
