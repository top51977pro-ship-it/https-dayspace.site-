"""Minimal emulation of Iris' shader source handling, used by the test tools.

- resolves `#include "/path"` relative to the shaders folder (absolute) or the file (relative)
- applies option values (toggles, #define values, const options) the way Iris rewrites them
- injects the standard Iris defines after #version
- keeps a line map so compiler errors point at the original file:line
"""
import os
import re

SHADERS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shaders"))

INCLUDE_RE = re.compile(r'^\s*#include\s+"([^"]+)"')
DEFINE_RE = re.compile(r'^(\s*)(//\s*)?#define\s+([A-Za-z_][A-Za-z0-9_]*)(\s+([^/\s][^/]*?))?\s*(//.*)?$')
CONST_RE = re.compile(r'^(\s*const\s+(?:int|float|bool)\s+)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)([^;]+)(;.*)$')

IRIS_DEFINES = [
    "#define MC_VERSION 260300",
    "#define MC_GL_VERSION 450",
    "#define MC_GLSL_VERSION 450",
    "#define IS_IRIS",
    "#define IRIS_VERSION 11106",
    "#define MC_OS_LINUX",
    "#define MC_GL_VENDOR_MESA",
    "#define MC_GL_RENDERER_LLVMPIPE",
    "#define MC_RENDER_QUALITY 1.0",
    "#define MC_SHADOW_QUALITY 1.0",
    "#define MC_HAND_DEPTH 0.125",
    "#define MC_TEXTURE_FORMAT_LAB_PBR",
    "#define MC_TEXTURE_FORMAT_LAB_PBR_1_3",
]


def expand(path, lines_out, line_map, seen_stack=()):
    path = os.path.normpath(path)
    if path in seen_stack:
        raise RuntimeError("include cycle: " + " -> ".join(seen_stack + (path,)))
    with open(path, encoding="utf-8") as f:
        src = f.read().splitlines()
    for i, line in enumerate(src, 1):
        m = INCLUDE_RE.match(line)
        if m:
            inc = m.group(1)
            target = os.path.join(SHADERS, inc.lstrip("/")) if inc.startswith("/") else os.path.join(os.path.dirname(path), inc)
            expand(target, lines_out, line_map, seen_stack + (path,))
            continue
        lines_out.append(line)
        line_map.append((os.path.relpath(path, SHADERS), i))


def apply_options(lines, options):
    """options: name -> True/False (toggle) or string value."""
    out = []
    for line in lines:
        m = DEFINE_RE.match(line)
        if m and m.group(3) in options:
            indent, commented, name, _, value, comment = m.groups()
            opt = options[name]
            comment = (" " + comment) if comment else ""
            if isinstance(opt, bool):
                line = f"{indent}{'' if opt else '//'}#define {name}{(' ' + value) if value else ''}{comment}"
            else:
                line = f"{indent}#define {name} {opt}{comment}"
            out.append(line)
            continue
        m = CONST_RE.match(line)
        if m and m.group(2) in options and not isinstance(options[m.group(2)], bool):
            line = f"{m.group(1)}{m.group(2)}{m.group(3)}{options[m.group(2)]}{m.group(5)}"
        out.append(line)
    return out


def build(stub_path, options=None):
    lines, line_map = [], []
    expand(stub_path, lines, line_map)
    if options:
        lines = apply_options(lines, options)
    # inject Iris defines after #version
    assert lines[0].startswith("#version"), stub_path
    final = [lines[0]] + IRIS_DEFINES + lines[1:]
    final_map = [line_map[0]] + [("<iris>", 0)] * len(IRIS_DEFINES) + line_map[1:]
    return "\n".join(final) + "\n", final_map


def parse_profiles(props_path=os.path.join(SHADERS, "shaders.properties")):
    profiles = {}
    with open(props_path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^\s*profile\.([A-Za-z0-9_]+)\s*=\s*(.*)$", line)
            if not m:
                continue
            opts = {}
            for tok in m.group(2).split():
                if tok.startswith("profile."):
                    continue
                if tok.startswith("!"):
                    opts[tok[1:]] = False
                elif "=" in tok:
                    k, v = tok.split("=", 1)
                    opts[k] = v
                else:
                    opts[tok] = True
            profiles[m.group(1)] = opts
    return profiles
