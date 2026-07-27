"""Replace light paper-gray backgrounds in icon PNGs with app surface colors."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets"
SURFACE0 = (240, 244, 248)  # #f0f4f8 — page background
SURFACE2 = (255, 255, 255)  # #ffffff — cards / tab bar


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
    n = len(corners)
    return sum(rs) // n, sum(gs) // n, sum(bs) // n


def replace_background(path: Path, bg: tuple[int, int, int], tolerance: int = 42) -> None:
    img = Image.open(path).convert("RGBA")
    ref = avg_corner_rgb(img)
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dr = abs(r - ref[0])
            dg = abs(g - ref[1])
            db = abs(b - ref[2])
            if dr + dg + db <= tolerance * 3:
                px[x, y] = (*bg, 255)

    img.save(path, format="PNG")


def main() -> None:
    white_icons = ["Mosque_PP.png", "Ai_PP.png", "Compass_PP.png", "Hadees_PP.png"]
    for name in white_icons:
        path = ASSETS / name
        if path.exists():
            replace_background(path, SURFACE2)
            print(f"Updated {name} -> surface2 (#ffffff)")


if __name__ == "__main__":
    main()
