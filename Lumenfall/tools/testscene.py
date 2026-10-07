"""Procedural voxel test scene for the Lumenfall render harness.

Builds a small landscape (hills, lake, beach, trees, grass, a metal/gem showcase,
a glass wall and glowstone) as Minecraft-like block faces with all the vertex
attributes Iris provides (position, normal, colour, uv, lightmap, mc_Entity,
at_tangent, mc_midTexCoord), plus a procedural 16x16-tile texture atlas.
"""
import numpy as np

TILE = 16
ATLAS_TILES = 16
ATLAS = TILE * ATLAS_TILES
rng = np.random.default_rng(7)

# tile index per texture
T = {name: i for i, name in enumerate([
    "grass_top", "grass_side", "dirt", "stone", "sand", "log_side", "log_top", "leaves",
    "water", "iron", "diamond", "glowstone", "plant", "glass", "planks", "gold", "cobble", "snow"])}


def _noise(n=TILE, scale=1.0):
    return rng.random((n, n)) * scale


def _tile(name):
    n = TILE
    a = np.ones((n, n, 4))
    if name == "grass_top":
        base = np.array([0.36, 0.60, 0.22])
        a[..., :3] = base * (0.82 + 0.3 * _noise())[..., None]
    elif name == "grass_side":
        dirt = np.array([0.53, 0.38, 0.26])
        a[..., :3] = dirt * (0.8 + 0.3 * _noise())[..., None]
        edge = (np.arange(n)[:, None] < 3 + (rng.random((1, n)) * 2).astype(int))
        a[..., :3] = np.where(edge[..., None], np.array([0.36, 0.60, 0.22]) * (0.85 + 0.2 * _noise())[..., None], a[..., :3])
    elif name == "dirt":
        a[..., :3] = np.array([0.53, 0.38, 0.26]) * (0.75 + 0.35 * _noise())[..., None]
    elif name == "stone":
        a[..., :3] = np.array([0.50, 0.50, 0.50]) * (0.8 + 0.3 * _noise())[..., None]
    elif name == "cobble":
        v = 0.55 + 0.35 * _noise()
        v[(np.arange(n)[:, None] % 5 == 0) | (np.arange(n)[None, :] % 6 == 0)] *= 0.6
        a[..., :3] = v[..., None] * np.array([0.9, 0.9, 0.9])
    elif name == "sand":
        a[..., :3] = np.array([0.86, 0.81, 0.60]) * (0.9 + 0.15 * _noise())[..., None]
    elif name == "log_side":
        stripes = 0.75 + 0.25 * np.sin(np.arange(n)[None, :] * 1.7 + rng.random((n, 1)) * 0.6)
        a[..., :3] = np.array([0.42, 0.32, 0.20]) * (stripes * (0.85 + 0.2 * _noise()))[..., None]
    elif name == "log_top":
        y, x = np.mgrid[0:n, 0:n] - 7.5
        r = np.sqrt(x * x + y * y)
        a[..., :3] = np.array([0.66, 0.53, 0.33]) * (0.8 + 0.2 * np.sin(r * 1.6))[..., None]
    elif name == "leaves":
        a[..., :3] = np.array([0.22, 0.48, 0.14]) * (0.6 + 0.6 * _noise())[..., None]
        a[..., 3] = (rng.random((n, n)) > 0.18).astype(float)
    elif name == "water":
        a[..., :3] = (0.7 + 0.2 * _noise())[..., None]
        a[..., 3] = 0.7
    elif name == "iron":
        v = 0.86 + 0.06 * _noise()
        v[0, :] = v[-1, :] = v[:, 0] = v[:, -1] = 0.7
        a[..., :3] = v[..., None]
    elif name == "gold":
        v = 0.85 + 0.12 * _noise()
        v[0, :] = v[-1, :] = v[:, 0] = v[:, -1] = 0.65
        a[..., :3] = v[..., None] * np.array([1.0, 0.82, 0.25])
    elif name == "diamond":
        a[..., :3] = np.array([0.45, 0.90, 0.88]) * (0.85 + 0.2 * _noise())[..., None]
    elif name == "glowstone":
        v = 0.7 + 0.3 * _noise()
        a[..., :3] = np.stack([v, v * 0.82, v * 0.45], -1)
    elif name == "plant":
        a[..., :3] = np.array([0.30, 0.62, 0.20]) * (0.8 + 0.3 * _noise())[..., None]
        y, x = np.mgrid[0:n, 0:n]
        blades = np.zeros((n, n), bool)
        for bx in (2, 5, 8, 11, 13):
            h = rng.integers(6, 15)
            lean = rng.uniform(-0.25, 0.25)
            for yy in range(n - h, n):
                xx = int(round(bx + lean * (n - yy)))
                if 0 <= xx < n:
                    blades[yy, xx] = True
                    if xx + 1 < n and yy > n - h + 2:
                        blades[yy, xx + 1] = True
        a[..., 3] = blades.astype(float)
    elif name == "glass":
        a[..., :3] = 0.85
        a[..., 3] = 0.12
        a[0, :, 3] = a[-1, :, 3] = a[:, 0, 3] = a[:, -1, 3] = 0.85
        a[0, :, :3] = a[-1, :, :3] = a[:, 0, :3] = a[:, -1, :3] = 0.95
    elif name == "planks":
        v = 0.75 + 0.2 * _noise()
        v[np.arange(n) % 4 == 3, :] *= 0.65
        a[..., :3] = v[..., None] * np.array([0.72, 0.56, 0.34])
    elif name == "snow":
        a[..., :3] = (0.93 + 0.05 * _noise())[..., None]
    return np.clip(a, 0, 1)


def build_atlas():
    atlas = np.zeros((ATLAS, ATLAS, 4))
    for name, idx in T.items():
        tx, ty = idx % ATLAS_TILES, idx // ATLAS_TILES
        atlas[ty * TILE:(ty + 1) * TILE, tx * TILE:(tx + 1) * TILE] = _tile(name)
    return (atlas * 255).astype(np.uint8)


def tile_uv(name):
    idx = T[name]
    tx, ty = idx % ATLAS_TILES, idx // ATLAS_TILES
    u0, v0 = tx / ATLAS_TILES, ty / ATLAS_TILES
    s = 1.0 / ATLAS_TILES
    return u0, v0, s


# face definitions: normal, tangent, 4 corners (unit cube), corner uv
FACES = {
    "top":    ((0, 1, 0), (1, 0, 0, 1), [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)]),
    "bottom": ((0, -1, 0), (1, 0, 0, 1), [(0, 0, 1), (1, 0, 1), (1, 0, 0), (0, 0, 0)]),
    "north":  ((0, 0, -1), (-1, 0, 0, 1), [(1, 1, 0), (0, 1, 0), (0, 0, 0), (1, 0, 0)]),
    "south":  ((0, 0, 1), (1, 0, 0, 1), [(0, 1, 1), (1, 1, 1), (1, 0, 1), (0, 0, 1)]),
    "west":   ((-1, 0, 0), (0, 0, -1, 1), [(0, 1, 0), (0, 1, 1), (0, 0, 1), (0, 0, 0)]),
    "east":   ((1, 0, 0), (0, 0, 1, 1), [(1, 1, 1), (1, 1, 0), (1, 0, 0), (1, 0, 1)]),
}
UVS = [(0, 0), (1, 0), (1, 1), (0, 1)]


class Mesh:
    def __init__(self):
        self.pos, self.nrm, self.col, self.uv, self.lm, self.ent, self.tan, self.mid = ([] for _ in range(8))

    def quad(self, corners, normal, tangent, tex, color=(1, 1, 1, 1), ent=0, lm=(0, 240), uvs=UVS):
        u0, v0, s = tile_uv(tex)
        mid = (u0 + s / 2, v0 + s / 2)
        for c, (u, v) in zip(corners, uvs):
            self.pos.append(c)
            self.nrm.append(normal)
            self.col.append(color)
            self.uv.append((u0 + u * s, v0 + v * s))
            self.lm.append(lm)
            self.ent.append((ent, 0, 0, 0))
            self.tan.append(tangent)
            self.mid.append(mid)

    def arrays(self):
        f = lambda a: np.asarray(a, dtype=np.float32)
        return {k: f(getattr(self, k)) for k in ("pos", "nrm", "col", "uv", "lm", "ent", "tan", "mid")}


def build_scene(size=56, seed=3):
    r = np.random.default_rng(seed)
    xs = np.arange(-size, size)
    zs = np.arange(-size, size)
    X, Z = np.meshgrid(xs, zs, indexing="ij")

    def fbm(x, z):
        h = np.zeros_like(x, dtype=float)
        amp, freq = 1.0, 0.035
        for i in range(5):
            ph = r.random(2) * 100
            h += amp * (np.sin(x * freq + ph[0]) * np.cos(z * freq * 1.3 + ph[1]))
            amp *= 0.5
            freq *= 2.1
        return h

    height = 64 + fbm(X, Z) * 6.0
    # a lake in front of the camera and a hill behind it
    lake = np.exp(-((X - 4) ** 2 + (Z + 8) ** 2) / 500.0)
    hill = np.exp(-((X + 28) ** 2 + (Z + 40) ** 2) / 300.0)
    height = height - lake * 9.0 + hill * 16.0
    height = np.floor(height).astype(int)
    WATER = 62

    solid = {}
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            h = height[i, j]
            for y in range(h - 4, h + 1):
                if y == h:
                    b = "sand" if h <= WATER + 1 else ("snow" if h > 78 else "grass")
                elif y > h - 3:
                    b = "sand" if h <= WATER + 1 else "dirt"
                else:
                    b = "stone"
                solid[(x, y, z)] = b

    # trees
    leaves = set()
    for _ in range(14):
        i, j = r.integers(4, 2 * size - 4, 2)
        x, z = xs[i], zs[j]
        h = height[i, j]
        if h <= WATER + 1 or (abs(x - 4) < 10 and abs(z + 8) < 14):
            continue
        th = r.integers(4, 7)
        for y in range(h + 1, h + 1 + th):
            solid[(x, y, z)] = "log"
        top = h + th
        for dx in range(-2, 3):
            for dz in range(-2, 3):
                for dy in range(-1, 3):
                    if abs(dx) + abs(dz) + max(dy, 0) * 1.5 > 3.6:
                        continue
                    p = (x + dx, top + dy, z + dz)
                    if p not in solid:
                        leaves.add(p)

    # showcase: iron, gold, diamond, glowstone pillars on the near shore
    showcase = [((-6, "iron")), ((-4, "gold")), ((-2, "diamond")), ((0, "glowstone")), ((2, "planks")), ((4, "cobble"))]
    for k, (dx, b) in enumerate(showcase):
        x, z = dx, 16
        i, j = x + size, z + size
        h = height[i, j]
        for y in range(h + 1, h + 3):
            solid[(x, y, z)] = b
    glass = set()
    for dx in range(8, 12):
        for dy in range(1, 4):
            x, z = dx, 14
            h = height[x + size, z + size]
            glass.add((x, h + dy, z))

    ids = {"grass": 0, "dirt": 0, "stone": 10038, "sand": 10035, "log": 10037, "iron": 10031, "gold": 10031,
           "diamond": 10032, "glowstone": 10022, "planks": 10037, "cobble": 10038, "snow": 10034}
    tex_for = {
        "grass": {"top": "grass_top", "bottom": "dirt", "side": "grass_side"},
        "log": {"top": "log_top", "bottom": "log_top", "side": "log_side"},
    }

    def light_at(p):
        # crude skylight: full unless covered by leaves/solid above within 6 blocks
        x, y, z = p
        for yy in range(y + 1, y + 7):
            if (x, yy, z) in solid or (x, yy, z) in leaves:
                return 160
        return 240

    def block_light(p):
        x, y, z = p
        best = 0
        for (gx, gz) in [(0, 16)]:
            for gy in range(55, 90):
                if solid.get((gx, gy, gz)) == "glowstone":
                    d = abs(x - gx) + abs(y - gy) + abs(z - gz)
                    best = max(best, 15 - d)
        return max(best, 0) * 16

    opaque = Mesh()
    occupied = set(solid.keys())
    for p, b in solid.items():
        x, y, z = p
        for fname, (n, t, corners) in FACES.items():
            q = (x + n[0], y + n[1], z + n[2])
            if q in occupied:
                continue
            if fname == "bottom" and q[1] < 60:
                continue
            side = "top" if fname == "top" else ("bottom" if fname == "bottom" else "side")
            tex = tex_for.get(b, {}).get(side, {"grass": "grass_top"}.get(b, b))
            c = [(x + cx, y + cy, z + cz) for cx, cy, cz in corners]
            sky = light_at(q)
            opaque.quad(c, n, t, tex, ent=ids[b], lm=(block_light(q), sky))
    for p in leaves:
        x, y, z = p
        for fname, (n, t, corners) in FACES.items():
            q = (x + n[0], y + n[1], z + n[2])
            if q in occupied:
                continue
            c = [(x + cx, y + cy, z + cz) for cx, cy, cz in corners]
            opaque.quad(c, n, t, "leaves", ent=10001, lm=(0, light_at(q)))
    # grass plants (cross quads)
    for _ in range(900):
        i, j = r.integers(0, 2 * size, 2)
        x, z = xs[i], zs[j]
        h = height[i, j]
        if h <= WATER + 1 or (x, h + 1, z) in occupied or solid.get((x, h, z)) != "grass":
            continue
        y = h + 1
        for (a, b2) in (((0.15, 0.15), (0.85, 0.85)), ((0.15, 0.85), (0.85, 0.15))):
            c = [(x + a[0], y + 1, z + a[1]), (x + b2[0], y + 1, z + b2[1]), (x + b2[0], y, z + b2[1]), (x + a[0], y, z + a[1])]
            opaque.quad(c, (0, 1, 0), (1, 0, 0, 1), "plant", ent=10002, lm=(0, 240))

    translucent = Mesh()
    water_color = (0.25, 0.46, 0.89, 1.0)
    for i, x in enumerate(xs):
        for j, z in enumerate(zs):
            if height[i, j] < WATER:
                y = WATER + 0.889 - 1
                c = [(x, y, z), (x + 1, y, z), (x + 1, y, z + 1), (x, y, z + 1)]
                translucent.quad(c, (0, 1, 0), (1, 0, 0, 1), "water", color=water_color, ent=10010, lm=(0, 240))
    for p in glass:
        x, y, z = p
        for fname in ("north", "south"):
            n, t, corners = FACES[fname]
            c = [(x + cx, y + cy, z + cz) for cx, cy, cz in corners]
            translucent.quad(c, n, t, "glass", ent=10011, lm=(0, 240))

    ground_h = lambda x, z: height[int(x) + size, int(z) + size]
    return opaque.arrays(), translucent.arrays(), ground_h
