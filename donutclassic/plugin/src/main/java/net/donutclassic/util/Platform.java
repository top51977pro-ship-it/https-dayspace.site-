package net.donutclassic.util;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.UUID;

/** Optional Floodgate detection by reflection (soft dependency). Never relies on name prefixes. */
public final class Platform {
    private Platform() { }
    private static Object api;
    private static Method isFloodgate;
    private static boolean tried;

    public static boolean isBedrock(Player p) { return isBedrock(p.getUniqueId()); }

    public static boolean isBedrock(UUID id) {
        if (!tried) {
            tried = true;
            try {
                if (Bukkit.getPluginManager().getPlugin("floodgate") != null) {
                    Class<?> c = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
                    api = c.getMethod("getInstance").invoke(null);
                    isFloodgate = c.getMethod("isFloodgatePlayer", UUID.class);
                }
            } catch (Throwable ignored) { api = null; }
        }
        if (api == null) return false;
        try { return (boolean) isFloodgate.invoke(api, id); } catch (Throwable t) { return false; }
    }

    public static boolean floodgatePresent() { isBedrock(new UUID(0, 0)); return api != null; }
}
