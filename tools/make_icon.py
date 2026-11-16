"""캠프 앱 아이콘 만들기 — python3 tools/make_icon.py
 적응형 아이콘(안드로이드 8+): 배경 = drawable/ic_launcher_background.xml, 앞 그림 = mipmap-*/ic_launcher_foreground.png
 예전 기기용: mipmap-*/ic_launcher.png, ic_launcher_round.png
 그림은 108 단위 칸에 그린다(가운데 66 단위가 어떤 모양으로 잘려도 보이는 자리)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
DPI = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
INK, SUN, SUN2 = '#2f2a4a', '#f6b81a', '#ffd75e'

DEFS = '''<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7d55b3"/><stop offset="1" stop-color="#58b8f0"/></linearGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e4f7"/></linearGradient>
</defs>'''

BG = '''<rect width="108" height="108" fill="url(#bg)"/>
<circle cx="92" cy="96" r="34" fill="#fff" opacity=".10"/><circle cx="14" cy="16" r="22" fill="#fff" opacity=".10"/>'''

def star(cx, cy, r, fill):
    k = r * .28
    return (f'<path d="M{cx} {cy-r} Q{cx+k} {cy-k} {cx+r} {cy} Q{cx+k} {cy+k} {cx} {cy+r} '
            f'Q{cx-k} {cy+k} {cx-r} {cy} Q{cx-k} {cy-k} {cx} {cy-r}Z" fill="{fill}"/>')

# 옆에서 본 꼬마 자동차. 창문 자리에 도트 얼굴(눈 둘 + 웃는 입)
dots = ''.join(f'<rect x="{x}" y="{y}" width="2.6" height="2.6" rx=".7" fill="{SUN2}"/>'
               for x, y in [(45.2, 40.4), (45.2, 43.6), (57.2, 40.4), (57.2, 43.6),          # 눈
                            (44.2, 48.0), (47.4, 50.6), (50.6, 51.6), (53.8, 51.6), (57.0, 50.6), (60.2, 48.0)])  # 입
FG = f'''
<ellipse cx="54" cy="79.5" rx="27" ry="3.2" fill="{INK}" opacity=".22"/>
<path d="M39 57 V44 Q39 33 50 33 H58 Q69 33 69 44 V57Z" fill="url(#body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>
<rect x="42.2" y="37" width="23.6" height="18.4" rx="4.6" fill="{INK}"/>
{dots}
<path d="M25 61 Q25 53 33 53 H76 Q85 53 85 62 V68 Q85 72 81 72 H29 Q25 72 25 68Z" fill="url(#body)" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>
<rect x="26.4" y="61.4" width="57.2" height="4.2" fill="{SUN}"/>
<rect x="79" y="56.2" width="5" height="4.4" rx="1.8" fill="{SUN2}" stroke="{INK}" stroke-width="1.4"/>
<rect x="26" y="56.6" width="3.6" height="3.8" rx="1.4" fill="#f0619a" stroke="{INK}" stroke-width="1.2"/>
<g stroke="{INK}" stroke-width="2.4"><circle cx="39" cy="72" r="8" fill="{INK}"/><circle cx="70" cy="72" r="8" fill="{INK}"/></g>
<circle cx="39" cy="72" r="3.4" fill="#fff"/><circle cx="70" cy="72" r="3.4" fill="#fff"/>
<path d="M54 33 V27" stroke="{INK}" stroke-width="2" stroke-linecap="round"/><circle cx="54" cy="25.6" r="2.6" fill="#f0619a" stroke="{INK}" stroke-width="1.4"/>
{star(77, 37, 6, SUN2)}{star(30, 41, 3.6, '#fff')}'''

def svg(px, parts, view='0 0 108 108', clip=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{px}" height="{px}" viewBox="{view}">{DEFS}'
            f'{clip}<g {"clip-path=\'url(#c)\'" if clip else ""}>{parts}</g></svg>')

async def main(preview=None):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        async def shot(markup, px, path):
            await pg.set_viewport_size({'width': px, 'height': px})
            await pg.set_content(f'<body style="margin:0;background:transparent">{markup}</body>')
            await pg.screenshot(path=path, omit_background=True, clip={'x': 0, 'y': 0, 'width': px, 'height': px})
        if preview:
            await shot(svg(512, BG + FG), 512, preview); await b.close(); return
        for name, k in DPI.items():
            d = os.path.join(RES, 'mipmap-' + name); os.makedirs(d, exist_ok=True)
            await shot(svg(int(108 * k), FG), int(108 * k), os.path.join(d, 'ic_launcher_foreground.png'))
            px = int(48 * k)                                  # 예전 기기: 가운데 76 단위를 잘라 쓴다
            v = '16 16 76 76'
            sq = '<clipPath id="c"><rect x="16" y="16" width="76" height="76" rx="17"/></clipPath>'
            ro = '<clipPath id="c"><circle cx="54" cy="54" r="38"/></clipPath>'
            await shot(svg(px, BG + FG, v, sq), px, os.path.join(d, 'ic_launcher.png'))
            await shot(svg(px, BG + FG, v, ro), px, os.path.join(d, 'ic_launcher_round.png'))
        # 홈 화면 '우리 가족' 카드에 쓰는 같은 그림(바탕 없음)
        web = os.path.join(os.path.dirname(__file__), '..', 'webapp', 'assets', 'camp-car.png')
        await shot(svg(384, FG, '19 19 70 70'), 384, web)
        await b.close()

asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else None))
