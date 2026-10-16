#!/usr/bin/env python3
"""Decoupe la planche de logos (public/logos.png) en assets PNG propres.

La planche : fond noir, glyphes clairs (logo Hubly).
Pour chaque element: crop -> keying du fond (noir) -> trim -> inversion noire
(glyphe noir sur transparent, theme blanc/noir du site) -> resize exact.

Sorties dans public/logos/ + favicon.ico + contact sheet preview.png.
"""
import math
import os
from PIL import Image, ImageFilter

PLATE = "public/logos.png"
OUT = "public/logos"
os.makedirs(OUT, exist_ok=True)

# (nom_sortie, (w,h), boite_source (x0,y0,x1,y1))
MASTER_LOCKUP = (105, 145, 375, 325)  # lockup icone+texte, traits nets
HORIZONTAL = [
    ("logo-512", (512, 128), MASTER_LOCKUP),
    ("logo-navbar", (128, 32), MASTER_LOCKUP),
    ("logo-medium", (160, 40), MASTER_LOCKUP),
    ("logo-standard", (192, 48), MASTER_LOCKUP),
    ("logo-large", (256, 64), MASTER_LOCKUP),
]

ICON_SOURCE = (55, 695, 300, 885)  # serie du bas de planche (icone d'origine)

ICONS = [
    ("icon-512", (512, 512), (55, 695, 300, 885)),
    ("icon-256", (256, 256), (290, 730, 455, 880)),
    ("icon-192", (192, 192), (465, 750, 615, 880)),
    ("icon-128", (128, 128), (640, 760, 780, 880)),
    ("icon-96", (96, 96), (810, 770, 935, 880)),
    ("icon-64", (64, 64), (980, 780, 1085, 880)),
    ("icon-48", (48, 48), (1140, 785, 1250, 880)),
    ("icon-32", (32, 32), (1290, 795, 1385, 880)),
    ("icon-16", (16, 16), (1420, 805, 1495, 880)),
]


def bg_color(crop):
    """Couleur de fond = mediane des pixels du pourtour."""
    w, h = crop.size
    px = crop.load()
    vals = []
    for x in range(w):
        vals.append(px[x, 0])
        vals.append(px[x, h - 1])
    for y in range(h):
        vals.append(px[0, y])
        vals.append(px[w - 1, y])
    n = len(vals)
    vals.sort()
    return vals[n // 2]


def cut(im, box):
    x0, y0, x1, y1 = box
    crop = im.crop((x0, y0, x1, y1)).convert("RGB")
    bg = bg_color(crop)
    w, h = crop.size
    px = crop.load()
    alpha = Image.new("L", (w, h))
    apx = alpha.load()
    bgr, bgg, bgb = bg
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = math.dist((r, g, b), (bgr, bgg, bgb))
            a = 0 if d < 20 else (255 if d > 65 else int((d - 20) / 45 * 255))
            apx[x, y] = a
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.putalpha(alpha)
    # bbox du contenu
    bbox = alpha.getbbox()
    if not bbox:
        return None, alpha
    out = out.crop(bbox)
    return out, bbox


def invert_to_black(img):
    """Glyphe en noir sur transparent (theme blanc/noir)."""
    return tint(img, (0, 0, 0))


def invert_to_white(img):
    """Glyphe en blanc sur transparent (fonds sombres : landing)."""
    return tint(img, (255, 255, 255))


def tint(img, rgb):
    """Repasse chaque pixel du glyphe en `rgb`, conserve le canal alpha."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (rgb[0], rgb[1], rgb[2], a)
    return img


def place(img, W, H, pad=0.06):
    """Resize en preservant l'aspect puis centre sur canevas (W,H)."""
    img = img.convert("RGBA")
    iw, ih = img.size
    ar = iw / ih
    target_ar = W / H
    padx = pady = 0
    if ar > target_ar:
        w_new = int(W * (1 - 2 * pad))
        h_new = max(1, int(w_new / ar))
    else:
        h_new = int(H * (1 - 2 * pad))
        w_new = max(1, int(h_new * ar))
    img = img.resize((w_new, h_new), Image.LANCZOS)
    if max(W, H) > max(iw, ih) * 1.1:
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(img, ((W - w_new) // 2, (H - h_new) // 2), img)
    return canvas


WHITE = [
    ("logo-navbar-white", (128, 32), MASTER_LOCKUP),
    ("logo-512-white", (512, 128), MASTER_LOCKUP),
]


def main():
    im = Image.open(PLATE).convert("RGB")
    report = []
    for name, (W, H), box in HORIZONTAL + ICONS + WHITE:
        art, bbox = cut(im, box)
        if art is None:
            report.append(f"{name}: VIDE ?!")
            continue
        if name.endswith("-white"):
            art = invert_to_white(art)
        else:
            art = invert_to_black(art)
        final = place(art, W, H, pad=0.0 if "logo" in name else 0.05)
        final.save(os.path.join(OUT, f"{name}.png"))
        report.append(f"{name:18s} src_box={box} ink={art.size} target={W}x{H}")
    # favicon.ico (16/32/48) depuis icon-512 downscale
    ico = Image.open(os.path.join(OUT, "icon-512.png")).convert("RGBA")
    ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

    # contact sheet pour verification humaine
    files = sorted(f for f in os.listdir(OUT) if f.endswith(".png"))
    cols = 7
    rows = (len(files) + cols - 1) // cols
    thumb = 140
    sheet = Image.new("RGB", (cols * thumb, rows * thumb), (255, 255, 255))
    for i, f in enumerate(files):
        t = Image.open(os.path.join(OUT, f)).convert("RGBA")
        t.thumbnail((thumb - 20, thumb - 20), Image.LANCZOS)
        bg = Image.new("RGB", t.size, (240, 240, 240))
        bg.paste(t, (0, 0), t)
        x = (i % cols) * thumb + (thumb - t.size[0]) // 2
        y = (i // cols) * thumb + (thumb - t.size[1]) // 2
        sheet.paste(bg, (x, y))
    sheet.save(os.path.join(OUT, "preview.png"))
    print("\n".join(report))
    print("fichiers:", sorted(f for f in os.listdir(OUT)))


if __name__ == "__main__":
    main()