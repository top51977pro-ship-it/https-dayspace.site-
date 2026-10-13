#!/usr/bin/env python3
"""Builds release/MirageTextures_128x_v<version>.zip (pack.mcmeta at the zip root)."""
import os
import zipfile

from generate_textures import PACK, VERSION

OUT = os.path.normpath(os.path.join(PACK, "..", "release", f"MirageTextures_128x_v{VERSION}.zip"))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(PACK):
        for name in sorted(files):
            path = os.path.join(base, name)
            z.write(path, os.path.relpath(path, PACK).replace(os.sep, "/"))
print("wrote", OUT)
