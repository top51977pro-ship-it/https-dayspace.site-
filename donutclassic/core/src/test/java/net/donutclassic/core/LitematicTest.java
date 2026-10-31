package net.donutclassic.core;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class LitematicTest {
    @TempDir File dir;

    /** Packs palette indices exactly like Litematica (tightly, spanning longs). */
    static long[] pack(int[] idx, int bits) {
        long[] out = new long[(int) (((long) idx.length * bits + 63) / 64)];
        for (int i = 0; i < idx.length; i++) {
            long bit = (long) i * bits; int li = (int) (bit >>> 6), off = (int) (bit & 63);
            out[li] |= ((long) idx[i]) << off;
            if (off + bits > 64) out[li + 1] |= ((long) idx[i]) >>> (64 - off);
        }
        return out;
    }

    static Map<String, Object> state(String name, Map<String, Object> props) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("Name", name); if (props != null) m.put("Properties", props); return m;
    }

    static Map<String, Object> xyz(int x, int y, int z) { Map<String, Object> m = new LinkedHashMap<>(); m.put("x", x); m.put("y", y); m.put("z", z); return m; }

    /** Builds a test litematic with 5 palette entries (3 bits) and a negative-size region. */
    static File makeTest(File f) throws Exception {
        int sx = 7, sy = 3, sz = 5; // 105 entries * 3 bits spans long boundaries
        List<Object> pal = new ArrayList<>(List.of(state("minecraft:air", null), state("minecraft:stone", null),
            state("minecraft:oak_stairs", Map.of("facing", "north", "half", "bottom")), state("minecraft:oak_sign", Map.of("rotation", "0")),
            state("minecraft:chest", Map.of("facing", "south"))));
        int[] idx = new int[sx * sy * sz];
        for (int y = 0; y < sy; y++) for (int z = 0; z < sz; z++) for (int x = 0; x < sx; x++)
            idx[(y * sz + z) * sx + x] = y == 0 ? 1 : (x + z) % 3 == 0 ? 2 : 0;
        idx[(1 * sz + 2) * sx + 3] = 3; idx[(1 * sz + 4) * sx + 6] = 4;
        Map<String, Object> sign = new LinkedHashMap<>(xyz(3, 1, 2));
        sign.put("id", "minecraft:sign");
        sign.put("front_text", Map.of("messages", List.of("{\"text\":\"Welcome\",\"color\":\"gold\"}", "{\"text\":\"to spawn\"}", "\"\"", "\"\"")));
        Map<String, Object> chest = new LinkedHashMap<>(xyz(6, 1, 4)); chest.put("id", "minecraft:chest");
        chest.put("Items", List.of(Map.of("Slot", (byte) 0, "id", "minecraft:diamond", "count", 3)));
        Map<String, Object> stand = new LinkedHashMap<>();
        stand.put("id", "minecraft:armor_stand"); stand.put("Pos", List.of(-4.5, 1.0, 1.5)); // relative to region Position (x=6) stand.put("CustomName", "{\"text\":\"Crates\"}");
        Map<String, Object> region = new LinkedHashMap<>();
        region.put("Position", xyz(6, 0, 0)); region.put("Size", xyz(-sx, sy, sz));
        region.put("BlockStatePalette", pal); region.put("BlockStates", pack(idx, 3));
        region.put("TileEntities", List.of(sign, chest)); region.put("Entities", List.of(stand));
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("MinecraftDataVersion", 4325); root.put("Version", 7);
        root.put("Metadata", Map.of("Name", "test", "Author", "DonutClassic"));
        root.put("Regions", Map.of("main", region));
        Nbt.writeGzip(f, root);
        return f;
    }

    @Test void readsGeneratedLitematic() throws Exception {
        Litematic l = Litematic.read(makeTest(new File(dir, "t.litematic")));
        assertEquals(4325, l.dataVersion);
        assertEquals(7, l.sizeX); assertEquals(3, l.sizeY); assertEquals(5, l.sizeZ);
        Litematic.Region r = l.regions.get(0);
        assertEquals(0, r.offX);
        assertEquals("minecraft:oak_stairs[facing=north,half=bottom]", r.palette.get(2));
        for (int z = 0; z < 5; z++) for (int x = 0; x < 7; x++) assertEquals("minecraft:stone", r.palette.get(r.get(x, 0, z)));
        assertEquals("minecraft:oak_sign[rotation=0]", r.palette.get(r.get(3, 1, 2)));
        assertEquals("minecraft:chest[facing=south]", r.palette.get(r.get(6, 1, 4)));
        assertEquals("minecraft:oak_stairs[facing=north,half=bottom]", r.palette.get(r.get(0, 2, 0)));
        assertEquals(1, r.entities.size()); assertEquals(2, r.tileEntities.size());
        assertEquals(6, r.originX);
        assertEquals(1.5, r.originX + Nbt.d(Nbt.list(r.entities.get(0).get("Pos")).get(0)), 1e-9);
        long expected = 35 + 2; // floor + sign + chest
        for (int y = 1; y < 3; y++) for (int z = 0; z < 5; z++) for (int x = 0; x < 7; x++) if ((x + z) % 3 == 0) expected++;
        if ((3 + 2) % 3 == 0) expected--; // sign replaced a stair
        if ((6 + 4) % 3 == 0) expected--;
        assertEquals(expected, l.nonAir());
    }

    @Test void textComponents() {
        assertEquals("&6Welcome", Nbt.text("{\"text\":\"Welcome\",\"color\":\"gold\"}"));
        assertEquals("to spawn", Nbt.text(Map.of("text", "to spawn")));
        assertEquals("&lA&cB", Nbt.text(Map.of("text", "A", "bold", (byte) 1, "extra", List.of(Map.of("text", "B", "color", "red")))));
        assertEquals("", Nbt.text("\"\""));
        assertEquals("plain", Nbt.text("plain"));
    }

    @Test void nbtRoundTrip() throws Exception {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", "minecraft:diamond"); m.put("count", 3); m.put("arr", new long[]{1, -2}); m.put("l", List.of(1.5, 2.5));
        File f = new File(dir, "x.nbt"); Nbt.writeGzip(f, m);
        Map<String, Object> r = Nbt.readGzip(f);
        assertEquals("minecraft:diamond", r.get("id")); assertEquals(3, r.get("count"));
        assertArrayEquals(new long[]{1, -2}, (long[]) r.get("arr")); assertEquals(List.of(1.5, 2.5), r.get("l"));
    }

    /** Optional: DC_MAPS=/path/to/dir with real .litematic files (never committed). */
    @Test void realMapsIfProvided() throws Exception {
        String d = System.getenv("DC_MAPS");
        if (d == null) return;
        for (File f : Objects.requireNonNull(new File(d).listFiles((x, n) -> n.endsWith(".litematic")))) {
            long t = System.currentTimeMillis();
            Litematic l = Litematic.read(f);
            Litematic.Region r = l.regions.get(0);
            System.out.println(f.getName() + ": " + l.name + " by " + l.author + " dv=" + l.dataVersion + " size=" + l.sizeX + "x" + l.sizeY + "x" + l.sizeZ
                + " nonAir=" + l.nonAir() + " palette=" + r.palette.size() + " tiles=" + r.tileEntities.size() + " ents=" + r.entities.size()
                + " ms=" + (System.currentTimeMillis() - t));
            int shown = 0;
            for (var te : r.tileEntities) if (String.valueOf(te.get("id")).contains("sign") && shown++ < 12)
                System.out.println("  sign@" + te.get("x") + "," + te.get("y") + "," + te.get("z") + ": "
                    + Nbt.list(Nbt.map(te.get("front_text")).get("messages")).stream().map(Nbt::text).toList());
            for (var e : r.entities) System.out.println("  ent " + e.get("id") + " pos=" + e.get("Pos") + " name=" + Nbt.text(e.get("CustomName"))
                + " text=" + Nbt.text(e.get("text")) + " keys=" + e.keySet());
            Set<String> skulls = new TreeSet<>();
            for (var te : r.tileEntities) if (String.valueOf(te.get("id")).contains("skull")) skulls.add(te.keySet().toString());
            System.out.println("  skull keys " + skulls);
        }
    }
}
