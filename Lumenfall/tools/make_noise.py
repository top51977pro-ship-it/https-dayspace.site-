#!/usr/bin/env python3
"""Generates shaders/textures/noise.png for Lumenfall.

Channels (256x256, RGBA8, tileable):
  R: white noise
  G: R shifted by (37, 17) so a single bilinear fetch yields two adjacent
     slices for cheap 3D value noise (see lib/util/noise.glsl)
  B: blue noise (spectrally shaped, rank-equalised)
  A: independent white noise
"""
import os
import sys

import numpy as np
from PIL import Image

N = 256
rng = np.random.default_rng(0x1F2E3D)


def rank_uniform(a):
    flat = a.ravel()
    order = np.argsort(flat, kind="stable")
    out = np.empty_like(flat)
    out[order] = np.linspace(0.0, 1.0, flat.size, endpoint=False) + 0.5 / flat.size
    return out.reshape(a.shape)


def blue_noise(n, iterations=12):
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(n)[None, :]
    r = np.sqrt(fx * fx + fy * fy)
    # High-pass: suppress low frequencies, keep a flat high band
    highpass = np.clip((r / 0.30) ** 2, 0.0, 1.0)
    a = rng.random((n, n))
    for _ in range(iterations):
        spec = np.fft.fft2(a - a.mean())
        a = np.real(np.fft.ifft2(spec * highpass))
        a = rank_uniform(a)
    return a


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "shaders", "textures", "noise.png")
    r = rng.random((N, N))
    # g[y, x] = r[y + 17, x + 37]
    g = np.roll(r, shift=(-17, -37), axis=(0, 1))
    b = blue_noise(N)
    a = rng.random((N, N))
    img = np.stack([r, g, b, a], axis=-1)
    img = np.clip(np.floor(img * 256.0), 0, 255).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(out, optimize=True)
    print("wrote", os.path.abspath(out))


if __name__ == "__main__":
    main()
