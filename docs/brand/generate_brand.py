"""Run River brand assets generator.

Writes the wordmark outlines (Pretendard Variable, wght 700, 8deg oblique) and
symbol/lockup SVGs. Needs fonttools + brotli: `pip install fonttools brotli`.
App icons (PNG) are generated separately with `npm run icons`.
"""
import math
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/brand"
NAVY, ORANGE, WHITE, BLACK = "#16294A", "#F25C1F", "#FFFFFF", "#000000"
SKEW = math.tan(math.radians(8))

# Symbol on a 100-unit grid. Keep in sync with scripts/brand-icon.mjs and src/components/Brand.tsx.
ROUTE = "M30 80 V33 A13 13 0 0 1 43 20 H55 A17 17 0 0 1 55 54 H50 L74 84"
ROUTE_TRANSFORM = "translate(53.5 49.2) scale(.8) skewX(-8) translate(-52 -52)"
DOT = (32.75, 71.6, 8.8)
SYM_BOX = (23.9, 18.6, 76.4, 80.4)  # measured visible bounds incl. stroke and dot


def symbol(fg, accent):
    cx, cy, r = DOT
    return (f'<path transform="{ROUTE_TRANSFORM}" d="{ROUTE}" fill="none" stroke="{fg}" '
            f'stroke-width="12.5" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent}"/>')


def wordmark_path():
    font = instantiateVariableFont(TTFont(ROOT / "public/fonts/PretendardVariable.woff2"), {"wght": 700})
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    tracking, space = -30, 420
    x, cmds = 0, []
    bounds = BoundsPen(glyphs)
    for ch in "Run River":
        if ch == " ":
            x += space
            continue
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (1, 0, SKEW, -1, x, 0)))
        glyphs[name].draw(TransformPen(bounds, (1, 0, SKEW, -1, x, 0)))
        cmds.append(pen.getCommands())
        x += glyphs[name].width + tracking
    return " ".join(cmds), bounds.bounds, font["OS/2"].sCapHeight


def write(name, body, box):
    x0, y0, x1, y1 = box
    (OUT / name).write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {x1 - x0:.2f} {y1 - y0:.2f}">{body}</svg>\n')


d, (bx0, by0, bx1, by1), cap = wordmark_path()
# Wordmark alone (fills currentColor-free black; used as a CSS mask in the app).
(ROOT / "public/brand/wordmark.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{bx0:.0f} {by0:.0f} {bx1 - bx0:.0f} {by1 - by0:.0f}"><path d="{d}"/></svg>\n')

pad = 4
sym_box = (SYM_BOX[0] - pad, SYM_BOX[1] - pad, SYM_BOX[2] + pad, SYM_BOX[3] + pad)
for name, fg, accent in (("symbol", NAVY, ORANGE), ("symbol-on-dark", WHITE, ORANGE),
                         ("symbol-mono-black", BLACK, BLACK), ("symbol-mono-white", WHITE, WHITE)):
    write(f"{name}.svg", symbol(fg, accent), sym_box)

# Horizontal lockup: cap height = 56% of symbol height, centred on the symbol.
sym_h = SYM_BOX[3] - SYM_BOX[1]
scale = 0.56 * sym_h / cap
centre = (SYM_BOX[1] + SYM_BOX[3]) / 2
baseline = centre + 0.56 * sym_h / 2
wx = SYM_BOX[2] + 10 - bx0 * scale
word = lambda fill: f'<path transform="translate({wx:.2f} {baseline:.2f}) scale({scale:.5f})" d="{d}" fill="{fill}"/>'
right = wx + bx1 * scale
lock_box = (SYM_BOX[0] - pad, SYM_BOX[1] - pad, right + pad, SYM_BOX[3] + pad)
for name, fg, accent in (("lockup", NAVY, ORANGE), ("lockup-on-dark", WHITE, ORANGE),
                         ("lockup-mono-black", BLACK, BLACK), ("lockup-mono-white", WHITE, WHITE)):
    write(f"{name}.svg", symbol(fg, accent) + word(fg), lock_box)

write("app-icon.svg", f'<rect width="100" height="100" rx="22.4" fill="{NAVY}"/>' + symbol(WHITE, ORANGE), (0, 0, 100, 100))
print("brand assets written", round(wx, 2), round(baseline, 2), round(scale, 5), round(right, 2))
