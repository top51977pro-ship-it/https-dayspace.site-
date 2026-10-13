#!/usr/bin/env python3
"""Generates the Mirage Textures 128x resource pack (realistic, procedural, original).

Run:  python3 resourcepacks/tools/generate_textures.py
Output: resourcepacks/MirageTextures/ (pack.mcmeta, pack.png, assets/minecraft/textures/block/*.png)
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

from texlib import (N, fbm, ridged, value_noise, white, voronoi, norm01, smoothstep, palette,
                    shade, mix, gray, splat_line, save, rng)

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.normpath(os.path.join(HERE, "..", "MirageTextures"))
BLOCK = os.path.join(PACK, "assets", "minecraft", "textures", "block")
VERSION = "1.0"

YY, XX = np.mgrid[0:N, 0:N].astype(float)


# ============================================================== soils ======

def dirt_rgb(seed=1, coarse=False):
    h = fbm(seed, base=4, octaves=6) * 0.7 + fbm(seed + 7, base=16, octaves=3) * 0.3
    t = norm01(h)
    rgb = palette(t, [(0.0, (0.22, 0.14, 0.08)), (0.45, (0.36, 0.25, 0.16)),
                      (0.8, (0.45, 0.32, 0.21)), (1.0, (0.52, 0.38, 0.26))])
    # small pebbles and roots
    f1, f2, ids = voronoi(90 if coarse else 30, seed + 3)
    pebble_size = 3.2 if coarse else 2.0
    pebble = smoothstep(pebble_size, pebble_size * 0.4, f1) * (rng(seed).random(ids.max() + 1)[ids] > (0.45 if coarse else 0.6))
    stone_col = palette(norm01(fbm(seed + 9, 8, 3)), [(0, (0.30, 0.25, 0.20)), (1, (0.46, 0.40, 0.33))])
    rgb = mix(rgb, stone_col, pebble * (0.95 if coarse else 0.6))
    height = h + pebble * 0.35
    # fine grain
    rgb *= (0.92 + 0.16 * white(seed + 11))[..., None]
    return shade(rgb, height, 0.9), height


def dirt():
    rgb, _ = dirt_rgb(1)
    save(f"{BLOCK}/dirt.png", rgb)


def coarse_dirt():
    rgb, _ = dirt_rgb(5, coarse=True)
    save(f"{BLOCK}/coarse_dirt.png", rgb)


def grass_blades_gray(seed, count=520, base=0.52):
    """Grayscale (biome-tinted) grass seen from above: many short blades over a darker base."""
    canvas = np.full((N, N), base) + (fbm(seed, 4, 5) - 0.5) * 0.18
    blades = np.zeros((N, N))
    r = rng(seed)
    for _ in range(count):
        x, y = r.random() * N, r.random() * N
        ang = r.random() * np.pi * 2
        ln = 3 + r.random() * 5
        splat_line(blades, x, y, x + np.cos(ang) * ln, y + np.sin(ang) * ln,
                   0.55 + r.random() * 0.45, 0.6 + r.random() * 0.35, samples=8)
    g = canvas * 0.55 + blades * 0.55
    g += (white(seed + 3) - 0.5) * 0.05
    return np.clip(g, 0, 1), blades


def grass_block_top():
    g, blades = grass_blades_gray(21)
    rgb = shade(gray(g), blades * 0.6, 0.7)
    save(f"{BLOCK}/grass_block_top.png", rgb)


def fringe_mask(seed, depth=20, jag=14):
    """Grass/snow hanging over the top edge of a block side: 1 at the top, ragged edge below."""
    r = rng(seed)
    edge = np.full(N, float(depth))
    for _ in range(40):
        x = r.random() * N
        w = 1.5 + r.random() * 3
        d = depth + r.random() * jag
        edge = np.maximum(edge, d * np.exp(-((np.arange(N) - x + N / 2) % N - N / 2) ** 2 / (2 * w * w)))
    edge = edge + value_noise(16, seed + 1)[0] * 3
    return smoothstep(edge[None, :] + 1.0, edge[None, :] - 1.0, YY)


def grass_block_side():
    soil, h = dirt_rgb(1)
    mask = fringe_mask(31)
    g, blades = grass_blades_gray(33, count=300)
    green = gray(g) * np.array([0.42, 0.62, 0.25])     # shown when the tinted overlay is missing
    rgb = mix(soil, shade(green, blades, 0.6), mask)
    # shadow just under the grass fringe
    rgb *= (1.0 - 0.25 * smoothstep(0.0, 1.0, np.roll(mask, 3, axis=0) - mask))[..., None]
    save(f"{BLOCK}/grass_block_side.png", rgb)
    overlay = shade(gray(g), blades, 0.6)
    save(f"{BLOCK}/grass_block_side_overlay.png", overlay, mask)


def grass_block_snow():
    soil, h = dirt_rgb(1)
    mask = fringe_mask(41, depth=26, jag=10)
    snow_rgb = snow_texture(43) * 1.0
    save(f"{BLOCK}/grass_block_snow.png", mix(soil, snow_rgb, mask))


def snow_texture(seed):
    h = fbm(seed, 4, 5)
    rgb = palette(norm01(h), [(0, (0.82, 0.86, 0.92)), (1, (0.97, 0.98, 1.0))])
    sparkle = (white(seed + 1) > 0.995) * 0.15
    return shade(rgb + sparkle[..., None], h, 0.6)


def snow():
    save(f"{BLOCK}/snow.png", snow_texture(45))


def sand_like(seed, dark, mid, light, name):
    grain = white(seed)
    h = fbm(seed + 1, 4, 5) * 0.6 + value_noise(64, seed + 2) * 0.4
    ripples = np.sin((YY + fbm(seed + 3, 2, 3) * 30) / N * np.pi * 2 * 6) * 0.04
    t = norm01(h + ripples + grain * 0.25)
    rgb = palette(t, [(0, dark), (0.5, mid), (1, light)])
    rgb *= (0.9 + 0.2 * grain)[..., None]
    save(f"{BLOCK}/{name}.png", shade(rgb, h + ripples, 0.6))


def sand():
    sand_like(51, (0.70, 0.62, 0.44), (0.84, 0.77, 0.58), (0.93, 0.88, 0.70), "sand")


def red_sand():
    sand_like(55, (0.58, 0.29, 0.12), (0.72, 0.38, 0.16), (0.83, 0.50, 0.25), "red_sand")


def gravel():
    f1, f2, ids = voronoi(70, 61)
    r = rng(61)
    tone = r.random(ids.max() + 1)[ids]
    warm = r.random(ids.max() + 1)[ids]
    edge = smoothstep(0.0, 3.0, f2 - f1)
    dome = smoothstep(0.0, 6.0, f2 - f1)
    base = palette(tone, [(0, (0.32, 0.30, 0.29)), (0.5, (0.50, 0.47, 0.45)), (1, (0.66, 0.63, 0.60))])
    base = mix(base, base * np.array([1.08, 0.98, 0.88]), warm * 0.8)
    base *= (0.9 + 0.2 * fbm(62, 16, 3))[..., None]
    rgb = mix(np.array([0.13, 0.12, 0.11]), base, edge)
    save(f"{BLOCK}/gravel.png", shade(rgb, dome + fbm(63, 16, 3) * 0.2, 1.0))


def clay():
    h = fbm(71, 4, 5)
    rgb = palette(norm01(h), [(0, (0.55, 0.58, 0.64)), (1, (0.68, 0.71, 0.77))])
    save(f"{BLOCK}/clay.png", shade(rgb, h, 0.5))


# ============================================================== stones =====

def stone_rgb(seed, dark, light, cracks=0.5, speck=0.0, layered=False):
    stretch = (1.0, 0.35) if layered else (1.0, 1.0)
    h = fbm(seed, 4, 6, stretch=stretch)
    t = norm01(h)
    rgb = palette(t, [(0, dark), (1, light)])
    if cracks > 0:
        f1, f2, _ = voronoi(14, seed + 5, stretch=stretch)
        crack = smoothstep(2.2, 0.0, f2 - f1) * smoothstep(0.35, 0.65, fbm(seed + 6, 8, 3))
        rgb *= (1.0 - crack * cracks)[..., None]
        h = h - crack * 0.15 * cracks
    if speck > 0:
        s = white(seed + 7)
        rgb *= (1.0 - speck * (s > 0.93) * 0.5 + speck * (s < 0.03) * 0.4)[..., None]
    rgb *= (0.95 + 0.1 * white(seed + 8))[..., None]
    return rgb, h


def stone():
    rgb, h = stone_rgb(81, (0.40, 0.40, 0.41), (0.60, 0.60, 0.61), cracks=0.45, speck=0.4)
    save(f"{BLOCK}/stone.png", shade(rgb, h, 0.8))


def deepslate_rgb(seed=91):
    rgb, h = stone_rgb(seed, (0.20, 0.20, 0.23), (0.36, 0.36, 0.40), cracks=0.4, speck=0.3, layered=True)
    bands = value_noise(24, seed + 9, stretch=(0.15, 1.0)) * 0.12
    return rgb * (0.94 + bands)[..., None], h + bands


def deepslate():
    rgb, h = deepslate_rgb()
    save(f"{BLOCK}/deepslate.png", shade(rgb, h, 0.9))


def deepslate_top():
    f1, f2, ids = voronoi(10, 95)
    h = fbm(96, 4, 5) * 0.5 + smoothstep(0, 10, f2 - f1) * 0.5
    rgb = palette(norm01(h), [(0, (0.18, 0.18, 0.21)), (1, (0.36, 0.36, 0.40))])
    rgb *= (1.0 - smoothstep(2.0, 0.0, f2 - f1) * 0.45)[..., None]
    save(f"{BLOCK}/deepslate_top.png", shade(rgb, h, 0.9))


def igneous(name, seed, base_dark, base_light, grains):
    rgb, h = stone_rgb(seed, base_dark, base_light, cracks=0.15)
    r = rng(seed)
    for col, density, size in grains:
        f1, _, ids = voronoi(density, seed + int(size * 100) + density)
        keep = r.random(ids.max() + 1)[ids] > 0.4
        g = smoothstep(size, size * 0.3, f1) * keep
        rgb = mix(rgb, np.array(col) * (0.9 + 0.2 * white(seed + density))[..., None], g * 0.9)
        h = h + g * 0.15
    save(f"{BLOCK}/{name}.png", shade(rgb, h, 0.7))


def andesite():
    igneous("andesite", 101, (0.44, 0.44, 0.44), (0.58, 0.58, 0.57),
            [((0.32, 0.32, 0.33), 80, 1.6), ((0.70, 0.70, 0.69), 60, 1.3)])


def diorite():
    igneous("diorite", 111, (0.72, 0.72, 0.72), (0.88, 0.88, 0.87),
            [((0.25, 0.25, 0.26), 70, 1.8), ((0.55, 0.55, 0.56), 50, 1.5)])


def granite():
    igneous("granite", 121, (0.55, 0.37, 0.30), (0.68, 0.48, 0.40),
            [((0.35, 0.22, 0.19), 70, 1.7), ((0.80, 0.62, 0.55), 70, 1.5), ((0.25, 0.24, 0.25), 30, 1.2)])


def cobble_rgb(seed, cells, dark, light, mortar):
    warp = ((fbm(seed + 7, 4, 4) - 0.5) * 14, (fbm(seed + 8, 4, 4) - 0.5) * 14)
    f1, f2, ids = voronoi(cells, seed, jitter=0.95, warp=warp)
    r = rng(seed)
    tone = r.random(ids.max() + 1)[ids]
    # 0 on the boundary between two stones, ~1 in the middle of a stone
    e = (f2 - f1) / np.maximum(f2 + f1, 1e-3)
    dome = np.sqrt(smoothstep(0.0, 0.55, e)) * 0.7 + fbm(seed + 1, 8, 4) * 0.25
    base = palette(np.clip(tone * 0.6 + fbm(seed + 2, 8, 4) * 0.6, 0, 1), [(0, dark), (1, light)])
    base *= (0.94 + 0.12 * white(seed + 3))[..., None]
    # rounded stones darken towards their edges, then sink into dark mortar
    base *= (0.62 + 0.38 * smoothstep(0.0, 0.35, e))[..., None]
    gap = smoothstep(0.07, 0.02, e)
    rgb = mix(base, np.array(mortar), gap)
    return shade(rgb, dome, 0.45), gap


def cobblestone():
    rgb, _ = cobble_rgb(131, 16, (0.36, 0.36, 0.37), (0.62, 0.62, 0.62), (0.16, 0.16, 0.16))
    save(f"{BLOCK}/cobblestone.png", rgb)


def mossy_cobblestone():
    rgb, gap = cobble_rgb(131, 16, (0.36, 0.36, 0.37), (0.62, 0.62, 0.62), (0.16, 0.16, 0.16))
    moss_mask = smoothstep(0.48, 0.62, fbm(141, 4, 5) + gap * 0.25)
    moss = palette(fbm(142, 16, 3), [(0, (0.22, 0.32, 0.12)), (1, (0.40, 0.52, 0.22))])
    moss *= (0.85 + 0.3 * white(143))[..., None]
    save(f"{BLOCK}/mossy_cobblestone.png", mix(rgb, moss, moss_mask))


def cobbled_deepslate():
    rgb, _ = cobble_rgb(151, 24, (0.18, 0.18, 0.21), (0.36, 0.36, 0.40), (0.07, 0.07, 0.08))
    save(f"{BLOCK}/cobbled_deepslate.png", rgb)


def bedrock():
    f1, f2, ids = voronoi(30, 161)
    tone = rng(161).random(ids.max() + 1)[ids]
    h = smoothstep(0, 8, f2 - f1) * 0.6 + fbm(162, 8, 4) * 0.4
    rgb = palette(np.clip(tone * 0.6 + h * 0.4, 0, 1), [(0, (0.10, 0.10, 0.10)), (0.6, (0.33, 0.33, 0.33)), (1, (0.55, 0.55, 0.55))])
    save(f"{BLOCK}/bedrock.png", shade(rgb, h, 1.2))


def obsidian():
    h = fbm(171, 4, 6)
    streak = ridged(172, 4, 4, stretch=(1.0, 0.5))
    rgb = palette(norm01(h), [(0, (0.04, 0.02, 0.07)), (0.7, (0.10, 0.06, 0.16)), (1, (0.20, 0.13, 0.30))])
    rgb += (smoothstep(0.85, 0.98, streak) * 0.18)[..., None] * np.array([0.6, 0.45, 1.0])
    save(f"{BLOCK}/obsidian.png", shade(rgb, h, 0.6))


def netherrack():
    h = fbm(181, 4, 6)
    f1, f2, _ = voronoi(26, 182)
    crack = smoothstep(2.0, 0.0, f2 - f1)
    rgb = palette(norm01(h), [(0, (0.30, 0.09, 0.08)), (0.6, (0.46, 0.15, 0.13)), (1, (0.58, 0.24, 0.20))])
    rgb *= (1.0 - crack * 0.5)[..., None]
    rgb *= (0.9 + 0.2 * white(183))[..., None]
    save(f"{BLOCK}/netherrack.png", shade(rgb, h - crack * 0.2, 1.0))


def sandstone(kind):
    seed = {"side": 191, "top": 195, "bottom": 197}[kind]
    grain = white(seed)
    h = fbm(seed + 1, 4, 5)
    if kind == "side":
        strata = np.sin((YY + fbm(seed + 2, 2, 3) * 10) / N * np.pi * 2 * 5) * 0.5 + 0.5
        h = h * 0.5 + strata * 0.5
        h[:12] += 0.15                       # smooth cap at the top, like a carved block
    rgb = palette(norm01(h + grain * 0.15), [(0, (0.74, 0.66, 0.47)), (1, (0.88, 0.81, 0.62))])
    if kind == "bottom":
        f1, f2, _ = voronoi(18, seed + 3)
        rgb *= (1.0 - smoothstep(1.8, 0.0, f2 - f1) * 0.25)[..., None]
    save(f"{BLOCK}/sandstone{'' if kind == 'side' else '_' + kind}.png", shade(rgb, h, 0.7))


# =============================================================== ores ======

ORES = {
    "coal":     [(0.08, 0.08, 0.08), (0.22, 0.22, 0.24)],
    "iron":     [(0.62, 0.45, 0.33), (0.86, 0.72, 0.60)],
    "copper":   [(0.70, 0.38, 0.22), (0.35, 0.62, 0.50)],
    "gold":     [(0.85, 0.66, 0.15), (1.00, 0.92, 0.45)],
    "redstone": [(0.62, 0.04, 0.02), (1.00, 0.20, 0.12)],
    "lapis":    [(0.10, 0.20, 0.62), (0.30, 0.50, 0.95)],
    "diamond":  [(0.20, 0.72, 0.72), (0.70, 1.00, 0.97)],
    "emerald":  [(0.05, 0.55, 0.22), (0.35, 0.95, 0.55)],
}


def ore(mineral, deep=False):
    seed = 300 + sorted(ORES).index(mineral) * 13 + (7 if deep else 0)
    if deep:
        rgb, h = deepslate_rgb(seed)
    else:
        rgb, h = stone_rgb(seed, (0.40, 0.40, 0.41), (0.60, 0.60, 0.61), cracks=0.35, speck=0.3)
    dark, light = ORES[mineral]
    f1, f2, ids = voronoi(7, seed + 1, jitter=0.8)
    blob = smoothstep(17, 7, f1 + (fbm(seed + 2, 8, 4) - 0.5) * 16)
    crystals = fbm(seed + 3, 16, 3)
    col = palette(norm01(crystals), [(0, dark), (1, light)])
    if mineral == "copper":       # orange copper with spots of green patina
        col = mix(palette(norm01(crystals), [(0, (0.62, 0.33, 0.18)), (1, (0.88, 0.52, 0.30))]),
                  np.array(light), smoothstep(0.62, 0.75, fbm(seed + 4, 16, 3)) * 0.7)
    sparkle = (white(seed + 5) > 0.97) * 0.35 * (mineral in ("diamond", "emerald", "gold", "lapis"))
    col = col + sparkle[..., None]
    rgb = mix(rgb, col, blob)
    h = h + blob * (0.3 + crystals * 0.3)
    name = f"{'deepslate_' if deep else ''}{mineral}_ore"
    save(f"{BLOCK}/{name}.png", shade(rgb, h, 1.1))


# =============================================================== wood ======

WOODS = {
    #           bark dark          bark light          wood dark          wood light
    "oak":    [(0.24, 0.18, 0.11), (0.42, 0.33, 0.21), (0.52, 0.38, 0.22), (0.72, 0.56, 0.36)],
    "spruce": [(0.16, 0.11, 0.07), (0.30, 0.22, 0.14), (0.36, 0.25, 0.14), (0.52, 0.38, 0.23)],
    "birch":  [(0.78, 0.76, 0.70), (0.93, 0.92, 0.88), (0.72, 0.62, 0.42), (0.86, 0.78, 0.58)],
}


def log_side(kind):
    bd, bl, _, _ = WOODS[kind]
    seed = {"oak": 401, "spruce": 411, "birch": 421}[kind]
    if kind == "birch":
        h = fbm(seed, 4, 5, stretch=(1.0, 0.25))
        rgb = palette(norm01(h), [(0, bd), (1, bl)])
        # dark horizontal lenticels and peeling marks
        marks = np.zeros((N, N))
        r = rng(seed)
        for _ in range(28):
            x, y = r.random() * N, r.random() * N
            ln = 6 + r.random() * 22
            splat_line(marks, x, y, x + ln, y + r.normal() * 0.8, 0.9, 0.9 + r.random() * 1.2, samples=20)
        rgb = mix(rgb, np.array([0.10, 0.09, 0.08]), np.clip(marks, 0, 1) * 0.9)
        h = h - marks * 0.3
    else:
        fibres = fbm(seed, 8, 5, stretch=(1.0, 0.25))
        # vertical fissures that wander sideways, breaking the bark into long plates
        wander = (fbm(seed + 3, 2, 3) - 0.5) * 18
        fissure_x = (XX + wander) / N * 7.0
        fissure = np.abs(np.sin(fissure_x * np.pi + fbm(seed + 4, 4, 3, stretch=(1.0, 0.25)) * 3.0))
        plates = smoothstep(0.05, 0.45, fissure)
        cross_cracks = smoothstep(0.80, 0.97, ridged(seed + 5, 4, 3, stretch=(0.5, 1.0))) * plates
        h = plates * 0.6 + fibres * 0.4 - cross_cracks * 0.25
        rgb = palette(norm01(fibres * 0.6 + plates * 0.4), [(0, bd), (1, bl)])
        rgb *= (0.35 + 0.65 * plates)[..., None]
        rgb *= (1.0 - cross_cracks * 0.4)[..., None]
        rgb *= (0.90 + 0.2 * white(seed + 2))[..., None]
    save(f"{BLOCK}/{kind}_log.png", shade(rgb, h, 1.2))


def log_top(kind):
    bd, bl, wd, wl = WOODS[kind]
    seed = {"oak": 431, "spruce": 441, "birch": 451}[kind]
    cx = cy = N / 2 - 0.5
    warp = (fbm(seed, 4, 4) - 0.5) * 6
    r = np.sqrt((XX - cx) ** 2 + (YY - cy) ** 2) + warp
    rings = np.sin(r * 0.55 + fbm(seed + 1, 8, 3) * 2.0) * 0.5 + 0.5
    rgb = palette(rings * 0.6 + fbm(seed + 2, 16, 3) * 0.4, [(0, wd), (1, wl)])
    # bark border (square, following the block edge)
    edge = np.minimum(np.minimum(XX, N - 1 - XX), np.minimum(YY, N - 1 - YY)) + (fbm(seed + 3, 8, 3) - 0.5) * 4
    bark = smoothstep(11.0, 8.0, edge)
    bark_col = palette(fbm(seed + 4, 16, 3), [(0, bd), (1, bl)])
    rgb = mix(rgb, bark_col, bark)
    # radial drying cracks
    ang = np.arctan2(YY - cy, XX - cx)
    crack = smoothstep(0.985, 1.0, np.cos(ang * 3 + 0.7)) * smoothstep(8, 25, r) * smoothstep(52, 40, r)
    rgb *= (1.0 - crack * 0.6)[..., None]
    save(f"{BLOCK}/{kind}_log_top.png", shade(rgb, rings * 0.3 - bark * 0.2 - crack * 0.3, 0.8))


def planks(kind):
    _, _, wd, wl = WOODS[kind]
    seed = {"oak": 461, "spruce": 471, "birch": 481}[kind]
    r = rng(seed)
    rows = 4
    rh = N // rows
    rgb = np.zeros((N, N, 3))
    height = np.zeros((N, N))
    grain_all = fbm(seed, 4, 6, stretch=(0.125, 1.0))
    for i in range(rows):
        y0, y1 = i * rh, (i + 1) * rh
        tone = 0.85 + r.random() * 0.3
        joint = int(r.random() * N)
        band = slice(y0, y1)
        yy = YY[band] - y0
        grain = grain_all[band]
        figure = np.sin((yy + grain * 14 + value_noise(4, seed + i, (0.25, 1.0))[band] * 10) * 0.9) * 0.5 + 0.5
        t = np.clip(figure * 0.45 + grain * 0.55, 0, 1)
        col = palette(t, [(0, wd), (1, wl)]) * tone
        # board edges and the joint between two boards in this row
        e = np.minimum(yy, rh - 1 - yy)
        gap = smoothstep(1.6, 0.4, e)
        jx = np.abs((XX[band] - joint + N / 2) % N - N / 2)
        gap = np.maximum(gap, smoothstep(1.4, 0.4, jx))
        col = mix(col, np.array(wd) * 0.35, gap)
        # two nail holes near the joint
        for nx in (joint - 5, joint + 5):
            for ny in (rh * 0.3, rh * 0.7):
                d = np.sqrt(((XX[band] - nx + N / 2) % N - N / 2) ** 2 + (yy - ny) ** 2)
                col = mix(col, np.array(wd) * 0.3, smoothstep(1.6, 0.8, d))
        rgb[band] = col
        height[band] = t * 0.3 - gap * 0.6 + smoothstep(0, 4, e) * 0.2
    rgb *= (0.95 + 0.1 * white(seed + 9))[..., None]
    save(f"{BLOCK}/{kind}_planks.png", shade(rgb, height, 1.0))


def leaves(kind):
    """Grayscale, biome-tinted leaves with a cutout of individual leaf shapes."""
    seed = {"oak": 501, "spruce": 511, "birch": 521}[kind]
    r = rng(seed)
    value = np.zeros((N, N))
    alpha = np.zeros((N, N))
    count = 230 if kind != "spruce" else 420
    for _ in range(count):
        cx, cy = r.random() * N, r.random() * N
        ang = r.random() * np.pi
        if kind == "spruce":
            a_len, b_len = 5.0 + r.random() * 3, 0.9 + r.random() * 0.4    # needles
        else:
            a_len, b_len = 4.5 + r.random() * 2.5, 2.4 + r.random() * 1.2  # leaves
        dx = (XX - cx + N / 2) % N - N / 2
        dy = (YY - cy + N / 2) % N - N / 2
        u = dx * np.cos(ang) + dy * np.sin(ang)
        v = -dx * np.sin(ang) + dy * np.cos(ang)
        d = (u / a_len) ** 2 + (v / b_len) ** 2
        leaf = d < 1.0
        shade_v = 0.45 + r.random() * 0.45 + u / a_len * 0.12 - np.abs(v / b_len) * 0.08
        vein = np.exp(-(v / 0.35) ** 2) * (np.abs(u) < a_len * 0.8) * 0.08 * (kind != "spruce")
        value = np.where(leaf, shade_v + vein, value)
        alpha = np.maximum(alpha, leaf.astype(float))
    value = np.clip(value + (white(seed + 1) - 0.5) * 0.05, 0, 1)
    save(f"{BLOCK}/{kind}_leaves.png", gray(value), alpha)


def short_grass():
    r = rng(531)
    value = np.zeros((N, N))
    alpha = np.zeros((N, N))
    for _ in range(26):
        x0 = 8 + r.random() * (N - 16)
        top = 20 + r.random() * 60
        lean = (r.random() - 0.5) * 30
        w = 1.4 + r.random() * 1.6
        for k in range(48):
            t = k / 47
            cx = x0 + lean * t * t
            cy = N - 1 - (N - 1 - top) * t
            width = w * (1 - t * 0.85)
            d = np.sqrt((XX - cx) ** 2 + ((YY - cy) * 0.7) ** 2)
            m = d < width
            alpha = np.maximum(alpha, m.astype(float))
            value = np.where(m, 0.45 + t * 0.4 + r.random() * 0.03, value)
    save(f"{BLOCK}/short_grass.png", gray(value), alpha)


# ============================================================== built ======

def bricks():
    r = rng(601)
    rows, per_row = 4, 2
    rh, bw = N // rows, N // per_row
    rgb = np.zeros((N, N, 3))
    height = np.zeros((N, N))
    base_noise = fbm(602, 8, 5)
    for i in range(rows):
        band = slice(i * rh, (i + 1) * rh)
        off = 0 if i % 2 == 0 else bw // 2
        yy = YY[band] - i * rh
        xx = (XX[band] - off) % N
        bid = (xx // bw).astype(int)
        tones = 0.8 + r.random(per_row) * 0.35
        hue = r.random(per_row)
        col = palette(base_noise[band], [(0, (0.45, 0.20, 0.15)), (1, (0.66, 0.34, 0.26))])
        col *= tones[bid][..., None]
        col = mix(col, col * np.array([0.9, 0.95, 1.05]), hue[bid] * 0.5)
        lx = xx % bw
        e = np.minimum(np.minimum(lx, bw - 1 - lx), np.minimum(yy, rh - 1 - yy))
        mortar = smoothstep(3.0, 1.2, e)
        mortar_col = palette(fbm(603, 16, 3)[band], [(0, (0.55, 0.53, 0.50)), (1, (0.72, 0.70, 0.66))])
        rgb[band] = mix(col, mortar_col, mortar)
        height[band] = smoothstep(1.0, 5.0, e) * 0.5 + base_noise[band] * 0.2
    rgb *= (0.92 + 0.16 * white(604))[..., None]
    save(f"{BLOCK}/bricks.png", shade(rgb, height, 1.1))


def stone_bricks():
    r = rng(611)
    rows, per_row = 2, 2
    rh, bw = N // rows, N // per_row
    stone_col, h0 = stone_rgb(612, (0.42, 0.42, 0.43), (0.60, 0.60, 0.61), cracks=0.3)
    rgb = np.zeros((N, N, 3))
    height = np.zeros((N, N))
    for i in range(rows):
        band = slice(i * rh, (i + 1) * rh)
        off = 0 if i % 2 == 0 else bw // 2
        yy = YY[band] - i * rh
        xx = (XX[band] - off) % N
        bid = (xx // bw).astype(int)
        tones = 0.9 + r.random(per_row) * 0.18
        lx = xx % bw
        e = np.minimum(np.minimum(lx, bw - 1 - lx), np.minimum(yy, rh - 1 - yy))
        mortar = smoothstep(3.0, 1.2, e)
        col = stone_col[band] * tones[bid][..., None]
        bevel = smoothstep(2.0, 7.0, e)
        rgb[band] = mix(col * (0.85 + 0.15 * bevel)[..., None], np.array([0.20, 0.20, 0.21]), mortar)
        height[band] = bevel * 0.6 + h0[band] * 0.3
    save(f"{BLOCK}/stone_bricks.png", shade(rgb, height, 1.1))


def glass():
    rgb = np.ones((N, N, 3)) * np.array([0.85, 0.92, 0.95])
    edge = np.minimum(np.minimum(XX, N - 1 - XX), np.minimum(YY, N - 1 - YY))
    frame = smoothstep(7.0, 5.0, edge)
    inner_line = smoothstep(1.2, 0.0, np.abs(edge - 8.0)) * 0.6
    streak = smoothstep(0.75, 0.95, value_noise(4, 701, stretch=(1.0, 0.25)))
    streak *= smoothstep(1.5, 0.0, np.abs(((XX - YY) % 40) - 20) - 6)
    alpha = np.clip(frame * 0.95 + inner_line * 0.5 + streak * 0.25, 0, 1)
    rgb = mix(rgb, np.array([0.70, 0.78, 0.82]), frame * 0.6)
    rgb = rgb + (smoothstep(1.0, 0.0, np.abs(edge - 1.5)) * 0.15)[..., None]
    save(f"{BLOCK}/glass.png", rgb, alpha)


def ice():
    h = fbm(711, 4, 5)
    f1, f2, _ = voronoi(9, 712)
    crack = smoothstep(1.4, 0.0, f2 - f1) * smoothstep(0.4, 0.6, fbm(713, 8, 3))
    rgb = palette(norm01(h), [(0, (0.55, 0.72, 0.95)), (1, (0.75, 0.86, 1.0))])
    rgb = mix(rgb, np.array([0.95, 0.98, 1.0]), crack * 0.8)
    alpha = 0.72 + crack * 0.25 + h * 0.05
    save(f"{BLOCK}/ice.png", shade(rgb, h, 0.4), alpha)


# =============================================================== pack ======

def pack_files():
    meta = {
        "pack": {
            "description": f"§dMirage Textures §7128x §8v{VERSION}\n§7Realistic procedural textures",
            "pack_format": 69,
            "supported_formats": {"min_inclusive": 34, "max_inclusive": 999},
            "min_format": 34,
            "max_format": 999,
        }
    }
    with open(os.path.join(PACK, "pack.mcmeta"), "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    # icon: a small isometric-ish preview of grass, stone and planks tiles
    tiles = [Image.open(f"{BLOCK}/{n}.png").convert("RGBA") for n in ("grass_block_side", "stone", "oak_planks", "diamond_ore")]
    icon = Image.new("RGBA", (N, N))
    for i, t in enumerate(tiles):
        icon.paste(t.resize((N // 2, N // 2), Image.LANCZOS), ((i % 2) * N // 2, (i // 2) * N // 2))
    icon.save(os.path.join(PACK, "pack.png"))


def main():
    if os.path.isdir(os.path.join(PACK, "assets")):
        shutil.rmtree(os.path.join(PACK, "assets"))
    os.makedirs(BLOCK, exist_ok=True)
    jobs = [dirt, coarse_dirt, grass_block_top, grass_block_side, grass_block_snow, snow, sand, red_sand,
            gravel, clay, stone, deepslate, deepslate_top, andesite, diorite, granite, cobblestone,
            mossy_cobblestone, cobbled_deepslate, bedrock, obsidian, netherrack, bricks, stone_bricks,
            glass, ice, short_grass]
    for job in jobs:
        job()
        print("made", job.__name__)
    for k in ("side", "top", "bottom"):
        sandstone(k)
    for m in ORES:
        ore(m)
        ore(m, deep=True)
    for w in WOODS:
        log_side(w)
        log_top(w)
        planks(w)
        leaves(w)
    pack_files()
    print("textures:", len(os.listdir(BLOCK)))


if __name__ == "__main__":
    main()
