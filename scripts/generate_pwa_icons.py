#!/usr/bin/env python3
"""Genera iconos PWA nítidos y reproducibles para Android e iOS."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
GREEN = "#006241"
CREAM = "#fffaf2"
GOLD = "#d2a35c"


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points = []
    for index in range(10):
        radius = outer if index % 2 == 0 else inner
        angle = -math.pi / 2 + index * math.pi / 5
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
    return ImageFont.truetype(str(path), size) if path.is_file() else ImageFont.load_default()


def icon(size: int, *, maskable: bool = False) -> Image.Image:
    scale = 4
    canvas = size * scale
    image = Image.new("RGB", (canvas, canvas), GREEN)
    draw = ImageDraw.Draw(image)
    unit = canvas / 192
    if not maskable:
        draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=48 * unit, fill=GREEN)
        factor, ox, oy = 1.0, 0.0, 0.0
    else:
        factor, ox, oy = .72, canvas * .14, canvas * .14

    def point(x: float, y: float) -> tuple[float, float]:
        return ox + x * unit * factor, oy + y * unit * factor

    circle_box = (*point(38, 30), *point(154, 146))
    draw.ellipse(circle_box, fill=CREAM, outline=GOLD, width=max(2,round(4 * unit * factor)))
    receipt = [point(72,53),point(120,53),point(128,61),point(128,130),point(116,123),point(106,130),point(96,123),point(86,130),point(76,123),point(64,130),point(64,61)]
    draw.line(receipt + [receipt[0]], fill=GREEN, width=max(3,round(7 * unit * factor)), joint="curve")
    for y, end in ((73,114),(91,114),(109,102)):
        draw.line((*point(78,y),*point(end,y)), fill=GREEN, width=max(3,round(7 * unit * factor)))
    draw.polygon([point(x,y) for x,y in star_points(128,52,15,7)], fill=GOLD)
    if not maskable:
        label_font = font(max(10,round(20 * unit)))
        box = draw.textbbox((0,0),"EO",font=label_font)
        draw.text(((canvas - (box[2]-box[0]))/2, 160*unit),"EO",font=label_font,fill="white")
    return image.resize((size,size),Image.Resampling.LANCZOS)


def main() -> None:
    outputs = {
        "pwa-icon-192.png": icon(192),
        "pwa-icon-512.png": icon(512),
        "pwa-maskable-512.png": icon(512, maskable=True),
        "apple-touch-icon.png": icon(180),
    }
    for name, image in outputs.items():
        image.save(PUBLIC / name, format="PNG", optimize=True)
        print(f"{name}: {image.width}x{image.height}")


if __name__ == "__main__":
    main()
