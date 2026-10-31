package net.donutclassic.core;

import java.util.*;

/** In-memory state of one placed virtual spawner block. Mutated only on the main thread. */
public final class SpawnerRecord {
    public long id = -1;           // DB id, -1 until inserted
    public final String world;      // world UUID
    public final int x, y, z;
    public String type;
    public long stack;
    public UUID owner;
    public final Map<String, Long> storage = new HashMap<>();
    public final Map<String, Double> carry = new HashMap<>();
    public long xp;
    public double xpCarry;
    public boolean dirty;
    public boolean removed;
    public boolean full;
    public long lastActive;

    public SpawnerRecord(String world, int x, int y, int z, String type, long stack, UUID owner) {
        this.world = world; this.x = x; this.y = y; this.z = z; this.type = type; this.stack = stack; this.owner = owner;
    }

    public String key() { return key(world, x, y, z); }
    public static String key(String world, int x, int y, int z) { return world + ":" + x + ":" + y + ":" + z; }
    public long chunkKey() { return chunkKey(x >> 4, z >> 4); }
    public static long chunkKey(int cx, int cz) { return ((long) cx << 32) ^ (cz & 0xffffffffL); }

    /** Immutable copy for async persistence. */
    public Snapshot snapshot() {
        Map<String, Double> c = new HashMap<>(carry);
        c.put("__xp", xpCarry);
        return new Snapshot(id, world, x, y, z, type, stack, owner == null ? null : owner.toString(),
            SpawnerMath.encode(storage), xp, SpawnerMath.encode(c));
    }

    public record Snapshot(long id, String world, int x, int y, int z, String type, long stack, String owner,
                           String storage, long xp, String carry) { }
}
