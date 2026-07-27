"""Rebuild mosque icon: crisp thicker lines, transparent background, app theme ink."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ASSETS = Path(__file__).resolve().parents[1] / "assets"
REFERENCE = "Ai_PP.png"
TARGET = "Mosque_PP.png"
SOURCE = ASSETS / TARGET
INK = (15, 23, 42, 255)  # colors.textPrimary
BG_TOLERANCE = 42
EXTRA_STROKE = 2


def avg_corner_rgb(img: Image.Image) -> tuple[int, int, int]:
    w, h = img.size
    px = img.load()
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    rs, gs, bs = [], [], []
    for x, y in corners:
        r, g, b = px[x, y][:3]
        rs.append(r)
        gs.append(g)
        bs.append(b)
    return sum(rs) // 4, sum(gs) // 4, sum(bs) // 4


def content_bbox(img: Image.Image, bg_ref: tuple[int, int, int]) -> tuple[int, int, int, int]:
    px = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if abs(r - bg_ref[0]) + abs(g - bg_ref[1]) + abs(b - bg_ref[2]) > BG_TOLERANCE * 3:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if not found:
        return 0, 0, w - 1, h - 1
    return min_x, min_y, max_x, max_y


def crop_content(img: Image.Image, bg_ref: tuple[int, int, int], pad: int = 4) -> Image.Image:
    left, top, right, bottom = content_bbox(img, bg_ref)
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width - 1, right + pad)
    bottom = min(img.height - 1, bottom + pad)
    return img.crop((left, top, right + 1, bottom + 1))


def ink_mask(img: Image.Image, bg_ref: tuple[int, int, int]) -> Image.Image:
    px = img.load()
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if abs(r - bg_ref[0]) + abs(g - bg_ref[1]) + abs(b - bg_ref[2]) > BG_TOLERANCE * 3:
                mpx[x, y] = 255
    return mask


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


def mask_ink_ratio(mask: Image.Image) -> float:
    px = mask.load()
    ink = sum(1 for y in range(mask.height) for x in range(mask.width) if px[x, y] > 0)
    return ink / (mask.width * mask.height)


def build_mosque_icon(source: Image.Image, ref_content: Image.Image, canvas: tuple[int, int]) -> Image.Image:
    bg_ref = avg_corner_rgb(source)
    content = crop_content(source, bg_ref)
    ref_w, ref_h = ref_content.size

    scale = min(ref_w / content.width, ref_h / content.height)
    target_w = max(1, int(content.width * scale))
    target_h = max(1, int(content.height * scale))

    mask = ink_mask(content, bg_ref)
    for _ in range(EXTRA_STROKE):
        mask = mask.filter(ImageFilter.MaxFilter(3))

    mask = mask.resize((target_w, target_h), Image.Resampling.NEAREST)
    fitted = mask_to_rgba(mask)

    canvas_w, canvas_h = canvas
    out = Image.new("RGBA", canvas, (0, 0, 0, 0))
    x = (canvas_w - target_w) // 2
    y = (canvas_h - target_h) // 2
    out.paste(fitted, (x, y), fitted)
    return out, mask_ink_ratio(mask)


def main() -> None:
    ref_img = Image.open(ASSETS / REFERENCE).convert("RGBA")
    source = Image.open(SOURCE).convert("RGBA")
    bg_ref = avg_corner_rgb(ref_img)
    ref_content = crop_content(ref_img, bg_ref)
    out, ink_ratio = build_mosque_icon(source, ref_content, ref_img.size)
    out.save(ASSETS / TARGET, format="PNG")

    print(
        f"Updated {TARGET}: transparent bg, ink #0f172a, "
        f"line fill {ink_ratio * 100:.1f}%, nearest upscale +{EXTRA_STROKE}px"
    )


if __name__ == "__main__":
    main()
