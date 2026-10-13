#!/usr/bin/env python3
"""Compile-checks every Mirage program (all dimensions) with glslangValidator.

Resolves Iris style absolute #include paths and injects the macros Iris normally provides.
Usage: python3 shaderpacks/tools/validate.py [--define NAME ...] [--undef NAME ...]
"""
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "MirageShaders", "shaders"))
IRIS_MACROS = """#define MC_VERSION 260300
#define MC_GL_VERSION 460
#define MC_GLSL_VERSION 460
#define IRIS_VERSION 10800
#define MC_RENDER_STAGE_SUN 3
#define MC_RENDER_STAGE_MOON 4
"""
INCLUDE_RE = re.compile(r'^\s*#include\s+"([^"]+)"', re.M)

# Functions Iris/Sodium inject into patched shaders. Defining any of these ourselves breaks
# loading on real drivers ("function already defined"), which glslang alone cannot see.
IRIS_INJECTED_FUNCTIONS = [
    "signNotZero", "decodeOct24", "decode_diamond", "decode_diamond_tangent_with_sign",
    "getVertexPosition", "_get_draw_translation", "_get_relative_chunk_coord", "_get_texcoord",
    "_get_texcoord_bias", "_iris_internal_translate", "_material_mip_bias", "_deinterleave_u20x3",
    "dh_blockFaceUv", "dh_hasTexture", "dh_sampleTexture",
]
DEF_RE = re.compile(r"^\s*(?:void|float|int|uint|bool|vec[234]|ivec[234]|mat[234])\s+([A-Za-z_]\w*)\s*\(", re.M)


def resolve(path, seen, defines, undefs):
    with open(path) as f:
        text = f.read()
    rel_dir = os.path.dirname(path)

    def repl(m):
        inc = m.group(1)
        inc_path = os.path.join(ROOT, inc.lstrip("/")) if inc.startswith("/") else os.path.join(rel_dir, inc)
        return resolve(inc_path, seen, defines, undefs)

    text = INCLUDE_RE.sub(repl, text)
    if path.endswith("settings.glsl"):
        for u in undefs:
            text = re.sub(rf"^#define {u}\b.*$", f"// undef {u}", text, flags=re.M)
        for d in defines:
            name = d.split("=")[0]
            val = d.split("=")[1] if "=" in d else ""
            if re.search(rf"^//\s*#define {name}\b", text, flags=re.M):
                text = re.sub(rf"^//\s*#define {name}\b.*$", f"#define {name} {val}", text, flags=re.M)
            else:
                text = re.sub(rf"^#define {name}\b.*$", f"#define {name} {val}", text, flags=re.M)
    return text


def main():
    defines, undefs = [], []
    args = sys.argv[1:]
    while args:
        a = args.pop(0)
        if a == "--define":
            defines.append(args.pop(0))
        elif a == "--undef":
            undefs.append(args.pop(0))
    failures = 0
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for folder in ["", "world0", "world-1", "world1"]:
            d = os.path.join(ROOT, folder)
            for name in sorted(os.listdir(d)):
                if not (name.endswith(".vsh") or name.endswith(".fsh")):
                    continue
                src = resolve(os.path.join(d, name), set(), defines, undefs)
                first_nl = src.index("\n")
                src = src[:first_nl + 1] + IRIS_MACROS + src[first_nl + 1:]
                ext = "vert" if name.endswith(".vsh") else "frag"
                out = os.path.join(tmp, f"{folder or 'root'}_{name}.{ext}")
                with open(out, "w") as f:
                    f.write(src)
                total += 1
                clashes = sorted(set(DEF_RE.findall(src)) & set(IRIS_INJECTED_FUNCTIONS))
                if clashes:
                    failures += 1
                    print(f"=== {folder or '.'}/{name} === defines Iris-injected function(s): {', '.join(clashes)}")
                    continue
                r = subprocess.run(["glslangValidator", out], capture_output=True, text=True)
                if r.returncode != 0:
                    failures += 1
                    print(f"=== {folder or '.'}/{name} ===")
                    print("\n".join(l for l in r.stdout.splitlines() if "ERROR" in l or "error" in l)[:3000])
    print(f"{total - failures}/{total} programs compiled")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
