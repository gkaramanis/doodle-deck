"""Reads the stroked paths from a pdftocairo SVG as polylines in page millimetres."""

import re
import xml.etree.ElementTree as ET

PT_TO_MM = 25.4 / 72
NUM = r'-?\d*\.?\d+(?:e-?\d+)?'


def bezier(p0, p1, p2, p3, n=8):
    out = []
    for k in range(1, n + 1):
        t = k / n
        u = 1 - t
        out.append(tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


def parse_d(d):
    """Splits a path made of M, L, C and Z into subpaths: (points, closed)."""
    tokens = re.findall(r'[MLCZ]|' + NUM, d)
    subpaths, pts, i, cmd = [], [], 0, None
    while i < len(tokens):
        if tokens[i] in 'MLCZ':
            cmd = tokens[i]
            i += 1
        if cmd == 'M':
            if len(pts) > 1:
                subpaths.append((pts, False))
            pts = [(float(tokens[i]), float(tokens[i + 1]))]
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            pts.append((float(tokens[i]), float(tokens[i + 1])))
            i += 2
        elif cmd == 'C':
            c = [(float(tokens[i + k]), float(tokens[i + k + 1])) for k in (0, 2, 4)]
            pts.extend(bezier(pts[-1], *c))
            i += 6
        elif cmd == 'Z':
            if len(pts) > 1:
                subpaths.append((pts, True))
            pts = [pts[0]] if pts else []
            cmd = None
    if len(pts) > 1:
        subpaths.append((pts, False))
    return subpaths


def stroked_paths(svg_file):
    """Yields (stroke width in pt, points in mm, closed) for every stroked subpath."""
    for el in ET.parse(svg_file).iter('{http://www.w3.org/2000/svg}path'):
        width = el.get('stroke-width')
        if width is None or el.get('stroke') in (None, 'none'):
            continue
        m = re.findall(NUM, el.get('transform', 'matrix(1,0,0,1,0,0)'))
        a, b, c, d, e, f = map(float, m)
        for pts, closed in parse_d(el.get('d')):
            mm = [((a * x + c * y + e) * PT_TO_MM, (b * x + d * y + f) * PT_TO_MM) for x, y in pts]
            yield float(width), mm, closed
