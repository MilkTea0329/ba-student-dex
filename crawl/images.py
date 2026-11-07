"""Download every referenced image (skills / items / materials), dedupe by content
hash, downscale and export into data/build/img/<hash>.png plus a url->hash map."""
import json, os, io, hashlib, urllib.request, concurrent.futures, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'build', 'students')
OUT = os.path.join(ROOT, 'data', 'build', 'img')
CACHE = os.path.join(ROOT, 'cache', 'img')
os.makedirs(OUT, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

HDR = {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.gamekee.com/'}

# kind -> max edge
KIND_SIZE = {'skill': 96, 'term': 64, 'uw': 96, 'fi': 96, 'gift': 72, 'choco': 96, 'mat': 64}

refs = {}  # url -> kind


def add(u, kind):
    if u and u.startswith('http') and u not in refs:
        refs[u] = kind


def collect():
    for f in os.listdir(SRC):
        s = json.load(open(os.path.join(SRC, f), encoding='utf-8'))
        for k in s.get('skills', []):
            add(k.get('icon'), 'skill')
        for t in s.get('terms', []):
            add(t.get('icon'), 'term')
        uw = s.get('uniqueWeapon') or {}
        add(uw.get('icon'), 'uw')
        add((uw.get('skill') or {}).get('icon'), 'uw')
        fi = s.get('favoriteItem') or {}
        add(fi.get('icon'), 'fi')
        for u in fi.get('t2mats', []):
            add(u, 'fi')
        for m in (s.get('exMats') or []) + (s.get('skillMats') or []):
            for it in m.get('items', []):
                add(it.get('icon'), 'mat')
        for u in s.get('ability', {}).get('mats', []):
            add(u, 'mat')
        for u in s.get('gifts', []):
            add(u, 'gift')
        for tier in s.get('giftTiers', []):
            add(tier.get('level'), 'gift')
            for u in tier.get('items', []):
                add(u, 'gift')
        add((s.get('chocolate') or {}).get('icon'), 'choco')


def fetch(url):
    key = hashlib.sha1(url.encode()).hexdigest() + '.bin'
    p = os.path.join(CACHE, key)
    if os.path.exists(p) and os.path.getsize(p) > 0:
        return p
    req = urllib.request.Request(url, headers=HDR)
    data = urllib.request.urlopen(req, timeout=40).read()
    open(p, 'wb').write(data)
    return p


def process(url):
    kind = refs[url]
    try:
        p = fetch(url)
        raw = open(p, 'rb').read()
        h = hashlib.sha256(raw).hexdigest()[:16]
        dest = os.path.join(OUT, h + '.png')
        if not os.path.exists(dest):
            im = Image.open(io.BytesIO(raw))
            im = im.convert('RGBA')
            m = KIND_SIZE.get(kind, 96)
            im.thumbnail((m, m), Image.LANCZOS)
            im = im.quantize(colors=256, method=Image.FASTOCTREE)
            im.save(dest, 'PNG', optimize=True)
        return url, h
    except Exception as e:  # noqa
        return url, None


def main():
    collect()
    print('urls', len(refs), flush=True)
    mapping = {}
    fails = 0
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for url, h in ex.map(process, list(refs.keys())):
            done += 1
            if h:
                mapping[url] = h
            else:
                fails += 1
            if done % 500 == 0:
                print('progress', done, 'fails', fails, flush=True)
    json.dump(mapping, open(os.path.join(ROOT, 'data', 'build', 'imgmap.json'), 'w'), ensure_ascii=False)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('mapped', len(mapping), 'unique files', len(os.listdir(OUT)), 'fails', fails, 'MB', round(total / 1048576, 2))


if __name__ == '__main__':
    main()
