"""Resize all app icons to match Ai_PP canvas size and visual scale."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets"
REFERENCE = "Ai_PP.png"
TARGETS = ["Compass_PP.png", "Hadees_PP.png"]
SURFACE2 = (255, 255, 255)
BG_TOLERANCE = 42


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


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    ref = avg_corner_rgb(img)
    px = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) > BG_TOLERANCE * 3:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if not found:
        return 0, 0, w - 1, h - 1
    return min_x, min_y, max_x, max_y


def crop_content(img: Image.Image) -> Image.Image:
    left, top, right, bottom = content_bbox(img)
    return img.crop((left, top, right + 1, bottom + 1))


def normalize_to_reference(path: Path, ref_content: Image.Image, canvas: tuple[int, int]) -> None:
    img = Image.open(path).convert("RGBA")
    content = crop_content(img)

    canvas_w, canvas_h = canvas
    ref_w, ref_h = ref_content.size
    scale = min(ref_w / content.width, ref_h / content.height)
    new_w = max(1, int(content.width * scale))
    new_h = max(1, int(content.height * scale))
    resized = content.resize((new_w, new_h), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", canvas, (*SURFACE2, 255))
    x = (canvas_w - new_w) // 2
    y = (canvas_h - new_h) // 2
    out.paste(resized, (x, y), resized)
    out.save(path, format="PNG")


def main() -> None:
    ref_path = ASSETS / REFERENCE
    ref_img = Image.open(ref_path).convert("RGBA")
    canvas = ref_img.size
    ref_content = crop_content(ref_img)

    print(f"Reference {REFERENCE}: canvas={canvas[0]}x{canvas[1]} px, content={ref_content.size[0]}x{ref_content.size[1]} px")

    for name in TARGETS:
        path = ASSETS / name
        if not path.exists():
            print(f"Skip missing {name}")
            continue
        before = Image.open(path).size
        normalize_to_reference(path, ref_content, canvas)
        print(f"Updated {name}: {before[0]}x{before[1]} -> {canvas[0]}x{canvas[1]}")


if __name__ == "__main__":
    main()
