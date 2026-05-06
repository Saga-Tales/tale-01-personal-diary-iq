"""
Generate PWA icons for diary app.
- Paper bg (#faf8f3), ink letter (#1a1a1a)
- Italic "d" in serif font (Newsreader-style)
- Sizes: 192, 512, maskable 512, apple-touch 180
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

PAPER = (250, 248, 243)
INK = (26, 26, 26)
LINE = (232, 226, 212)

OUT = Path("public")
OUT.mkdir(exist_ok=True)

FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"

def make_icon(size: int, padding_ratio: float = 0.15, with_border: bool = False):
    img = Image.new('RGB', (size, size), PAPER)
    draw = ImageDraw.Draw(img)

    if with_border:
        bw = max(2, size // 80)
        draw.rectangle([bw // 2, bw // 2, size - bw // 2 - 1, size - bw // 2 - 1],
                       outline=LINE, width=bw)

    glyph_size = int(size * (1 - 2 * padding_ratio))
    font = ImageFont.truetype(FONT_PATH, glyph_size)

    bbox = font.getbbox("d")
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1] - int(size * 0.02)

    draw.text((x, y), "d", fill=INK, font=font)
    return img

def make_maskable(size: int):
    img = Image.new('RGB', (size, size), PAPER)
    draw = ImageDraw.Draw(img)

    safe_padding = 0.25
    glyph_size = int(size * (1 - 2 * safe_padding))
    font = ImageFont.truetype(FONT_PATH, glyph_size)

    bbox = font.getbbox("d")
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1] - int(size * 0.02)

    draw.text((x, y), "d", fill=INK, font=font)
    return img

make_icon(192).save(OUT / "icon-192.png", optimize=True)
make_icon(512, with_border=True).save(OUT / "icon-512.png", optimize=True)
make_icon(180, with_border=True).save(OUT / "apple-touch-icon.png", optimize=True)
make_maskable(512).save(OUT / "icon-maskable-512.png", optimize=True)

print("Generated:")
for f in sorted(OUT.glob("icon*.png")) + sorted(OUT.glob("apple*.png")):
    print(f"  {f} ({f.stat().st_size} bytes)")
