"""Procedural texture toolkit for Mirage Textures.

Everything here produces seamlessly tiling 128x128 float images (values roughly 0..1) with
numpy. Textures are generated from noise, cells and simple geometry - no external art.
"""
import numpy as np
from PIL import Image

N = 128


def rng(seed):
    return np.random.default_rng(seed)


# ---------------------------------------------------------------- noise ----

def _smooth(t):
    return t * t * (3.0 - 2.0 * t)


def value_noise(period, seed, stretch=(1.0, 1.0)):
    """Tileable value noise with `period` lattice cells across the texture.
    stretch=(sx, sy) makes features longer along an axis (use integer-friendly values)."""
    px = max(1, int(round(period * stretch[0])))
    py = max(1, int(round(period * stretch[1])))
    lattice = rng(seed).random((py, px))
    ys = np.arange(N) / N * py
    xs = np.arange(N) / N * px
    y0 = np.floor(ys).astype(int)
    x0 = np.floor(xs).astype(int)
    fy = _smooth(ys - y0)[:, None]
    fx = _smooth(xs - x0)[None, :]
    y1 = (y0 + 1) % py
    x1 = (x0 + 1) % px
    y0 %= py
    x0 %= px
    a = lattice[np.ix_(y0, x0)]
    b = lattice[np.ix_(y0, x1)]
    c = lattice[np.ix_(y1, x0)]
    d = lattice[np.ix_(y1, x1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(seed, base=4, octaves=5, gain=0.5, stretch=(1.0, 1.0)):
    total = np.zeros((N, N))
    amp, norm = 1.0, 0.0
    for i in range(octaves):
        period = base * (2 ** i)
        if period > N:
            break
        total += value_noise(period, seed + i * 101, stretch) * amp
        norm += amp
        amp *= gain
    return total / norm


def ridged(seed, base=4, octaves=4, stretch=(1.0, 1.0)):
    n = fbm(seed, base, octaves, stretch=stretch)
    return 1.0 - np.abs(n * 2.0 - 1.0)


def white(seed):
    return rng(seed).random((N, N))


def voronoi(count, seed, jitter=1.0, stretch=(1.0, 1.0), warp=None):
    """Tileable Voronoi. Returns (F1, F2, cell_id) with distances in pixels.
    warp=(dx, dy) pixel offset arrays make the cell outlines irregular."""
    r = rng(seed)
    pts = r.random((count, 2)) * N
    pts = pts * jitter + (1 - jitter) * N * 0.5
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    if warp is not None:
        xx = xx + warp[0]
        yy = yy + warp[1]
    best1 = np.full((N, N), 1e9)
    best2 = np.full((N, N), 1e9)
    ids = np.zeros((N, N), dtype=int)
    for oy in (-N, 0, N):
        for ox in (-N, 0, N):
            for i, (py, px) in enumerate(pts):
                dy = (yy - (py + oy)) / stretch[1]
                dx = (xx - (px + ox)) / stretch[0]
                d = np.sqrt(dx * dx + dy * dy)
                closer = d < best1
                best2 = np.where(closer, best1, np.minimum(best2, d))
                ids = np.where(closer, i, ids)
                best1 = np.where(closer, d, best1)
    return best1, best2, ids


# --------------------------------------------------------------- helpers ----

def norm01(a):
    lo, hi = np.percentile(a, 1), np.percentile(a, 99)
    return np.clip((a - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def palette(t, stops):
    """Map t (0..1) through colour stops [(pos, (r,g,b)), ...] -> HxWx3."""
    t = np.clip(t, 0.0, 1.0)
    pos = np.array([p for p, _ in stops])
    cols = np.array([c for _, c in stops], dtype=float)
    out = np.zeros(t.shape + (3,))
    for ch in range(3):
        out[..., ch] = np.interp(t, pos, cols[:, ch])
    return out


def shade(rgb, height, strength=1.0, light=(-0.6, -0.8)):
    """Lights a colour image with a height map (top-left light), wrapping at the edges."""
    gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    lit = 1.0 + strength * (gx * light[0] + gy * light[1]) * 6.0
    return rgb * np.clip(lit, 0.45, 1.6)[..., None]


def mix(a, b, t):
    t = np.asarray(t, dtype=float)
    # a 2D weight mixing colour images or single (r,g,b) colours needs a channel axis
    if t.ndim == 2 and (np.ndim(a) in (1, 3) or np.ndim(b) in (1, 3)):
        t = t[..., None]
    return np.asarray(a) * (1 - t) + np.asarray(b) * t


def gray(v):
    return np.repeat(np.asarray(v)[..., None], 3, axis=2)


def splat_line(canvas, x0, y0, x1, y1, value, width, samples=24, mode="max"):
    """Draw a soft, wrapped line into a 2D canvas."""
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    for k in range(samples):
        t = k / (samples - 1)
        cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        dx = (xx - cx + N / 2) % N - N / 2
        dy = (yy - cy + N / 2) % N - N / 2
        d2 = dx * dx + dy * dy
        blob = np.exp(-d2 / (2 * width * width)) * (value if np.ndim(value) == 0 else value)
        if mode == "max":
            np.maximum(canvas, blob, out=canvas)
        else:
            canvas += blob
    return canvas


def save(path, rgb, alpha=None):
    rgb = np.clip(rgb, 0.0, 1.0)
    if alpha is None:
        alpha = np.ones((N, N))
    rgba = np.dstack([rgb, np.clip(alpha, 0.0, 1.0)])
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(path, optimize=True)
