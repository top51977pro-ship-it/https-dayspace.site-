#!/usr/bin/env python3
"""Compiles and links every Lumenfall program for every dimension and preset on a real
OpenGL 4.5 compatibility driver (Mesa llvmpipe under Xvfb).

usage: xvfb-run -a python3 tools/compile_test.py [--profile NAME|all] [--program NAME] [--dim world0]
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glcontext  # noqa: E402
import iris_preprocess as ip  # noqa: E402

glcontext.create_context()
from OpenGL import GL  # noqa: E402

VERSION_OVERRIDE = None
ERR_RE = re.compile(r"(\d+):(\d+)\((\d+)\)")


def map_log(log, line_map):
    def repl(m):
        line = int(m.group(2))
        if 1 <= line <= len(line_map):
            f, l = line_map[line - 1]
            return f"{f}:{l}"
        return m.group(0)
    return ERR_RE.sub(repl, log)


def compile_stage(src, stage, line_map):
    sh = GL.glCreateShader(stage)
    GL.glShaderSource(sh, src)
    GL.glCompileShader(sh)
    ok = GL.glGetShaderiv(sh, GL.GL_COMPILE_STATUS)
    log = GL.glGetShaderInfoLog(sh)
    log = log.decode(errors="replace") if isinstance(log, bytes) else (log or "")
    return sh, bool(ok), map_log(log, line_map)


def test_program(dim, name, options):
    base = os.path.join(ip.SHADERS, dim, name)
    vs_src, vs_map = ip.build(base + ".vsh", options)
    fs_src, fs_map = ip.build(base + ".fsh", options)
    if VERSION_OVERRIDE:
        vs_src = vs_src.replace("#version 330 compatibility", VERSION_OVERRIDE, 1)
        fs_src = fs_src.replace("#version 330 compatibility", VERSION_OVERRIDE, 1)
    vs, vok, vlog = compile_stage(vs_src, GL.GL_VERTEX_SHADER, vs_map)
    fs, fok, flog = compile_stage(fs_src, GL.GL_FRAGMENT_SHADER, fs_map)
    errors = []
    if not vok:
        errors.append("VERTEX:\n" + vlog)
    if not fok:
        errors.append("FRAGMENT:\n" + flog)
    if vok and fok:
        prog = GL.glCreateProgram()
        GL.glAttachShader(prog, vs)
        GL.glAttachShader(prog, fs)
        GL.glLinkProgram(prog)
        if not GL.glGetProgramiv(prog, GL.GL_LINK_STATUS):
            plog = GL.glGetProgramInfoLog(prog)
            errors.append("LINK:\n" + (plog.decode(errors="replace") if isinstance(plog, bytes) else plog))
        GL.glDeleteProgram(prog)
    warnings = [l for l in (vlog + "\n" + flog).splitlines() if "warning" in l.lower()]
    GL.glDeleteShader(vs)
    GL.glDeleteShader(fs)
    return errors, warnings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="default")
    ap.add_argument("--program")
    ap.add_argument("--dim")
    ap.add_argument("--warnings", action="store_true")
    ap.add_argument("--version", default=None, help='e.g. "#version 460 compatibility" (stricter keyword set)')
    args = ap.parse_args()
    global VERSION_OVERRIDE
    VERSION_OVERRIDE = args.version

    profiles = ip.parse_profiles()
    if args.profile == "all":
        selected = {"default": {}}
        selected.update(profiles)
    elif args.profile == "default":
        selected = {"default": {}}
    else:
        selected = {args.profile: profiles[args.profile]}

    dims = [args.dim] if args.dim else ["world0", "world-1", "world1"]
    total_fail = 0
    for pname, opts in selected.items():
        for dim in dims:
            names = sorted({f[:-4] for f in os.listdir(os.path.join(ip.SHADERS, dim)) if f.endswith(".fsh")})
            if args.program:
                names = [n for n in names if n == args.program]
            fails = 0
            for n in names:
                errs, warns = test_program(dim, n, opts)
                if errs:
                    fails += 1
                    print(f"[FAIL] {pname} {dim}/{n}")
                    for e in errs:
                        print("   " + "\n   ".join(e.strip().splitlines()[:25]))
                elif args.warnings and warns:
                    print(f"[warn] {pname} {dim}/{n}")
                    for w in warns[:10]:
                        print("   " + w)
            total_fail += fails
            print(f"{pname:12s} {dim:8s} {len(names) - fails}/{len(names)} programs OK")
    sys.exit(1 if total_fail else 0)


if __name__ == "__main__":
    main()
