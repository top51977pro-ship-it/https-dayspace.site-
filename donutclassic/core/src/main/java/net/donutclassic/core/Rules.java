package net.donutclassic.core;

import java.util.*;
import java.util.function.ToDoubleFunction;

/** Small pure helpers: crate rolls, AFK minute counting, kill-reward guard, keyall clock, duel matchmaking. */
public final class Rules {
    private Rules() { }

    // ---------------- Crates ----------------
    public record Weighted<T>(T value, double weight) { }

    /** Picks {@code count} candidates, without repeating an entry while unused entries remain. */
    public static <T> List<T> rollCandidates(List<Weighted<T>> pool, int count, Random rnd) {
        List<T> out = new ArrayList<>();
        if (pool.isEmpty() || count <= 0) return out;
        List<Weighted<T>> left = new ArrayList<>(pool);
        while (out.size() < count) {
            if (left.isEmpty()) left = new ArrayList<>(pool);
            double total = 0;
            for (var w : left) total += Math.max(0, w.weight());
            if (total <= 0) { out.add(left.remove(rnd.nextInt(left.size())).value()); continue; }
            double r = rnd.nextDouble() * total;
            int idx = left.size() - 1;
            for (int i = 0; i < left.size(); i++) { r -= Math.max(0, left.get(i).weight()); if (r < 0) { idx = i; break; } }
            out.add(left.remove(idx).value());
        }
        return out;
    }

    // ---------------- AFK ----------------
    /** Counts seconds a player spends continuously inside the AFK region; one reward per COMPLETE minute. */
    public static final class AfkTracker {
        private final Map<UUID, Integer> seconds = new HashMap<>();
        private final int secondsPerReward;
        public AfkTracker(int secondsPerReward) { this.secondsPerReward = Math.max(1, secondsPerReward); }
        /** Call once per second. Returns how many rewards are due now (0 or 1). Leaving resets progress. */
        public int tick(UUID id, boolean inRegion) {
            if (!inRegion) { seconds.remove(id); return 0; }
            int s = seconds.merge(id, 1, Integer::sum);
            if (s >= secondsPerReward) { seconds.put(id, 0); return 1; }
            return 0;
        }
        public int progress(UUID id) { return seconds.getOrDefault(id, 0); }
        public void remove(UUID id) { seconds.remove(id); }
        public int secondsPerReward() { return secondsPerReward; }
    }

    // ---------------- Kill rewards ----------------
    /** Blocks repeated rewards for the same killer/victim pair inside a cooldown, and same-IP kills. */
    public static final class KillGuard {
        private final Map<String, Long> last = new HashMap<>();
        private final long cooldownMs;
        public KillGuard(long cooldownMs) { this.cooldownMs = cooldownMs; }
        public boolean allow(UUID killer, UUID victim, String killerIp, String victimIp, boolean sameIpBlocked, long now) {
            if (killer.equals(victim)) return false;
            if (sameIpBlocked && killerIp != null && killerIp.equals(victimIp)) return false;
            String k = killer + ">" + victim;
            Long t = last.get(k);
            if (t != null && now - t < cooldownMs) return false;
            last.put(k, now);
            if (last.size() > 10_000) last.values().removeIf(v -> now - v > cooldownMs);
            return true;
        }
    }

    // ---------------- Keyall ----------------
    /** Next due epoch-ms, given the last persisted run. Missed runs while offline are NOT stacked (no catch-up). */
    public static boolean keyAllDue(long lastRun, long now, long intervalMs) {
        return lastRun <= 0 || now - lastRun >= intervalMs;
    }

    // ---------------- Duels matchmaking (APPROXIMATION of "win rate + armor") ----------------
    public record QueueEntry(UUID id, double winRate, double armor, long joinedAt) { }

    /**
     * Rating = winRateWeight * winRate + (1-winRateWeight) * armor/20. The acceptable rating gap widens
     * with waiting time so nobody waits forever. Returns the best pair or null.
     */
    public static QueueEntry[] bestPair(List<QueueEntry> queue, double winRateWeight, double baseGap, double gapPerSecond, long now) {
        ToDoubleFunction<QueueEntry> rating = e -> winRateWeight * e.winRate() + (1 - winRateWeight) * Math.min(1, e.armor() / 20.0);
        QueueEntry[] best = null;
        double bestDiff = Double.MAX_VALUE;
        for (int i = 0; i < queue.size(); i++) for (int j = i + 1; j < queue.size(); j++) {
            QueueEntry a = queue.get(i), b = queue.get(j);
            double diff = Math.abs(rating.applyAsDouble(a) - rating.applyAsDouble(b));
            double waited = Math.min(now - a.joinedAt(), now - b.joinedAt()) / 1000.0;
            double allowed = baseGap + gapPerSecond * Math.max(0, waited);
            if (diff <= allowed && diff < bestDiff) { bestDiff = diff; best = new QueueEntry[]{a, b}; }
        }
        return best;
    }

    /** "30m", "2h", "7d", "1w", "perm" -> milliseconds; 0 = permanent; -1 = invalid. */
    public static long parseDuration(String s) {
        if (s == null || s.isBlank()) return -1;
        s = s.trim().toLowerCase(java.util.Locale.ROOT);
        if (s.equals("perm") || s.equals("permanent") || s.equals("forever")) return 0;
        long total = 0, num = -1;
        for (char c : s.toCharArray()) {
            if (Character.isDigit(c)) { num = (num < 0 ? 0 : num) * 10 + (c - '0'); if (num > 1_000_000) return -1; continue; }
            long unit = switch (c) { case 's' -> 1000L; case 'm' -> 60_000L; case 'h' -> 3_600_000L; case 'd' -> 86_400_000L; case 'w' -> 604_800_000L; case 'y' -> 31_536_000_000L; default -> -1; };
            if (unit < 0 || num < 0) return -1;
            total += num * unit; num = -1;
        }
        return num >= 0 || total <= 0 ? -1 : total;
    }

    public static String formatDuration(long ms) {
        if (ms <= 0) return "permanent";
        long s = ms / 1000, d = s / 86400, h = s / 3600 % 24, m = s / 60 % 60;
        return d > 0 ? d + "d " + h + "h" : h > 0 ? h + "h " + m + "m" : Math.max(1, m) + "m";
    }

    public static double winRate(long wins, long losses) { long t = wins + losses; return t == 0 ? 0.5 : (double) wins / t; }
}
