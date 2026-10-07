#!/usr/bin/env python3
"""Generates the per-dimension entry files (world0 / world-1 / world1) that Iris loads.

Each stub only sets defines and includes the shared implementation in shaders/program.
Run this after adding or renaming programs.
"""
import os
import shutil

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shaders")
VERSION = "#version 330 compatibility"

DIMENSIONS = {
    "world0": "OVERWORLD",
    "world-1": "NETHER",
    "world1": "END",
}

# iris program name -> (implementation file, extra defines)
PROGRAMS = {
    "shadow":                        ("shadow", []),
    "prepare":                       ("prepare", []),
    "gbuffers_skybasic":             ("gbuffers_misc", ["GB_SKY"]),
    "gbuffers_skytextured":          ("gbuffers_misc", ["GB_SKY"]),
    "gbuffers_basic":                ("gbuffers_misc", ["GB_BASIC"]),
    "gbuffers_line":                 ("gbuffers_misc", ["GB_BASIC"]),
    "gbuffers_damagedblock":         ("gbuffers_misc", ["GB_DAMAGED"]),
    "gbuffers_beaconbeam":           ("gbuffers_misc", ["GB_EMISSIVE"]),
    "gbuffers_spidereyes":           ("gbuffers_misc", ["GB_EMISSIVE"]),
    "gbuffers_lightning":            ("gbuffers_misc", ["GB_EMISSIVE", "GB_LIGHTNING"]),
    "gbuffers_armor_glint":          ("gbuffers_misc", ["GB_GLINT"]),
    "gbuffers_terrain":              ("gbuffers_solid", ["GB_TERRAIN"]),
    "gbuffers_block":                ("gbuffers_solid", ["GB_BLOCK"]),
    "gbuffers_entities":             ("gbuffers_solid", ["GB_ENTITIES"]),
    "gbuffers_entities_glowing":     ("gbuffers_solid", ["GB_ENTITIES", "GB_GLOWING"]),
    "gbuffers_hand":                 ("gbuffers_solid", ["GB_HAND"]),
    "gbuffers_water":                ("gbuffers_translucent", ["GB_WATER"]),
    "gbuffers_hand_water":           ("gbuffers_translucent", ["GB_HAND_WATER"]),
    "gbuffers_entities_translucent": ("gbuffers_translucent", ["GB_ENT_TRANSLUCENT"]),
    "gbuffers_block_translucent":    ("gbuffers_translucent", ["GB_ENT_TRANSLUCENT"]),
    "gbuffers_textured":             ("gbuffers_translucent", ["GB_PARTICLES"]),
    "gbuffers_textured_lit":         ("gbuffers_translucent", ["GB_PARTICLES"]),
    "gbuffers_weather":              ("gbuffers_translucent", ["GB_WEATHER"]),
    "gbuffers_clouds":               ("gbuffers_translucent", ["GB_CLOUDS"]),
    "deferred":                      ("deferred_clouds", []),
    "deferred1":                     ("deferred_lighting", []),
    "composite":                     ("composite_water", []),
    "composite1":                    ("composite_volumetrics", []),
    "composite2":                    ("composite_taa", []),
    "composite3":                    ("composite_dof", []),
    "composite4":                    ("composite_motionblur", []),
    "composite5":                    ("composite_bloomdown", []),
    "composite6":                    ("composite_tonemap", []),
    "final":                         ("final", []),
}


def stub(stage, dim_define, impl, defines):
    lines = [VERSION, ""]
    lines.append(f"#define {stage}")
    lines.append(f"#define {dim_define}")
    for d in defines:
        lines.append(f"#define {d}")
    lines.append("")
    lines.append(f'#include "/program/{impl}.glsl"')
    return "\n".join(lines) + "\n"


def main():
    for folder, dim in DIMENSIONS.items():
        path = os.path.join(ROOT, folder)
        if os.path.isdir(path):
            shutil.rmtree(path)
        os.makedirs(path)
        for name, (impl, defines) in PROGRAMS.items():
            for ext, stage in ((".vsh", "VERTEX_SHADER"), (".fsh", "FRAGMENT_SHADER")):
                with open(os.path.join(path, name + ext), "w", newline="\n") as f:
                    f.write(stub(stage, dim, impl, defines))
    print(f"generated {len(PROGRAMS) * 2 * len(DIMENSIONS)} stub files")


if __name__ == "__main__":
    main()
