"""Create responsive, EXIF-oriented copies; never modify the uploaded originals.
Run manually with Pillow after replacing the root atm1.jpg–atm7.jpg files.
"""
from pathlib import Path
from PIL import Image, ImageOps
root = Path(__file__).resolve().parents[1]
for number in range(1, 8):
    with Image.open(root / f'atm{number}.jpg') as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        for width in sorted({480, min(960, image.width), image.width}):
            height = round(image.height * width / image.width)
            image.resize((width, height), Image.Resampling.LANCZOS).save(
                root / 'atmosphere' / 'images' / f'atm{number}-{width}.webp',
                'WEBP', quality=84, method=6)
