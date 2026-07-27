"""Normalize tab icons to match Home_PP outline weight and canvas."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter

ASSETS = Path(__file__).resolve().parents[1] / "assets"
REFERENCE = "Home_PP.png"
INK = (15, 23, 42, 255)
BG_TOLERANCE = 42
STROKE_PASSES = 2


def avg_corner_rgb(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    px = img.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    rs, gs, bs = [], [], []
    for x, y in corners:
        r, g, b, a = px[x, y]
        if a < 16:
            continue
        rs.append(r)
        gs.append(g)
        bs.append(b)
    if not rs:
        return 255, 255, 255
    return sum(rs) // len(rs), sum(gs) // len(gs), sum(bs) // len(bs)


def extract_mask(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    transparent = sum(1 for y in range(h) for x in range(w) if px[x, y][3] < 16)
    if transparent > w * h * 0.35:
        mask = Image.new("L", (w, h), 0)
        mpx = mask.load()
        for y in range(h):
            for x in range(w):
                if px[x, y][3] > 40:
                    mpx[x, y] = 255
        return mask

    bg_ref = avg_corner_rgb(rgba)
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if abs(r - bg_ref[0]) + abs(g - bg_ref[1]) + abs(b - bg_ref[2]) > BG_TOLERANCE * 3:
                mpx[x, y] = 255
    return mask


def mask_ink_ratio(mask: Image.Image) -> float:
    px = mask.load()
    ink = sum(1 for y in range(mask.height) for x in range(mask.width) if px[x, y] > 0)
    return ink / (mask.width * mask.height)


def content_bbox_from_mask(mask: Image.Image, pad: int = 2) -> tuple[int, int, int, int]:
    px = mask.load()
    w, h = mask.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if px[x, y] > 0:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return 0, 0, w - 1, h - 1
    left = max(0, min_x - pad)
    top = max(0, min_y - pad)
    right = min(w - 1, max_x + pad)
    bottom = min(h - 1, max_y + pad)
    return left, top, right, bottom


def crop_mask(mask: Image.Image, pad: int = 2) -> Image.Image:
    left, top, right, bottom = content_bbox_from_mask(mask, pad)
    return mask.crop((left, top, right + 1, bottom + 1))


def thicken(mask: Image.Image, passes: int) -> Image.Image:
    out = mask
    for _ in range(passes):
        out = out.filter(ImageFilter.MaxFilter(3))
    return out


def filled_to_outline(mask: Image.Image, ring: int) -> Image.Image:
    eroded = mask
    for _ in range(ring):
        eroded = eroded.filter(ImageFilter.MinFilter(3))
    out = Image.new("L", mask.size, 0)
    mpx = mask.load()
    epx = eroded.load()
    opx = out.load()
    for y in range(mask.height):
        for x in range(mask.width):
            if mpx[x, y] and not epx[x, y]:
                opx[x, y] = 255
    return out


def mask_to_rgba(mask: Image.Image) -> Image.Image:
    w, h = mask.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            if mpx[x, y]:
                opx[x, y] = INK
    return out


def prepare_mask(source: Image.Image, ref_fill: float) -> Image.Image:
    mask = crop_mask(extract_mask(source))
    if mask_ink_ratio(mask) < 0.001:
        raise ValueError("No icon strokes detected")

    if mask_ink_ratio(mask) > ref_fill * 1.8:
        mask = filled_to_outline(mask, 8)

    mask = thicken(mask, STROKE_PASSES)

    guard = 0
    while mask_ink_ratio(mask) < ref_fill * 0.9 and guard < 4:
        mask = thicken(mask, 1)
        guard += 1

    return mask


def build_icon(source: Image.Image, ref_content_size: tuple[int, int], ref_fill: float, canvas: tuple[int, int]) -> Image.Image:
    mask = prepare_mask(source, ref_fill)
    ref_w, ref_h = ref_content_size
    scale = min(ref_w / mask.width, ref_h / mask.height)
    target_w = max(1, int(mask.width * scale))
    target_h = max(1, int(mask.height * scale))
    mask = mask.resize((target_w, target_h), Image.Resampling.NEAREST)
    fitted = mask_to_rgba(mask)

    canvas_w, canvas_h = canvas
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    x = (canvas_w - target_w) // 2
    y = (canvas_h - target_h) // 2
    out.paste(fitted, (x, y), fitted)
    return out, mask_ink_ratio(mask)


def create_more_icon(ref_content_size: tuple[int, int], ref_fill: float, canvas: tuple[int, int]) -> None:
    ref_w, ref_h = ref_content_size
    bar_w = int(ref_w * 0.58)
    bar_h = max(14, int(ref_w * 0.06))
    gap = max(20, int(bar_h * 1.55))
    mask = Image.new("L", (bar_w, bar_h * 3 + gap * 2), 0)
    mpx = mask.load()
    for row in range(3):
        y0 = row * (bar_h + gap)
        for y in range(y0, y0 + bar_h):
            for x in range(bar_w):
                mpx[x, y] = 255
    mask = prepare_mask(mask_to_rgba(mask), ref_fill)
    scale = min(ref_w / mask.width, ref_h / mask.height)
    target_w = max(1, int(mask.width * scale))
    target_h = max(1, int(mask.height * scale))
    mask = mask.resize((target_w, target_h), Image.Resampling.NEAREST)
    fitted = mask_to_rgba(mask)
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    canvas_w, canvas_h = canvas
    x = (canvas_w - target_w) // 2
    y = (canvas_h - target_h) // 2
    out.paste(fitted, (x, y), fitted)
    out.save(ASSETS / "More_PP.png", format="PNG")
    print(f"Created More_PP.png: fill {mask_ink_ratio(mask) * 100:.1f}%")


def normalize_icon(target: str, ref_content_size: tuple[int, int], ref_fill: float, canvas: tuple[int, int]) -> None:
    source = Image.open(ASSETS / target).convert("RGBA")
    out, fill = build_icon(source, ref_content_size, ref_fill, canvas)
    out.save(ASSETS / target, format="PNG")
    print(f"Updated {target}: fill {fill * 100:.1f}%")


def main() -> None:
    ref_img = Image.open(ASSETS / REFERENCE).convert("RGBA")
    ref_mask = crop_mask(extract_mask(ref_img))
    ref_fill = mask_ink_ratio(ref_mask)
    ref_content_size = ref_mask.size
    canvas = ref_img.size

    targets = sys.argv[1:] or ["Mosque_PP.png", "Azan_PP.png", "Ai_PP.png"]
    for target in targets:
        if target == REFERENCE:
            continue
        path = ASSETS / target
        if not path.exists():
            print(f"Skip missing {target}")
            continue
        try:
            normalize_icon(target, ref_content_size, ref_fill, canvas)
        except ValueError as err:
            print(f"Failed {target}: {err}")

    create_more_icon(ref_content_size, ref_fill, canvas)


if __name__ == "__main__":
    main()
