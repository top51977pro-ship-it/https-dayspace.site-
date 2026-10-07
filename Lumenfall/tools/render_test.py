#!/usr/bin/env python3
"""Lumenfall offline renderer - a small emulation of the Iris pipeline.

Runs shadow -> prepare -> gbuffers (opaque) -> deferred passes -> translucents ->
composite passes -> final on a procedural voxel scene, using Mesa llvmpipe under
Xvfb, and writes PNG screenshots. Used to iterate on the look without a GPU.

usage: xvfb-run -a python3 tools/render_test.py --out shots/test.png --time 0.05 [--opt NAME=VALUE ...]
"""
import argparse
import ctypes
import math
import os
import re
import subprocess
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glcontext  # noqa: E402
import iris_preprocess as ip  # noqa: E402
import testscene  # noqa: E402

glcontext.create_context()
from OpenGL import GL  # noqa: E402

FORMATS = {
    "RGBA16F": (GL.GL_RGBA16F, GL.GL_RGBA, GL.GL_FLOAT),
    "RGBA8": (GL.GL_RGBA8, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE),
    "RGBA16": (GL.GL_RGBA16, GL.GL_RGBA, GL.GL_UNSIGNED_SHORT),
    "R32F": (GL.GL_R32F, GL.GL_RED, GL.GL_FLOAT),
    "RGBA32F": (GL.GL_RGBA32F, GL.GL_RGBA, GL.GL_FLOAT),
}


#--------------------------------------------------------------------------------- math
def perspective(fov_deg, aspect, near, far):
    f = 1.0 / math.tan(math.radians(fov_deg) / 2)
    m = np.zeros((4, 4), np.float64)
    m[0, 0] = f / aspect
    m[1, 1] = f
    m[2, 2] = (far + near) / (near - far)
    m[2, 3] = 2 * far * near / (near - far)
    m[3, 2] = -1
    return m


def ortho(l, r, b, t, n, f):
    m = np.eye(4)
    m[0, 0] = 2 / (r - l)
    m[1, 1] = 2 / (t - b)
    m[2, 2] = -2 / (f - n)
    m[0, 3] = -(r + l) / (r - l)
    m[1, 3] = -(t + b) / (t - b)
    m[2, 3] = -(f + n) / (f - n)
    return m


def look_rotation(yaw, pitch):
    """Minecraft-like view rotation (yaw around Y, pitch around X), returns view matrix (rotation only)."""
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    ry = np.array([[cy, 0, -sy, 0], [0, 1, 0, 0], [sy, 0, cy, 0], [0, 0, 0, 1]])
    rx = np.array([[1, 0, 0, 0], [0, cp, sp, 0], [0, -sp, cp, 0], [0, 0, 0, 1]])
    return rx @ ry


def look_at(eye, target, up=(0, 1, 0)):
    eye, target, up = map(lambda v: np.asarray(v, float), (eye, target, up))
    f = target - eye
    f /= np.linalg.norm(f)
    if abs(np.dot(f, up)) > 0.999:
        up = np.array([0, 0, 1.0])
    s = np.cross(f, up)
    s /= np.linalg.norm(s)
    u = np.cross(s, f)
    m = np.eye(4)
    m[0, :3], m[1, :3], m[2, :3] = s, u, -f
    m[:3, 3] = -m[:3, :3] @ eye
    return m


#--------------------------------------------------------------------------------- GL helpers
def make_tex(w, h, fmt, filt=GL.GL_LINEAR, mip=False):
    internal, f, t = FORMATS[fmt]
    tex = GL.glGenTextures(1)
    GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
    levels = int(math.floor(math.log2(max(w, h)))) + 1 if mip else 1
    GL.glTexStorage2D(GL.GL_TEXTURE_2D, levels, internal, w, h)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR_MIPMAP_LINEAR if mip else filt)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, filt)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE)
    return tex


def make_depth(w, h, compare=False):
    tex = GL.glGenTextures(1)
    GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
    GL.glTexStorage2D(GL.GL_TEXTURE_2D, 1, GL.GL_DEPTH_COMPONENT32F, w, h)
    filt = GL.GL_LINEAR if compare else GL.GL_NEAREST
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, filt)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, filt)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE)
    if compare:
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_COMPARE_MODE, GL.GL_COMPARE_REF_TO_TEXTURE)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_COMPARE_FUNC, GL.GL_LEQUAL)
    return tex


def upload_rgba8(arr, repeat=True, linear=True, mip=False):
    h, w = arr.shape[:2]
    tex = GL.glGenTextures(1)
    GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
    GL.glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA8, w, h, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, np.ascontiguousarray(arr))
    wrap = GL.GL_REPEAT if repeat else GL.GL_CLAMP_TO_EDGE
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, wrap)
    GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, wrap)
    if mip:
        GL.glGenerateMipmap(GL.GL_TEXTURE_2D)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_NEAREST_MIPMAP_LINEAR)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_NEAREST)
    else:
        f = GL.GL_LINEAR if linear else GL.GL_NEAREST
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, f)
        GL.glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, f)
    return tex


def preprocess_directives(src):
    """Runs the C preprocessor to find the active RENDERTARGETS directive."""
    body = "\n".join(l for l in src.splitlines() if not l.startswith("#version"))
    out = subprocess.run(["cpp", "-P", "-C", "-undef", "-nostdinc", "-w"], input=body, capture_output=True, text=True).stdout
    targets = re.findall(r"RENDERTARGETS:\s*([\d,\s]+)", out)
    if targets:
        return [int(x) for x in targets[-1].replace(" ", "").split(",") if x]
    db = re.findall(r"DRAWBUFFERS:\s*(\d+)", out)
    if db:
        return [int(c) for c in db[-1]]
    return [0]


class Program:
    ATTRIBS = {"mc_Entity": 10, "at_tangent": 11, "mc_midTexCoord": 12}

    def __init__(self, dim, name, options):
        base = os.path.join(ip.SHADERS, dim, name)
        vs_src, _ = ip.build(base + ".vsh", options)
        fs_src, _ = ip.build(base + ".fsh", options)
        self.name = name
        self.targets = preprocess_directives(fs_src)
        self.prog = GL.glCreateProgram()
        for src, stage in ((vs_src, GL.GL_VERTEX_SHADER), (fs_src, GL.GL_FRAGMENT_SHADER)):
            sh = GL.glCreateShader(stage)
            GL.glShaderSource(sh, src)
            GL.glCompileShader(sh)
            if not GL.glGetShaderiv(sh, GL.GL_COMPILE_STATUS):
                raise RuntimeError(f"{name}: {GL.glGetShaderInfoLog(sh)}")
            GL.glAttachShader(self.prog, sh)
        for a, loc in self.ATTRIBS.items():
            GL.glBindAttribLocation(self.prog, loc, a)
        GL.glLinkProgram(self.prog)
        if not GL.glGetProgramiv(self.prog, GL.GL_LINK_STATUS):
            raise RuntimeError(f"{name}: {GL.glGetProgramInfoLog(self.prog)}")
        self.locs = {}

    def loc(self, n):
        if n not in self.locs:
            self.locs[n] = GL.glGetUniformLocation(self.prog, n)
        return self.locs[n]


#--------------------------------------------------------------------------------- renderer
class Renderer:
    def __init__(self, w, h, options, dim="world0"):
        self.w, self.h = w, h
        self.options = options
        self.dim = dim
        self.shadow_res = int(options.get("shadowMapResolution", 6144))
        self.shadow_dist = float(options.get("shadowDistance", 256.0))
        self.programs = {}
        self.fmt = {0: "RGBA16F", 1: "RGBA8", 2: "RGBA16", 3: "RGBA16", 4: "RGBA16F", 5: "RGBA16F",
                    6: "RGBA16", 7: "RGBA16F", 8: "R32F", 9: "RGBA32F"}
        self.clear = {0: True, 1: True, 2: True, 3: True, 4: False, 5: False, 6: True, 7: True, 8: False, 9: False}
        self.main = {i: make_tex(w, h, f, mip=(i == 0)) for i, f in self.fmt.items()}
        self.alt = {i: make_tex(w, h, f, mip=(i == 0)) for i, f in self.fmt.items()}
        self.depth0 = make_depth(w, h)
        self.depth1 = make_depth(w, h)
        self.depth2 = make_depth(w, h)
        sr = self.shadow_res
        self.shadow0 = make_depth(sr, sr)
        self.shadow1 = make_depth(sr, sr, compare=True)
        self.shadowcol = [make_tex(sr, sr, "RGBA8", GL.GL_NEAREST), make_tex(sr, sr, "RGBA8", GL.GL_NEAREST)]
        self.fbo = GL.glGenFramebuffers(1)
        self.final_tex = make_tex(w, h, "RGBA8")
        noise = np.asarray(Image.open(os.path.join(ip.SHADERS, "textures", "noise.png")).convert("RGBA"))
        self.noisetex = upload_rgba8(noise, repeat=True, linear=True)
        self.atlas = upload_rgba8(testscene.build_atlas(), repeat=False, mip=True)
        flat_n = np.zeros((16, 16, 4), np.uint8)
        flat_n[...] = (128, 128, 255, 255)
        self.normals = upload_rgba8(flat_n)
        self.specular = upload_rgba8(np.zeros((16, 16, 4), np.uint8))
        self.frame = 0
        self.history_initialised = False
        for i in self.fmt:
            for t in (self.main[i], self.alt[i]):
                self._clear_tex(t, i)

    def _clear_tex(self, tex, idx, value=(0, 0, 0, 0)):
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, self.fbo)
        GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_COLOR_ATTACHMENT0, GL.GL_TEXTURE_2D, tex, 0)
        GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_DEPTH_ATTACHMENT, GL.GL_TEXTURE_2D, 0, 0)
        for k in range(1, 8):
            GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_COLOR_ATTACHMENT0 + k, GL.GL_TEXTURE_2D, 0, 0)
        GL.glDrawBuffers(1, [GL.GL_COLOR_ATTACHMENT0])
        GL.glClearColor(*value)
        GL.glClear(GL.GL_COLOR_BUFFER_BIT)

    def program(self, name):
        if name not in self.programs:
            self.programs[name] = Program(self.dim, name, self.options)
        return self.programs[name]

    #---------------------------------------------------------------- scene
    def load_scene(self):
        opaque, translucent, self.ground_h = testscene.build_scene()
        self.meshes = {"opaque": opaque, "translucent": translucent}

    def draw_mesh(self, mesh, cam):
        pos = mesh["pos"] - np.asarray(cam, np.float32)
        GL.glEnableClientState(GL.GL_VERTEX_ARRAY)
        GL.glVertexPointer(3, GL.GL_FLOAT, 0, np.ascontiguousarray(pos))
        GL.glEnableClientState(GL.GL_NORMAL_ARRAY)
        GL.glNormalPointer(GL.GL_FLOAT, 0, mesh["nrm"])
        GL.glEnableClientState(GL.GL_COLOR_ARRAY)
        GL.glColorPointer(4, GL.GL_FLOAT, 0, mesh["col"])
        GL.glClientActiveTexture(GL.GL_TEXTURE0)
        GL.glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY)
        GL.glTexCoordPointer(2, GL.GL_FLOAT, 0, mesh["uv"])
        GL.glClientActiveTexture(GL.GL_TEXTURE1)
        GL.glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY)
        GL.glTexCoordPointer(2, GL.GL_FLOAT, 0, mesh["lm"])
        GL.glClientActiveTexture(GL.GL_TEXTURE0)
        for name, loc, comps in (("ent", 10, 4), ("tan", 11, 4), ("mid", 12, 2)):
            GL.glEnableVertexAttribArray(loc)
            GL.glVertexAttribPointer(loc, comps, GL.GL_FLOAT, GL.GL_FALSE, 0, mesh[name])
        GL.glDrawArrays(GL.GL_QUADS, 0, len(mesh["pos"]))
        for loc in (10, 11, 12):
            GL.glDisableVertexAttribArray(loc)

    #---------------------------------------------------------------- uniforms
    def set_uniforms(self, p, U):
        GL.glUseProgram(p.prog)
        for name, (kind, val) in U.items():
            loc = p.loc(name)
            if loc < 0:
                continue
            if kind == "f":
                GL.glUniform1f(loc, val)
            elif kind == "i":
                GL.glUniform1i(loc, val)
            elif kind == "v2":
                GL.glUniform2f(loc, *val)
            elif kind == "iv2":
                GL.glUniform2i(loc, *val)
            elif kind == "v3":
                GL.glUniform3f(loc, *val)
            elif kind == "v4":
                GL.glUniform4f(loc, *val)
            elif kind == "m4":
                GL.glUniformMatrix4fv(loc, 1, GL.GL_TRUE, np.asarray(val, np.float32))

    def bind_samplers(self, p, extra=None):
        units = {}
        samplers = {f"colortex{i}": self.main[i] for i in self.fmt}
        samplers.update({"depthtex0": self.depth0, "depthtex1": self.depth1, "depthtex2": self.depth2,
                         "shadowtex0": self.shadow0, "shadowtex1": self.shadow1,
                         "shadowcolor0": self.shadowcol[0], "shadowcolor1": self.shadowcol[1],
                         "noisetex": self.noisetex, "tex": self.atlas, "normals": self.normals, "specular": self.specular})
        if extra:
            samplers.update(extra)
        unit = 0
        for name, tex in samplers.items():
            loc = p.loc(name)
            if loc < 0:
                continue
            GL.glActiveTexture(GL.GL_TEXTURE0 + unit)
            GL.glBindTexture(GL.GL_TEXTURE_2D, tex)
            GL.glUniform1i(loc, unit)
            units[name] = unit
            unit += 1
        GL.glActiveTexture(GL.GL_TEXTURE0)

    def attach(self, color_texs, depth_tex):
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, self.fbo)
        for k in range(8):
            t = color_texs[k] if k < len(color_texs) else 0
            GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_COLOR_ATTACHMENT0 + k, GL.GL_TEXTURE_2D, t, 0)
        GL.glFramebufferTexture2D(GL.GL_FRAMEBUFFER, GL.GL_DEPTH_ATTACHMENT, GL.GL_TEXTURE_2D, depth_tex or 0, 0)
        GL.glDrawBuffers(len(color_texs), [GL.GL_COLOR_ATTACHMENT0 + k for k in range(len(color_texs))])
        st = GL.glCheckFramebufferStatus(GL.GL_FRAMEBUFFER)
        if st != GL.GL_FRAMEBUFFER_COMPLETE:
            raise RuntimeError(f"framebuffer incomplete {st}")

    def fullscreen(self, name, U, mipmap0=False):
        p = self.program(name)
        if mipmap0:
            GL.glBindTexture(GL.GL_TEXTURE_2D, self.main[0])
            GL.glGenerateMipmap(GL.GL_TEXTURE_2D)
        self.set_uniforms(p, U)
        self.bind_samplers(p)
        outs = [self.alt[t] for t in p.targets]
        self.attach(outs, None)
        GL.glViewport(0, 0, self.w, self.h)
        GL.glDisable(GL.GL_DEPTH_TEST)
        GL.glDisable(GL.GL_BLEND)
        GL.glMatrixMode(GL.GL_PROJECTION)
        GL.glLoadMatrixf(np.asarray(ortho(0, 1, 0, 1, 0, 1).T, np.float32))
        GL.glMatrixMode(GL.GL_MODELVIEW)
        GL.glLoadIdentity()
        GL.glBegin(GL.GL_QUADS)
        for (x, y) in ((0, 0), (1, 0), (1, 1), (0, 1)):
            GL.glMultiTexCoord2f(GL.GL_TEXTURE0, x, y)
            GL.glVertex3f(x, y, 0)
        GL.glEnd()
        for t in p.targets:
            self.main[t], self.alt[t] = self.alt[t], self.main[t]

    #---------------------------------------------------------------- frame
    def render_frame(self, cam, yaw, pitch, sun_angle, extra_uniforms, fov=70.0, frame_time=1 / 60):
        w, h = self.w, self.h
        near, far = 0.05, 256.0
        proj = perspective(fov, w / h, near, far)
        view = look_rotation(yaw, pitch)
        tilt = math.radians(float(self.options.get("sunPathRotation", -25.0)))
        a = sun_angle * 2 * math.pi
        sun_world = np.array([math.cos(a), math.sin(a) * math.cos(tilt), math.sin(a) * math.sin(tilt)])
        moon_world = -sun_world
        light_world = sun_world if sun_world[1] > -0.02 else moon_world
        to_view = lambda v: (view[:3, :3] @ v) * 100.0

        # shadow matrices (centred on the camera like Iris)
        sd = self.shadow_dist
        sview = look_at(light_world * 100.0, (0, 0, 0))
        sproj = ortho(-sd, sd, -sd, sd, 0.05, 256.0)

        prev = getattr(self, "prev", None)
        U = {
            "frameCounter": ("i", self.frame), "frameTimeCounter": ("f", self.frame * frame_time + 100.0),
            "frameTime": ("f", frame_time), "viewWidth": ("f", float(w)), "viewHeight": ("f", float(h)),
            "aspectRatio": ("f", w / h), "near": ("f", near), "far": ("f", far),
            "sunAngle": ("f", sun_angle), "rainStrength": ("f", 0.0), "wetness": ("f", 0.0),
            "isEyeInWater": ("i", 0), "moonPhase": ("i", 0), "worldTime": ("i", int(sun_angle * 24000)),
            "eyeAltitude": ("f", cam[1]), "cameraPosition": ("v3", tuple(cam)),
            "previousCameraPosition": ("v3", tuple(prev["cam"] if prev else cam)),
            "sunPosition": ("v3", tuple(to_view(sun_world))), "moonPosition": ("v3", tuple(to_view(moon_world))),
            "shadowLightPosition": ("v3", tuple(to_view(light_world))), "upPosition": ("v3", tuple(to_view(np.array([0, 1.0, 0])))),
            "eyeBrightnessSmooth": ("iv2", (0, 240)), "atlasSize": ("iv2", (testscene.ATLAS, testscene.ATLAS)),
            "gbufferModelView": ("m4", view), "gbufferModelViewInverse": ("m4", np.linalg.inv(view)),
            "gbufferProjection": ("m4", proj), "gbufferProjectionInverse": ("m4", np.linalg.inv(proj)),
            "gbufferPreviousModelView": ("m4", prev["view"] if prev else view),
            "gbufferPreviousProjection": ("m4", prev["proj"] if prev else proj),
            "shadowModelView": ("m4", sview), "shadowModelViewInverse": ("m4", np.linalg.inv(sview)),
            "shadowProjection": ("m4", sproj), "shadowProjectionInverse": ("m4", np.linalg.inv(sproj)),
            "centerDepthSmooth": ("f", getattr(self, "center_depth", 0.999)), "lightningBoltPosition": ("v4", (0, 0, 0, 0)),
            "entityColor": ("v4", (0, 0, 0, 0)), "lf_rain": ("f", 0.0), "lf_caveFactor": ("f", 0.0),
            "lf_snowyBiome": ("f", 0.0), "lf_dryBiome": ("f", 0.0), "lf_eyeSky": ("f", 1.0),
            "lf_frameTimeSmooth": ("f", frame_time), "lf_netherWastes": ("f", 1.0),
            "fogColor": ("v3", (0.2, 0.03, 0.03) if self.dim == "world-1" else (0.6, 0.7, 0.9)), "skyColor": ("v3", (0.5, 0.7, 1.0)),
        }
        U.update(extra_uniforms)

        # clears
        for i, c in self.clear.items():
            if c:
                self._clear_tex(self.main[i], i)

        # shadow pass: opaque -> shadowtex1, then translucent -> shadowtex0
        if "shadow" in self.stages:
            sp = self.program("shadow")
            self.set_uniforms(sp, U)
            self.bind_samplers(sp, {"shadowtex0": 0, "shadowtex1": 0})
            GL.glMatrixMode(GL.GL_PROJECTION)
            GL.glLoadMatrixf(np.asarray(sproj.T, np.float32))
            GL.glMatrixMode(GL.GL_MODELVIEW)
            GL.glLoadMatrixf(np.asarray(sview.T, np.float32))
            GL.glViewport(0, 0, self.shadow_res, self.shadow_res)
            GL.glEnable(GL.GL_DEPTH_TEST)
            GL.glDepthFunc(GL.GL_LEQUAL)
            GL.glDisable(GL.GL_BLEND)
            GL.glDisable(GL.GL_CULL_FACE)
            self.attach(self.shadowcol, self.shadow1)
            GL.glClearColor(1, 1, 1, 1)
            GL.glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT)
            GL.glActiveTexture(GL.GL_TEXTURE0)
            self.bind_samplers(sp, {"shadowtex0": 0, "shadowtex1": 0})
            self.draw_mesh(self.meshes["opaque"], cam)
            GL.glCopyImageSubData(self.shadow1, GL.GL_TEXTURE_2D, 0, 0, 0, 0, self.shadow0, GL.GL_TEXTURE_2D, 0, 0, 0, 0,
                                  self.shadow_res, self.shadow_res, 1)
            self.attach(self.shadowcol, self.shadow0)
            self.draw_mesh(self.meshes["translucent"], cam)

        # prepare
        self.fullscreen("prepare", U)

        # gbuffers opaque
        GL.glViewport(0, 0, w, h)
        GL.glMatrixMode(GL.GL_PROJECTION)
        GL.glLoadMatrixf(np.asarray(proj.T, np.float32))
        GL.glMatrixMode(GL.GL_MODELVIEW)
        GL.glLoadMatrixf(np.asarray(view.T, np.float32))
        GL.glMatrixMode(GL.GL_TEXTURE)
        GL.glActiveTexture(GL.GL_TEXTURE1)
        lmm = np.eye(4)
        lmm[0, 0] = lmm[1, 1] = 1 / 256
        lmm[0, 3] = lmm[1, 3] = 1 / 32
        GL.glLoadMatrixf(np.asarray(lmm.T, np.float32))
        GL.glActiveTexture(GL.GL_TEXTURE0)
        GL.glLoadIdentity()
        GL.glMatrixMode(GL.GL_MODELVIEW)

        tp = self.program("gbuffers_terrain")
        self.set_uniforms(tp, U)
        self.bind_samplers(tp)
        self.attach([self.main[t] for t in tp.targets], self.depth0)
        GL.glClearDepth(1.0)
        GL.glClear(GL.GL_DEPTH_BUFFER_BIT)
        GL.glEnable(GL.GL_DEPTH_TEST)
        GL.glDepthMask(GL.GL_TRUE)
        GL.glDisable(GL.GL_BLEND)
        self.bind_samplers(tp)
        self.draw_mesh(self.meshes["opaque"], cam)

        GL.glCopyImageSubData(self.depth0, GL.GL_TEXTURE_2D, 0, 0, 0, 0, self.depth1, GL.GL_TEXTURE_2D, 0, 0, 0, 0, w, h, 1)
        GL.glCopyImageSubData(self.depth0, GL.GL_TEXTURE_2D, 0, 0, 0, 0, self.depth2, GL.GL_TEXTURE_2D, 0, 0, 0, 0, w, h, 1)

        # deferred
        for prog in ("deferred", "deferred1"):
            if prog in self.stages:
                self.fullscreen(prog, U)

        # translucents
        wp = self.program("gbuffers_water")
        GL.glMatrixMode(GL.GL_PROJECTION)
        GL.glLoadMatrixf(np.asarray(proj.T, np.float32))
        GL.glMatrixMode(GL.GL_MODELVIEW)
        GL.glLoadMatrixf(np.asarray(view.T, np.float32))
        self.set_uniforms(wp, U)
        self.attach([self.main[t] for t in wp.targets], self.depth0)
        GL.glViewport(0, 0, w, h)
        GL.glEnable(GL.GL_DEPTH_TEST)
        GL.glEnablei(GL.GL_BLEND, 0)
        GL.glBlendFuncSeparatei(0, GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA, GL.GL_ONE, GL.GL_ONE_MINUS_SRC_ALPHA)
        GL.glDisablei(GL.GL_BLEND, 1)
        self.bind_samplers(wp)
        self.draw_mesh(self.meshes["translucent"], cam)
        GL.glDisable(GL.GL_BLEND)
        GL.glDisable(GL.GL_DEPTH_TEST)

        self.snapshot("deferred")
        for prog in ("composite", "composite1", "composite2", "composite3", "composite4", "composite5", "composite6"):
            if prog in self.stages:
                self.fullscreen(prog, U, mipmap0=prog in ("composite5", "composite6"))
                self.snapshot(prog)

        # final -> final_tex
        fp = self.program("final")
        self.set_uniforms(fp, U)
        self.bind_samplers(fp)
        self.attach([self.final_tex], None)
        GL.glMatrixMode(GL.GL_PROJECTION)
        GL.glLoadMatrixf(np.asarray(ortho(0, 1, 0, 1, 0, 1).T, np.float32))
        GL.glMatrixMode(GL.GL_MODELVIEW)
        GL.glLoadIdentity()
        GL.glBegin(GL.GL_QUADS)
        for (x, y) in ((0, 0), (1, 0), (1, 1), (0, 1)):
            GL.glMultiTexCoord2f(GL.GL_TEXTURE0, x, y)
            GL.glVertex3f(x, y, 0)
        GL.glEnd()
        GL.glFinish()

        self.prev = {"cam": cam, "view": view, "proj": proj}
        # autofocus: Iris' centerDepthSmooth is the (smoothed) depth at the screen centre
        GL.glBindTexture(GL.GL_TEXTURE_2D, self.depth0)
        d = np.frombuffer(GL.glGetTexImage(GL.GL_TEXTURE_2D, 0, GL.GL_DEPTH_COMPONENT, GL.GL_FLOAT), np.float32)
        self.center_depth = float(d.reshape(h, w)[h // 2, w // 2])
        self.frame += 1

    def snapshot(self, stage):
        if not getattr(self, "debug_dir", None) or self.frame != self.last_frame:
            return
        c = self.read_buffer(0)[..., :3]
        np.save(os.path.join(self.debug_dir, f"{stage}.npy"), c)
        if stage == "deferred":
            np.save(os.path.join(self.debug_dir, "lightdata.npy"), self.read_buffer(9)[-1, :8])
            for i in (1, 2, 3, 5, 6):
                np.save(os.path.join(self.debug_dir, f"ct{i}.npy"), self.read_buffer(i))
        if stage != "composite6":
            exp = float(self.read_buffer(9)[-1, 4, 0]) if stage else 1.0
            c = c * max(exp, 1e-3)
            c = c / (1.0 + c)
        img = (np.clip(c, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
        Image.fromarray(img).save(os.path.join(self.debug_dir, f"{self.frame:02d}_{stage}.png"))

    def read_final(self):
        GL.glBindFramebuffer(GL.GL_FRAMEBUFFER, self.fbo)
        self.attach([self.final_tex], None)
        data = GL.glReadPixels(0, 0, self.w, self.h, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE)
        img = np.frombuffer(data, np.uint8).reshape(self.h, self.w, 4)[::-1]
        return Image.fromarray(img[..., :3].copy())

    def read_buffer(self, idx):
        GL.glBindTexture(GL.GL_TEXTURE_2D, self.main[idx])
        data = GL.glGetTexImage(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, GL.GL_FLOAT)
        return np.frombuffer(data, np.float32).reshape(self.h, self.w, 4)[::-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="shots/test.png")
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--height", type=int, default=540)
    ap.add_argument("--time", type=float, default=0.08, help="sunAngle (0 sunrise, 0.25 noon, 0.5 sunset)")
    ap.add_argument("--frames", type=int, default=6)
    ap.add_argument("--cam", default="0,70,36")
    ap.add_argument("--yaw", type=float, default=180.0)
    ap.add_argument("--pitch", type=float, default=8.0)
    ap.add_argument("--profile", default=None)
    ap.add_argument("--opt", action="append", default=[])
    ap.add_argument("--uniform", action="append", default=[], help="name=value (float)")
    ap.add_argument("--dim", default="world0")
    ap.add_argument("--dump", action="store_true", help="also dump HDR buffers")
    ap.add_argument("--debug", default=None, help="directory for per-stage previews of the last frame")
    args = ap.parse_args()

    options = {"shadowMapResolution": "2048", "shadowDistance": "128.0"}
    if args.profile:
        options.update(ip.parse_profiles()[args.profile])
        options["shadowMapResolution"] = "2048"
    for o in args.opt:
        k, v = o.split("=", 1)
        options[k] = True if v == "on" else False if v == "off" else v
    extra = {}
    for u in args.uniform:
        k, v = u.split("=", 1)
        extra[k] = ("i", int(v)) if k in ("isEyeInWater", "moonPhase") else ("f", float(v))

    r = Renderer(args.width, args.height, options, args.dim)
    r.stages = {"shadow", "deferred", "deferred1", "composite", "composite1", "composite2", "composite3",
                "composite4", "composite5", "composite6"}
    if options.get("DOF") is not True:
        r.stages.discard("composite3")
    if options.get("MOTION_BLUR") is not True:
        r.stages.discard("composite4")
    r.debug_dir = args.debug
    r.last_frame = args.frames - 1
    if args.debug:
        os.makedirs(args.debug, exist_ok=True)
    t0 = time.time()
    r.load_scene()
    cam = tuple(float(c) for c in args.cam.split(","))
    for f in range(args.frames):
        r.render_frame(cam, args.yaw, args.pitch, args.time, extra, frame_time=0.5 if f < args.frames - 1 else 1 / 60)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    r.read_final().save(args.out)
    if args.dump:
        np.save(args.out.replace(".png", "_c0.npy"), r.read_buffer(0))
    print(f"wrote {args.out} in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
