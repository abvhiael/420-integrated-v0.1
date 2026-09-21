#!/usr/bin/env python3
"""Create 420Travel web assets only from the approved image checked into Git.

Run from repository root: python web/travel/scripts/generate_brand_assets.py
Requires Pillow. The master PNG is never rewritten or replaced.
"""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
MASTER = BRAND / "420travel-logo.png"


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    if not MASTER.is_file():
        raise SystemExit(f"Official user-uploaded master missing: {MASTER}")
    with Image.open(MASTER) as source:
        if source.format != "PNG":
            raise SystemExit("Official logo must be a PNG")
        full = source.convert("RGBA")
    w, h = full.size
    if min(w, h) < 512 or not (0.9 <= w / h <= 1.1):
        raise SystemExit(f"Unexpected logo proportions/dimensions: {full.size}")
    # This is a crop of the exact approved art, NOT a redraw or replacement.
    # The logo's pictorial upper panel ends above the 420Travel wordmark.
    # Inspect the icon crop at native 16px after changes to the master.
    artwork = full.crop((0, 0, w, round(h * 0.692)))
    cream = full.getpixel((0, 0))

    def icon(size: int, margin: float = 0.035) -> Image.Image:
        canvas = Image.new("RGBA", (size, size), cream)
        usable = round(size * (1 - 2 * margin))
        fitted = ImageOps.contain(artwork, (usable, usable), Image.Resampling.LANCZOS)
        canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
        return canvas

    # Browser and touch icons intentionally omit minuscule wordmark/tagline.
    for name, size, margin in (
        ("favicon-16x16.png", 16, 0.0),
        ("favicon-32x32.png", 32, 0.0),
        ("favicon-48x48.png", 48, 0.0),
        ("apple-touch-icon.png", 180, 0.035),
        ("icon-192.png", 192, 0.035),
        ("icon-512.png", 512, 0.035),
        ("maskable-icon-512.png", 512, 0.14),
    ):
        save_png(icon(size, margin), ROOT / name)
    icon(256).save(BRAND / "header-van.png", format="PNG", optimize=True)
    save_png(artwork, BRAND / "420travel-van-icon-master.png")
    # ICO contains the real three sizes; Pillow accepts a single 48px base.
    icon(48, 0).save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    # Center exact full logo on a cream 1200x630 social card, no invented text.
    og = Image.new("RGBA", (1200, 630), cream)
    fitted = ImageOps.contain(full, (570, 570), Image.Resampling.LANCZOS)
    og.alpha_composite(fitted, ((1200 - fitted.width) // 2, (630 - fitted.height) // 2))
    save_png(og, BRAND / "og-420travel.png")
    manifest = {
        "approved_master": "assets/brand/420travel-logo.png",
        "master_sha256": hashlib.sha256(MASTER.read_bytes()).hexdigest(),
        "master_dimensions": [w, h],
        "icon_source_crop_xyxy": [0, 0, w, round(h * 0.692)],
        "derivation": "Crops and resizes only; no regenerated or replacement artwork",
    }
    (BRAND / "ASSET-MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("Generated derived artwork from", MASTER, "SHA256", manifest["master_sha256"])


if __name__ == "__main__":
    main()
