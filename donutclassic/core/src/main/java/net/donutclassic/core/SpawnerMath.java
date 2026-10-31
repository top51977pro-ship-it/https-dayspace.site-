package net.donutclassic.core;

import java.util.*;

/** Pure production math for virtual spawners (no Bukkit). */
public final class SpawnerMath {
    private SpawnerMath() { }

    /** One drop line of a spawner type: material key and items per minute for a SINGLE spawner. */
    public record Drop(String material, double perMinute) { }

    /**
     * Produces items for {@code seconds} of activity. Fractions are carried between cycles in {@code carry}
     * so slow drops are not lost. Storage is clamped to {@code cap} total items; returns true if anything was added.
     */
    public static boolean produce(List<Drop> drops, double effective, double seconds,
                                  Map<String, Long> storage, Map<String, Double> carry, long cap) {
        if (seconds <= 0 || effective <= 0) return false;
        long used = total(storage);
        boolean added = false;
        for (Drop d : drops) {
            if (d.perMinute() <= 0) continue;
            double amount = d.perMinute() * effective * seconds / 60.0 + carry.getOrDefault(d.material(), 0.0);
            long whole = (long) Math.floor(amount);
            double frac = amount - whole;
            long room = Math.max(0, cap - used);
            if (whole > room) { whole = room; frac = 0; }
            carry.put(d.material(), frac);
            if (whole > 0) {
                storage.merge(d.material(), whole, Math::addExact);
                used += whole;
                added = true;
            }
        }
        return added;
    }

    public static long total(Map<String, Long> storage) {
        long t = 0;
        for (long v : storage.values()) t = Math.addExact(t, v);
        return t;
    }

    /** Storage capacity: perSpawner * stack, bounded by maxTotal (overflow safe). */
    public static long capacity(long perSpawner, long stack, long maxTotal) {
        try { return Math.min(maxTotal, Math.multiplyExact(perSpawner, Math.max(1, stack))); }
        catch (ArithmeticException e) { return maxTotal; }
    }

    /** Adds two stack sizes, refusing anything above the configured cap or overflow. -1 on refusal. */
    public static long mergeStack(long a, long b, long max) {
        if (a < 0 || b <= 0) return -1;
        long s;
        try { s = Math.addExact(a, b); } catch (ArithmeticException e) { return -1; }
        return s > max ? -1 : s;
    }

    public static String encode(Map<String, ? extends Number> m) {
        StringBuilder sb = new StringBuilder();
        for (var e : new TreeMap<>(m).entrySet()) {
            if (sb.length() > 0) sb.append(';');
            sb.append(e.getKey()).append('=').append(e.getValue());
        }
        return sb.toString();
    }

    public static Map<String, Long> decodeLongs(String s) {
        Map<String, Long> m = new HashMap<>();
        if (s == null || s.isBlank()) return m;
        for (String part : s.split(";")) {
            int i = part.indexOf('=');
            if (i > 0) try { m.put(part.substring(0, i), Long.parseLong(part.substring(i + 1))); } catch (NumberFormatException ignored) { }
        }
        return m;
    }

    public static Map<String, Double> decodeDoubles(String s) {
        Map<String, Double> m = new HashMap<>();
        if (s == null || s.isBlank()) return m;
        for (String part : s.split(";")) {
            int i = part.indexOf('=');
            if (i > 0) try { m.put(part.substring(0, i), Double.parseDouble(part.substring(i + 1))); } catch (NumberFormatException ignored) { }
        }
        return m;
    }
}
