#!/usr/bin/env python3
"""Generates the per-dimension program stubs, block.properties and the noise texture for Mirage.

Run from anywhere:  python3 shaderpacks/tools/generate.py
"""
import os
import struct
import zlib
import random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "MirageShaders", "shaders")

# program name -> (source file in /program, extra define or None)
PROGRAMS = {
    "gbuffers_basic":        ("gbuffers_simple",  "PROG_BASIC"),
    "gbuffers_textured":     ("gbuffers_forward", "PROG_PARTICLES"),
    "gbuffers_textured_lit": ("gbuffers_forward", "PROG_PARTICLES"),
    "gbuffers_skybasic":     ("gbuffers_simple",  "PROG_SKYBASIC"),
    "gbuffers_skytextured":  ("gbuffers_simple",  "PROG_SKYTEXTURED"),
    "gbuffers_clouds":       ("gbuffers_simple",  "PROG_CLOUDS"),
    "gbuffers_terrain":      ("gbuffers_solid",   "PROG_TERRAIN"),
    "gbuffers_entities":     ("gbuffers_solid",   "PROG_ENTITIES"),
    "gbuffers_block":        ("gbuffers_solid",   "PROG_BLOCK"),
    "gbuffers_beaconbeam":   ("gbuffers_simple",  "PROG_BEACONBEAM"),
    "gbuffers_spidereyes":   ("gbuffers_simple",  "PROG_SPIDEREYES"),
    "gbuffers_armor_glint":  ("gbuffers_simple",  "PROG_ARMOR_GLINT"),
    "gbuffers_damagedblock": ("gbuffers_simple",  "PROG_DAMAGEDBLOCK"),
    "gbuffers_hand":         ("gbuffers_forward", "PROG_HAND"),
    "gbuffers_hand_water":   ("gbuffers_forward", "PROG_HAND_WATER"),
    "gbuffers_weather":      ("gbuffers_forward", "PROG_WEATHER"),
    "gbuffers_water":        ("gbuffers_water",   None),
    "shadow":                ("shadow",           None),
    "deferred":              ("deferred",         None),
    "composite":             ("composite",        None),
    "composite1":            ("composite1",       None),
    "composite2":            ("composite2",       None),
    "final":                 ("final",            None),
}

# folder -> dimension define. The root folder is the fallback for modded dimensions.
DIMENSIONS = {
    "":         "OVERWORLD",
    "world0":   "OVERWORLD",
    "world-1":  "NETHER",
    "world1":   "END",
}

HEADER = "#version 330 compatibility\n"


def write_stubs():
    for folder, dim in DIMENSIONS.items():
        out_dir = os.path.join(ROOT, folder) if folder else ROOT
        os.makedirs(out_dir, exist_ok=True)
        for prog, (src, define) in PROGRAMS.items():
            if prog == "shadow" and dim == "NETHER":
                continue  # no shadow pass in the Nether
            for ext, stage in (("vsh", "VSH"), ("fsh", "FSH")):
                lines = [HEADER, f"\n#define {dim}\n#define {stage}\n"]
                if define:
                    lines.append(f"#define {define}\n")
                lines.append(f'\n#include "/program/{src}.glsl"\n')
                with open(os.path.join(out_dir, f"{prog}.{ext}"), "w", newline="\n") as f:
                    f.write("".join(lines))


COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
          "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"]

WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"]

COPPER = ["", "exposed_", "weathered_", "oxidized_"]


def block_properties():
    plants = [
        "short_grass", "grass", "fern", "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet",
        "red_tulip", "orange_tulip", "white_tulip", "pink_tulip", "oxeye_daisy", "cornflower",
        "lily_of_the_valley", "wither_rose", "torchflower", "torchflower_crop", "closed_eyeblossom",
        "open_eyeblossom", "dead_bush", "short_dry_grass", "tall_dry_grass", "bush", "firefly_bush",
        "wheat", "carrots", "potatoes", "beetroots", "sweet_berry_bush", "nether_sprouts",
        "crimson_roots", "warped_roots", "crimson_fungus", "warped_fungus", "brown_mushroom",
        "red_mushroom", "mangrove_propagule", "pitcher_crop",
    ] + [f"{w}_sapling" for w in WOODS if w != "mangrove"]
    tall = ["tall_grass", "large_fern", "sunflower", "lilac", "rose_bush", "peony", "pitcher_plant"]
    leaves = [f"{w}_leaves" for w in WOODS] + ["azalea_leaves", "flowering_azalea_leaves"]
    vines = ["vine", "weeping_vines", "weeping_vines_plant", "twisting_vines", "twisting_vines_plant",
             "cave_vines", "cave_vines_plant", "pale_hanging_moss", "hanging_roots", "spore_blossom"]
    water_plants = ["seagrass", "tall_seagrass", "kelp", "kelp_plant"]
    glass = (["glass", "glass_pane", "tinted_glass", "slime_block", "honey_block"]
             + [f"{c}_stained_glass" for c in COLORS] + [f"{c}_stained_glass_pane" for c in COLORS])
    emissive = ["glowstone", "sea_lantern", "shroomlight", "ochre_froglight", "verdant_froglight",
                "pearlescent_froglight", "jack_o_lantern", "redstone_lamp:lit=true", "beacon", "end_rod",
                "magma_block", "crying_obsidian", "conduit", "respawn_anchor", "sculk_catalyst",
                "copper_bulb:lit=true", "exposed_copper_bulb:lit=true", "weathered_copper_bulb:lit=true",
                "oxidized_copper_bulb:lit=true", "waxed_copper_bulb:lit=true",
                "waxed_exposed_copper_bulb:lit=true", "waxed_weathered_copper_bulb:lit=true",
                "waxed_oxidized_copper_bulb:lit=true", "end_portal_frame", "enchanting_table"]
    candles = ["candle"] + [f"{c}_candle" for c in COLORS]
    light_sources = (["torch", "wall_torch", "soul_torch", "soul_wall_torch", "copper_torch",
                      "copper_wall_torch", "lantern", "soul_lantern", "campfire:lit=true",
                      "soul_campfire:lit=true", "fire", "soul_fire", "redstone_torch:lit=true",
                      "redstone_wall_torch:lit=true", "furnace:lit=true", "blast_furnace:lit=true",
                      "smoker:lit=true", "glow_lichen", "sea_pickle", "amethyst_cluster",
                      "large_amethyst_bud", "brewing_stand", "redstone_wire", "repeater:powered=true",
                      "comparator:powered=true", "firefly_bush", "creaking_heart"]
                     + [f"{c}:lit=true" for c in candles] + [f"{c}_candle_cake:lit=true" for c in COLORS]
                     + ["candle_cake:lit=true"]
                     + [f"{p}copper_lantern" for p in COPPER] + [f"waxed_{p}copper_lantern" for p in COPPER])
    ores = ["coal_ore", "iron_ore", "copper_ore", "gold_ore", "redstone_ore", "emerald_ore", "lapis_ore",
            "diamond_ore", "nether_gold_ore", "nether_quartz_ore", "ancient_debris", "amethyst_block",
            "budding_amethyst"]
    ores += [f"deepslate_{o}" for o in ores[:8]]
    metals = ["iron_block", "gold_block", "diamond_block", "emerald_block", "netherite_block",
              "lightning_rod", "anvil", "chipped_anvil", "damaged_anvil", "bell", "iron_bars", "iron_door",
              "iron_trapdoor", "chain", "heavy_core"]
    for p in COPPER:
        metals += [f"{p}copper_block" if p else "copper_block", f"{p}cut_copper", f"waxed_{p}copper_block" if p else "waxed_copper_block",
                   f"waxed_{p}cut_copper"]
    polished = ["polished_andesite", "polished_diorite", "polished_granite", "polished_deepslate",
                "polished_blackstone", "polished_basalt", "polished_tuff", "quartz_block", "smooth_quartz",
                "quartz_pillar", "quartz_bricks", "chiseled_quartz_block", "smooth_stone", "obsidian",
                "calcite", "prismarine_bricks", "dark_prismarine", "purpur_block", "purpur_pillar",
                "packed_ice", "blue_ice"] + [f"{c}_glazed_terracotta" for c in COLORS] + [f"{c}_concrete" for c in COLORS]

    def line(i, names):
        return f"block.{i} = " + " ".join(names) + "\n"

    text = "# Mirage Shaders - block ids (generated by tools/generate.py)\n\n"
    text += "# waving plants (top vertices move)\n" + line(10001, plants)
    text += "# double tall plants\n" + line(10002, [f"{t}:half=lower" for t in tall])
    text += line(10003, [f"{t}:half=upper" for t in tall])
    text += "# leaves\n" + line(10004, leaves)
    text += "# vines / hanging plants\n" + line(10005, vines)
    text += "# underwater plants\n" + line(10006, water_plants)
    text += "# soil (retextured dirt)\n" + line(10007, ["dirt", "coarse_dirt", "rooted_dirt", "grass_block", "dirt_path", "farmland"])
    text += "\n# water\n" + line(10010, ["water", "flowing_water", "bubble_column"])
    text += "# translucent blocks\n" + line(10011, glass)
    text += line(10012, ["ice", "frosted_ice"])
    text += line(10013, ["nether_portal"])
    text += "\n# fully emissive\n" + line(10020, emissive)
    text += "# lava\n" + line(10021, ["lava", "flowing_lava"])
    text += "# light sources (only bright pixels glow)\n" + line(10022, light_sources)
    text += "\n# ores (glow with the Glowing Ores option)\n" + line(10030, ores)
    text += "\n# reflective\n" + line(10040, metals) + line(10041, polished)
    text += "\n# end portal effect\n" + line(10050, ["end_portal", "end_gateway"])
    with open(os.path.join(ROOT, "block.properties"), "w", newline="\n") as f:
        f.write(text)


def write_png(path, width, height, rgba_rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rgba_rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def noise_texture():
    # R: white noise, G: R shifted by 37 texels in x for single-fetch 3D value noise, B/A: independent noise.
    # (a pure x shift keeps the trick valid however the image rows end up oriented on the GPU)
    size = 256
    rng = random.Random(1337)
    r = [[rng.randrange(256) for _ in range(size)] for _ in range(size)]
    b = [[rng.randrange(256) for _ in range(size)] for _ in range(size)]
    a = [[rng.randrange(256) for _ in range(size)] for _ in range(size)]
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            g = r[y][(x + 37) % size]
            row += [r[y][x], g, b[y][x], a[y][x]]
        rows.append(row)
    os.makedirs(os.path.join(ROOT, "textures"), exist_ok=True)
    write_png(os.path.join(ROOT, "textures", "noise.png"), size, size, rows)


if __name__ == "__main__":
    write_stubs()
    block_properties()
    noise_texture()
    print("generated into", os.path.normpath(ROOT))
