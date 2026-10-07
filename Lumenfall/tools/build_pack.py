#!/usr/bin/env python3
"""Packages the shader pack into release/Lumenfall_v<version>.zip (drop it into .minecraft/shaderpacks)."""
import os
import sys
import zipfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.0"


def main():
    out_dir = os.path.join(ROOT, "release")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"Lumenfall_v{VERSION}.zip")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(os.path.join(ROOT, "shaders")):
            for f in sorted(files):
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, ROOT))
        for extra in ("README.md", "CREDITS.md"):
            z.write(os.path.join(ROOT, extra), extra)
    print("wrote", out, f"({os.path.getsize(out) // 1024} KiB)")


if __name__ == "__main__":
    main()
