"""Extracts the Deck's outlines from Valve's reference drawing.

    pdftocairo -svg -f 1 -l 1 steamdeck_2d_20220202.pdf page1.svg
    pdftocairo -svg -f 2 -l 2 steamdeck_2d_20220202.pdf page2.svg
    python3 tools/extract_cad.py page1.svg page2.svg

Writes tools/ghost.js, which demo.html draws faintly under the hand-drawn views to check
their proportions. The screensaver doesn't use it.

The drawing is steamdeck_2d_20220202.pdf from
https://gitlab.steamos.cloud/SteamHardware/SteamDeck, by Valve Corporation, under
CC BY-NC-SA 4.0. Only the thick lines are kept: they are the visible outlines. The thin
ones are hatching, dimensions and secondary edges.
"""

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from svgpaths import stroked_paths  # noqa: E402

JOIN = 0.3         # mm between endpoints that count as joined
SIMPLIFY = 0.04    # mm, Douglas-Peucker tolerance

# Each view: the page, its box in page millimetres, whether to turn it 180 degrees, and the
# smallest shape in mm to keep. The back and top carry lettering and logo dots, which the
# larger limit drops; round shapes such as screw holes stay.
VIEWS = {
    'front': ('page2', (150, 65, 480, 200), False, 2.0),
    'back': ('page2', (160, 225, 470, 348), False, 4.2),
    'top': ('page1', (25, 208, 330, 276), True, 4.2),
}

HEADER = [
    "// Steam Deck outlines extracted from Valve's reference drawing by tools/extract_cad.py.",
    '// Drawing by Valve Corporation, https://gitlab.steamos.cloud/SteamHardware/SteamDeck,',
    '// under CC BY-NC-SA 4.0. Millimetres, centred, y down.',
]


def chain(segments):
    """Joins polylines whose endpoints lie within JOIN of each other into longer ones."""
    pool = [list(s) for s in segments]
    alive = set(range(len(pool)))
    cells = {}
    cell = lambda p: (math.floor(p[0] / JOIN), math.floor(p[1] / JOIN))
    for i, s in enumerate(pool):
        for p in (s[0], s[-1]):
            cells.setdefault(cell(p), []).append(i)

    def nearest(p):
        """The closest live segment with an endpoint near p, and whether that is its start."""
        best = None
        cx, cy = cell(p)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j in cells.get((cx + dx, cy + dy), []):
                    if j not in alive:
                        continue
                    for at_start, q in ((True, pool[j][0]), (False, pool[j][-1])):
                        d = math.dist(p, q)
                        if d <= JOIN and (best is None or d < best[0]):
                            best = (d, j, at_start)
        return best

    chains = []
    for i in range(len(pool)):
        if i not in alive:
            continue
        alive.discard(i)
        line = pool[i]
        for forward in (True, False):
            while math.dist(line[0], line[-1]) > JOIN or len(line) < 3:
                found = nearest(line[-1] if forward else line[0])
                if found is None:
                    break
                _, j, at_start = found
                alive.discard(j)
                seg = pool[j]
                if forward:
                    line = line + (seg if at_start else seg[::-1])[1:]
                else:
                    line = (seg[::-1] if at_start else seg)[:-1] + line
        chains.append(line)
    return chains


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    best, index = 0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * (px - ax) - dx * (py - ay)) / norm if norm else math.hypot(px - ax, py - ay)
        if d > best:
            best, index = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:index + 1], tol)[:-1] + simplify(pts[index:], tol)


def extract(svg, box, turn, min_size):
    """The view's shapes as (closed, points), biggest first."""
    x0, y0, x1, y1 = box
    segments = [p for w, p, _ in stroked_paths(svg)
                if 1.5 < w < 3 and all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in p)]
    shapes = []
    for line in chain(segments):
        xs, ys = [p[0] for p in line], [p[1] for p in line]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        closed = len(line) > 2 and math.dist(line[0], line[-1]) <= JOIN
        round_shape = closed and min(w, h) > 0.85 * max(w, h) and max(w, h) > 1.5
        if max(w, h) < min_size and not round_shape:
            continue
        if closed:
            line = simplify(line[:-1] + [line[0]], SIMPLIFY)[:-1]
        else:
            line = simplify(line, SIMPLIFY)
        shapes.append((closed, line))

    # Centre on the bounding box, turn if asked, and draw the biggest shapes first.
    xs = [x for _, s in shapes for x, _ in s]
    ys = [y for _, s in shapes for _, y in s]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    sign = -1 if turn else 1
    shapes = [(c, [(sign * (x - cx), sign * (y - cy)) for x, y in s]) for c, s in shapes]
    area = lambda s: (max(p[0] for p in s) - min(p[0] for p in s)) * (max(p[1] for p in s) - min(p[1] for p in s))
    shapes.sort(key=lambda cs: -area(cs[1]))

    return shapes


def flat(pts):
    return [round(v, 2) for p in pts for v in p]


def main(page1, page2):
    pages = {'page1': page1, 'page2': page2}
    ghost = {}
    for name, (page, box, turn, min_size) in VIEWS.items():
        shapes = extract(pages[page], box, turn, min_size)
        ghost[name] = [[int(closed)] + flat(pts) for closed, pts in shapes]
        print(f'{name}: {len(shapes)} strokes', file=sys.stderr)
    target = HERE / 'ghost.js'
    target.write_text('\n'.join(HEADER + [
        '// Each shape is [closed, x, y, x, y, ...].',
        '',
        f'const CAD_GHOST = {json.dumps(ghost, separators=(",", ":"))};',
    ]) + '\n')
    print(f'Wrote {target} ({target.stat().st_size // 1024} KB)', file=sys.stderr)


if __name__ == '__main__':
    main(*sys.argv[1:3])
