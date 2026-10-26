"""Writes polylines in millimetres to an SVG, for checking extractions by eye.

Coordinates are written in pixels, since ImageMagick's SVG renderer mishandles viewBox.
"""


def write_svg(path, lines, box, scale=3, width=1):
    """lines: iterable of (points, closed). box: (x0, y0, x1, y1) in mm."""
    x0, y0, x1, y1 = box
    w, h = (x1 - x0) * scale, (y1 - y0) * scale
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.0f}" height="{h:.0f}">',
           f'<rect width="{w:.0f}" height="{h:.0f}" fill="white"/>']
    for pts, closed in lines:
        d = 'M' + ' L'.join(f'{(x - x0) * scale:.1f},{(y - y0) * scale:.1f}' for x, y in pts)
        out.append(f'<path d="{d}{" Z" if closed else ""}" fill="none" stroke="black" stroke-width="{width}"/>')
    out.append('</svg>')
    with open(path, 'w') as f:
        f.write('\n'.join(out))
