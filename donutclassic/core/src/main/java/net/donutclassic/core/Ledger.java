package net.donutclassic.core;

import java.sql.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * One ledger for every per-player numeric resource: money (stored in cents), shards and the
 * five virtual crate keys. Online players are cached; every change is written to SQLite as a
 * signed DELTA on the single DB thread, so offline credits, restarts and concurrent writers can
 * never overwrite each other. All public methods must be called from ONE thread (the server
 * main thread); DB completions are hopped back via {@code main}.
 */
public final class Ledger {
    public static final String MONEY = "money", SHARDS = "shards";
    /** Hard cap far below Long.MAX_VALUE so sums of balances can never overflow. */
    public static final long MAX_BALANCE = 1_000_000_000_000_000L;

    private final Database db;
    private final Executor main;
    private final Map<UUID, Map<String, Long>> cache = new HashMap<>();
    private final Map<UUID, List<Object[]>> loading = new HashMap<>();

    public Ledger(Database db, Executor main) { this.db = db; this.main = main; }

    public static String key(String crate) { return "key_" + crate.toLowerCase(Locale.ROOT); }

    public CompletableFuture<Void> load(UUID id, String name, String ip) {
        loading.putIfAbsent(id, new ArrayList<>());
        String u = id.toString();
        long now = System.currentTimeMillis();
        return db.query(c -> {
            Database.exec(c, "INSERT OR IGNORE INTO accounts(uuid,name,first_join,last_seen,last_ip) VALUES(?,?,?,?,?)", u, name, now, now, ip);
            Database.exec(c, "UPDATE accounts SET name=?, last_seen=?, last_ip=? WHERE uuid=?", name, now, ip, u);
            Map<String, Long> m = new HashMap<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT currency, amount FROM balances WHERE uuid=?")) {
                ps.setString(1, u);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) m.put(rs.getString(1), rs.getLong(2)); }
            }
            return m;
        }).thenAcceptAsync(m -> {
            List<Object[]> pending = loading.remove(id);
            if (pending == null) return; // unloaded while loading
            for (Object[] p : pending) m.merge((String) p[0], (Long) p[1], Long::sum);
            cache.put(id, m);
        }, main);
    }

    public void unload(UUID id) { cache.remove(id); loading.remove(id); }
    public boolean isLoaded(UUID id) { return cache.containsKey(id); }

    /** Cached balance, or -1 when the account is not loaded. */
    public long get(UUID id, String cur) {
        Map<String, Long> m = cache.get(id);
        return m == null ? -1 : m.getOrDefault(cur, 0L);
    }

    public CompletableFuture<Long> getAny(UUID id, String cur) {
        long v = get(id, cur);
        if (v >= 0) return CompletableFuture.completedFuture(v);
        return db.query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT amount FROM balances WHERE uuid=? AND currency=?")) {
                ps.setString(1, id.toString()); ps.setString(2, cur);
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getLong(1) : 0L; }
            }
        });
    }

    /** Removes {@code amount} if the loaded account has enough. Returns false otherwise (nothing changes). */
    public boolean withdraw(UUID id, String cur, long amount, String reason) {
        if (amount < 0) return false;
        Map<String, Long> m = cache.get(id);
        if (m == null) return false;
        long bal = m.getOrDefault(cur, 0L);
        if (bal < amount) return false;
        if (amount == 0) return true;
        m.put(cur, bal - amount);
        writeDelta(id, cur, -amount, reason);
        return true;
    }

    /** Adds {@code amount}; works for offline players too. False if it would exceed MAX_BALANCE for a cached account. */
    public boolean deposit(UUID id, String cur, long amount, String reason) {
        if (amount < 0) return false;
        if (amount == 0) return true;
        Map<String, Long> m = cache.get(id);
        if (m != null) {
            long bal = m.getOrDefault(cur, 0L);
            if (amount > MAX_BALANCE - bal) return false;
            m.put(cur, bal + amount);
        } else {
            if (amount > MAX_BALANCE) return false;
            List<Object[]> p = loading.get(id);
            if (p != null) p.add(new Object[]{cur, amount});
        }
        writeDelta(id, cur, amount, reason);
        return true;
    }

    /** Set an exact balance (admin). Only for loaded accounts. */
    public boolean set(UUID id, String cur, long amount, String reason) {
        long bal = get(id, cur);
        if (bal < 0 || amount < 0 || amount > MAX_BALANCE) return false;
        return amount >= bal ? deposit(id, cur, amount - bal, reason) : withdraw(id, cur, bal - amount, reason);
    }

    public boolean transfer(UUID from, UUID to, String cur, long amount, String reason) {
        if (from.equals(to) || amount <= 0) return false;
        if (!withdraw(from, cur, amount, reason)) return false;
        if (!deposit(to, cur, amount, reason)) { deposit(from, cur, amount, reason + " (refund)"); return false; }
        return true;
    }

    private void writeDelta(UUID id, String cur, long delta, String reason) {
        String u = id.toString();
        long now = System.currentTimeMillis();
        db.tx(c -> {
            Database.exec(c, "INSERT OR IGNORE INTO balances(uuid,currency,amount) VALUES(?,?,0)", u, cur);
            Database.exec(c, "UPDATE balances SET amount = MAX(0, MIN(?, amount + ?)) WHERE uuid=? AND currency=?", MAX_BALANCE, delta, u, cur);
            Database.exec(c, "INSERT INTO ledger_log(ts,uuid,currency,delta,reason) VALUES(?,?,?,?,?)", now, u, cur, delta, reason);
            return null;
        });
    }

    public record TopEntry(UUID uuid, String name, long amount) { }

    public CompletableFuture<List<TopEntry>> top(String cur, int limit) {
        return db.query(c -> {
            List<TopEntry> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                "SELECT b.uuid, a.name, b.amount FROM balances b LEFT JOIN accounts a ON a.uuid=b.uuid WHERE b.currency=? AND b.amount>0 ORDER BY b.amount DESC LIMIT ?")) {
                ps.setString(1, cur); ps.setInt(2, limit);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) out.add(new TopEntry(UUID.fromString(rs.getString(1)), rs.getString(2), rs.getLong(3)));
                }
            }
            return out;
        });
    }

    public CompletableFuture<UUID> findByName(String name) {
        return db.query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT uuid FROM accounts WHERE name=? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? UUID.fromString(rs.getString(1)) : null; }
            }
        });
    }
}
