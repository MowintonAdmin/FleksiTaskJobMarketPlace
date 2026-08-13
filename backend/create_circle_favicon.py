import os
from PIL import Image, ImageDraw, ImageFont

def create_circular_bolt_favicon(size=512):
    # Create RGBA transparent canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Draw smooth circular background (Dark Navy matching Sidebar #0F172A)
    padding = size // 20
    draw.ellipse([padding, padding, size - padding, size - padding], fill=(15, 23, 42, 255), outline=(59, 130, 246, 255), width=size // 40)

    # 2. Draw crisp Lightning Bolt
    # Coordinates normalized for size
    scale = size / 512.0
    bolt_points = [
        (285 * scale, 70 * scale),
        (155 * scale, 275 * scale),
        (265 * scale, 275 * scale),
        (225 * scale, 442 * scale),
        (365 * scale, 235 * scale),
        (275 * scale, 235 * scale),
    ]

    # Draw Amber-Orange Lightning Bolt with Golden Glow Outline
    draw.polygon(bolt_points, fill=(255, 140, 0, 255), outline=(255, 220, 0, 255), width=int(12 * scale))

    return img

if __name__ == "__main__":
    img = create_circular_bolt_favicon(512)
    
    paths = [
        "c:/Users/USER/Desktop/Jack/Documents/GitHub/FleksiTaskJobMarketPlace/frontend/web/public/favicon.png",
        "c:/Users/USER/Desktop/Jack/Documents/GitHub/FleksiTaskJobMarketPlace/frontend/web/public/favicon.ico",
        "c:/Users/USER/Desktop/Jack/Documents/GitHub/FleksiTaskJobMarketPlace/frontend/admin/public/favicon.png",
        "c:/Users/USER/Desktop/Jack/Documents/GitHub/FleksiTaskJobMarketPlace/frontend/admin/public/favicon.ico",
    ]

    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p)
        print(f"Saved circular favicon to {p}")
