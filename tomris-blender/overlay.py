# overlay.py render.png out.png : master edges (red) over the render, matched framing (sensor-fit horizontal)
import sys
from PIL import Image, ImageFilter, ImageChops
import numpy as np
ren = Image.open(sys.argv[1]).convert('RGB'); W, H = ren.size
m = Image.open(__file__.rsplit('/', 2)[0] + '/tomris-ref/tekne-v3/master_varA_2K.jpg').convert('RGB')
mh = round(W * m.size[1] / m.size[0]); m = m.resize((W, mh), Image.LANCZOS)
canvas = Image.new('RGB', (W, H)); canvas.paste(m, (0, (H - mh) // 2))
e = np.asarray(canvas.convert('L').filter(ImageFilter.FIND_EDGES), float)
out = np.asarray(ren, float) * 0.75
mask = e > 40
out[mask] = [255, 40, 40]
Image.fromarray(out.astype(np.uint8)).save(sys.argv[2])
