package net.donutclassic.util;

import net.donutclassic.DonutClassic;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.util.*;

/**
 * Admin-bound positions stored in warps.yml by WORLD UUID (with the world name as a fallback),
 * e.g. spawn, afk, region corners, warps and crate blocks. Missing worlds resolve to null.
 */
public final class Locs {
    private final DonutClassic plugin;
    public Locs(DonutClassic plugin) { this.plugin = plugin; }
    public void reload() { }

    private YamlConfiguration y() { return plugin.cfg("warps.yml"); }

    public void set(String path, Location l) {
        y().set(path, l == null ? null : write(l));
        plugin.saveCfg("warps.yml");
    }

    public Location get(String path) {
        ConfigurationSection s = y().getConfigurationSection(path);
        return s == null ? null : read(s);
    }

    public Set<String> keys(String path) {
        ConfigurationSection s = y().getConfigurationSection(path);
        return s == null ? Set.of() : s.getKeys(false);
    }

    public static Map<String, Object> write(Location l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("world-uuid", l.getWorld().getUID().toString());
        m.put("world", l.getWorld().getName());
        m.put("x", l.getX()); m.put("y", l.getY()); m.put("z", l.getZ());
        m.put("yaw", (double) l.getYaw()); m.put("pitch", (double) l.getPitch());
        return m;
    }

    public static Location read(ConfigurationSection s) {
        World w = null;
        try { String u = s.getString("world-uuid"); if (u != null) w = Bukkit.getWorld(UUID.fromString(u)); } catch (IllegalArgumentException ignored) { }
        if (w == null && s.getString("world") != null) w = Bukkit.getWorld(s.getString("world"));
        if (w == null) return null;
        return new Location(w, s.getDouble("x"), s.getDouble("y"), s.getDouble("z"), (float) s.getDouble("yaw"), (float) s.getDouble("pitch"));
    }

    /** "worldUUID;x;y;z" for block keys. */
    public static String blockKey(Block b) { return b.getWorld().getUID() + ";" + b.getX() + ";" + b.getY() + ";" + b.getZ(); }

    public static String serialize(Location l) {
        return l.getWorld().getUID() + ";" + l.getX() + ";" + l.getY() + ";" + l.getZ() + ";" + l.getYaw() + ";" + l.getPitch();
    }

    public static Location deserialize(String s) {
        if (s == null) return null;
        String[] p = s.split(";");
        if (p.length < 4) return null;
        try {
            World w = Bukkit.getWorld(UUID.fromString(p[0]));
            if (w == null) return null;
            return new Location(w, Double.parseDouble(p[1]), Double.parseDouble(p[2]), Double.parseDouble(p[3]),
                p.length > 4 ? Float.parseFloat(p[4]) : 0, p.length > 5 ? Float.parseFloat(p[5]) : 0);
        } catch (IllegalArgumentException e) { return null; }
    }

    /** Spawn, or the main world's spawn if unbound / world deleted. */
    public Location spawn() {
        Location l = get("spawn");
        return l != null ? l : Bukkit.getWorlds().get(0).getSpawnLocation();
    }

    public Cuboid cuboid(String a, String b) {
        Location l1 = get(a), l2 = get(b);
        if (l1 == null || l2 == null || !l1.getWorld().equals(l2.getWorld())) return null;
        return new Cuboid(l1, l2);
    }

    /** Axis-aligned block region in one world. */
    public record Cuboid(UUID world, int minX, int minY, int minZ, int maxX, int maxY, int maxZ) {
        public Cuboid(Location a, Location b) {
            this(a.getWorld().getUID(), Math.min(a.getBlockX(), b.getBlockX()), Math.min(a.getBlockY(), b.getBlockY()),
                Math.min(a.getBlockZ(), b.getBlockZ()), Math.max(a.getBlockX(), b.getBlockX()), Math.max(a.getBlockY(), b.getBlockY()),
                Math.max(a.getBlockZ(), b.getBlockZ()));
        }
        public boolean contains(Location l) {
            return l != null && l.getWorld() != null && l.getWorld().getUID().equals(world)
                && l.getBlockX() >= minX && l.getBlockX() <= maxX && l.getBlockY() >= minY && l.getBlockY() <= maxY
                && l.getBlockZ() >= minZ && l.getBlockZ() <= maxZ;
        }
        public boolean contains(Block b) { return contains(b.getLocation()); }
    }
}
