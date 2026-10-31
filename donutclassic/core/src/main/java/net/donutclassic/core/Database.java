package net.donutclassic.core;

import java.io.File;
import java.sql.*;
import java.util.List;
import java.util.concurrent.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * SQLite access on ONE dedicated thread. Every statement is serialized, which gives a
 * strict ordering of writes (important for the delta-based ledger) and keeps all blocking
 * IO off the Minecraft main thread.
 */
public final class Database implements AutoCloseable {
    @FunctionalInterface public interface SqlFn<T> { T apply(Connection c) throws SQLException; }
    @FunctionalInterface public interface SqlRun { void run(Connection c) throws SQLException; }

    private final ExecutorService exec;
    private final Logger log;
    private Connection conn;

    public Database(File file, Logger log) {
        this.log = log;
        this.exec = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "DonutClassic-DB");
            t.setDaemon(true);
            return t;
        });
        try {
            exec.submit(() -> {
                try { Class.forName("org.sqlite.JDBC"); } catch (ClassNotFoundException ignored) { }
                conn = DriverManager.getConnection("jdbc:sqlite:" + file.getAbsolutePath());
                try (Statement s = conn.createStatement()) {
                    s.execute("PRAGMA journal_mode=WAL");
                    s.execute("PRAGMA synchronous=NORMAL");
                    s.execute("PRAGMA foreign_keys=ON");
                    s.execute("PRAGMA busy_timeout=5000");
                }
                Schema.migrate(conn, log);
                return null;
            }).get();
        } catch (Exception e) {
            throw new IllegalStateException("Could not open database " + file, e);
        }
    }

    /** Run a read/write on the DB thread (autocommit). */
    public <T> CompletableFuture<T> query(SqlFn<T> fn) {
        CompletableFuture<T> f = new CompletableFuture<>();
        try {
            exec.execute(() -> {
                try { f.complete(fn.apply(conn)); } catch (Throwable t) {
                    log.log(Level.SEVERE, "DB query failed", t); f.completeExceptionally(t);
                }
            });
        } catch (RejectedExecutionException e) { f.completeExceptionally(e); }
        return f;
    }

    /** Run several statements as ONE transaction; rolled back on any error. */
    public <T> CompletableFuture<T> tx(SqlFn<T> fn) {
        return query(c -> {
            boolean old = c.getAutoCommit();
            c.setAutoCommit(false);
            try { T r = fn.apply(c); c.commit(); return r; }
            catch (SQLException | RuntimeException e) { c.rollback(); throw e; }
            finally { c.setAutoCommit(old); }
        });
    }

    public CompletableFuture<Void> run(SqlRun r) { return tx(c -> { r.run(c); return null; }); }

    /** Waits for every queued write (used on shutdown). */
    public void flush(long timeoutMs) {
        try { query(c -> null).get(timeoutMs, TimeUnit.MILLISECONDS); }
        catch (Exception e) { log.log(Level.WARNING, "DB flush timed out", e); }
    }

    /** Online SQLite backup (VACUUM INTO) to the given file. */
    public CompletableFuture<Void> backup(File target) {
        return query(c -> {
            try (PreparedStatement ps = c.prepareStatement("VACUUM INTO ?")) {
                ps.setString(1, target.getAbsolutePath()); ps.execute();
            }
            return null;
        });
    }

    @Override public void close() {
        flush(10_000);
        exec.submit(() -> { try { if (conn != null) conn.close(); } catch (SQLException ignored) { } });
        exec.shutdown();
        try { exec.awaitTermination(10, TimeUnit.SECONDS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
    }

    public static void exec(Connection c, String sql, Object... args) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) { bind(ps, args); ps.executeUpdate(); }
    }

    public static long insert(Connection c, String sql, Object... args) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            bind(ps, args); ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) { return rs.next() ? rs.getLong(1) : -1; }
        }
    }

    public static void bind(PreparedStatement ps, Object... args) throws SQLException {
        for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
    }

    public static List<String> tables(Connection c) throws SQLException {
        List<String> out = new java.util.ArrayList<>();
        try (ResultSet rs = c.createStatement().executeQuery("SELECT name FROM sqlite_master WHERE type='table'")) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }
}
