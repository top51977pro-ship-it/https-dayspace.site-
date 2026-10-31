package net.donutclassic.core;

import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Reads Litematica (.litematic, versions 5-7) schematics: per-region palette + bit-packed block states,
 * block entities and entities. Coordinates returned are relative to the schematic's enclosing minimum corner.
 */
public final class Litematic {
    public final String name, author;
    public final int dataVersion;
    public final int sizeX, sizeY, sizeZ;
    public final List<Region> regions = new ArrayList<>();

    public static final class Region {
        public final String name;
        public final int offX, offY, offZ;     // region min corner relative to enclosing min corner
        public int originX, originY, originZ;  // region "Position" relative to enclosing min corner (entity Pos is relative to this)
        public final int sx, sy, sz;
        public final List<String> palette = new ArrayList<>();
        final long[] states; final int bits; final long mask;
        public final List<Map<String, Object>> tileEntities = new ArrayList<>();
        public final List<Map<String, Object>> entities = new ArrayList<>();

        Region(String name, int offX, int offY, int offZ, int sx, int sy, int sz, long[] states, int bits) {
            this.name = name; this.offX = offX; this.offY = offY; this.offZ = offZ; this.sx = sx; this.sy = sy; this.sz = sz;
            this.states = states; this.bits = bits; this.mask = (1L << bits) - 1;
        }

        public long volume() { return (long) sx * sy * sz; }

        /** Palette index at region-local x,y,z. */
        public int get(int x, int y, int z) {
            long idx = ((long) y * sz + z) * sx + x;
            long bit = idx * bits;
            int li = (int) (bit >>> 6), off = (int) (bit & 63);
            long v = states[li] >>> off;
            if (off + bits > 64) v |= states[li + 1] << (64 - off);
            return (int) (v & mask);
        }
    }

    private Litematic(String name, String author, int dv, int sx, int sy, int sz) {
        this.name = name; this.author = author; this.dataVersion = dv; this.sizeX = sx; this.sizeY = sy; this.sizeZ = sz;
    }

    public static Litematic read(File f) throws IOException {
        Map<String, Object> root = Nbt.readGzip(f);
        Map<String, Object> meta = Nbt.map(root.get("Metadata"));
        Map<String, Object> regs = Nbt.map(root.get("Regions"));
        if (regs.isEmpty()) throw new IOException("No regions - is this a .litematic file?");
        // First pass: region bounds
        record B(String n, Map<String, Object> r, int minX, int minY, int minZ, int sx, int sy, int sz, int px, int py, int pz) { }
        List<B> bounds = new ArrayList<>();
        int mx = Integer.MAX_VALUE, my = Integer.MAX_VALUE, mz = Integer.MAX_VALUE, Mx = Integer.MIN_VALUE, My = Integer.MIN_VALUE, Mz = Integer.MIN_VALUE;
        for (var e : regs.entrySet()) {
            Map<String, Object> r = Nbt.map(e.getValue());
            Map<String, Object> p = Nbt.map(r.get("Position")), s = Nbt.map(r.get("Size"));
            int[] min = new int[3], size = new int[3];
            String[] ax = {"x", "y", "z"};
            for (int k = 0; k < 3; k++) {
                int pos = Nbt.i(p.get(ax[k])), sz = Nbt.i(s.get(ax[k]));
                if (sz == 0) throw new IOException("Zero-size region");
                min[k] = sz < 0 ? pos + sz + 1 : pos; size[k] = Math.abs(sz);
            }
            bounds.add(new B(e.getKey(), r, min[0], min[1], min[2], size[0], size[1], size[2], Nbt.i(p.get("x")), Nbt.i(p.get("y")), Nbt.i(p.get("z"))));
            mx = Math.min(mx, min[0]); my = Math.min(my, min[1]); mz = Math.min(mz, min[2]);
            Mx = Math.max(Mx, min[0] + size[0]); My = Math.max(My, min[1] + size[1]); Mz = Math.max(Mz, min[2] + size[2]);
        }
        Litematic l = new Litematic(Objects.requireNonNullElse(Nbt.s(meta.get("Name")), f.getName()), Nbt.s(meta.get("Author")),
            Nbt.i(root.get("MinecraftDataVersion")), Mx - mx, My - my, Mz - mz);
        for (B b : bounds) {
            List<Object> pal = Nbt.list(b.r().get("BlockStatePalette"));
            int bits = Math.max(2, 32 - Integer.numberOfLeadingZeros(Math.max(1, pal.size() - 1)));
            long[] states = b.r().get("BlockStates") instanceof long[] a ? a : new long[0];
            long need = (b.sx() * (long) b.sy() * b.sz() * bits + 63) / 64;
            if (states.length < need) throw new IOException("Region " + b.n() + " has too few block states (" + states.length + " < " + need + ")");
            Region r = new Region(b.n(), b.minX() - mx, b.minY() - my, b.minZ() - mz, b.sx(), b.sy(), b.sz(), states, bits);
            r.originX = b.px() - mx; r.originY = b.py() - my; r.originZ = b.pz() - mz;
            for (Object o : pal) r.palette.add(blockState(Nbt.map(o)));
            for (Object o : Nbt.list(b.r().get("TileEntities"))) r.tileEntities.add(Nbt.map(o));
            for (Object o : Nbt.list(b.r().get("Entities"))) r.entities.add(Nbt.map(o));
            l.regions.add(r);
        }
        return l;
    }

    /** {Name:"minecraft:oak_stairs", Properties:{facing:"north"}} -> "minecraft:oak_stairs[facing=north]". */
    static String blockState(Map<String, Object> m) {
        String n = Objects.requireNonNullElse(Nbt.s(m.get("Name")), "minecraft:air");
        Map<String, Object> props = Nbt.map(m.get("Properties"));
        if (props.isEmpty()) return n;
        StringJoiner j = new StringJoiner(",", "[", "]");
        for (var e : new TreeMap<>(props).entrySet()) j.add(e.getKey() + "=" + e.getValue());
        return n + j;
    }

    public static boolean isAir(String state) {
        return state.equals("minecraft:air") || state.equals("minecraft:cave_air") || state.equals("minecraft:void_air");
    }

    public long nonAir() {
        long n = 0;
        for (Region r : regions) {
            boolean[] air = new boolean[r.palette.size()];
            for (int i = 0; i < air.length; i++) air[i] = isAir(r.palette.get(i));
            for (int y = 0; y < r.sy; y++) for (int z = 0; z < r.sz; z++) for (int x = 0; x < r.sx; x++) if (!air[r.get(x, y, z)]) n++;
        }
        return n;
    }
}
