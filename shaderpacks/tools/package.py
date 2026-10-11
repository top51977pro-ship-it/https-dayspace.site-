#!/usr/bin/env python3
"""Builds release/Aurelia-v<version>.zip (zip root contains shaders/ as Iris expects)."""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.normpath(os.path.join(HERE, "..", "Aurelia"))
VERSION = "1.3"
OUT = os.path.normpath(os.path.join(HERE, "..", "release", f"Aurelia-v{VERSION}.zip"))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(PACK):
        for name in sorted(files):
            path = os.path.join(base, name)
            arc = os.path.relpath(path, PACK).replace(os.sep, "/")
            z.write(path, arc)
print("wrote", OUT)
