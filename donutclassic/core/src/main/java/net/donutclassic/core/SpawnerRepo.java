package net.donutclassic.core;

import java.sql.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/** SQLite persistence for virtual spawners. Inserts/deletes are immediate; production updates are batched. */
public final class SpawnerRepo {
    private final Database db;
    public SpawnerRepo(Database db) { this.db = db; }

    public CompletableFuture<List<SpawnerRecord>> loadAll() {
        return db.query(c -> {
            List<SpawnerRecord> out = new ArrayList<>();
            try (ResultSet rs = c.createStatement().executeQuery("SELECT id,world,x,y,z,type,stack,owner,storage,xp,carry FROM spawners")) {
                while (rs.next()) {
                    String o = rs.getString(8);
                    SpawnerRecord r = new SpawnerRecord(rs.getString(2), rs.getInt(3), rs.getInt(4), rs.getInt(5),
                        rs.getString(6), rs.getLong(7), o == null ? null : UUID.fromString(o));
                    r.id = rs.getLong(1);
                    r.storage.putAll(SpawnerMath.decodeLongs(rs.getString(9)));
                    r.xp = rs.getLong(10);
                    Map<String, Double> carry = SpawnerMath.decodeDoubles(rs.getString(11));
                    Double xc = carry.remove("__xp");
                    r.xpCarry = xc == null ? 0 : xc;
                    r.carry.putAll(carry);
                    out.add(r);
                }
            }
            return out;
        });
    }

    /** Inserts and returns the new id (UNIQUE(world,x,y,z) prevents two records for one block). */
    public CompletableFuture<Long> insert(SpawnerRecord.Snapshot s, String actor) {
        return db.tx(c -> {
            long id = Database.insert(c, "INSERT INTO spawners(world,x,y,z,type,stack,owner,storage,xp,carry,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                s.world(), s.x(), s.y(), s.z(), s.type(), s.stack(), s.owner(), s.storage(), s.xp(), s.carry(), System.currentTimeMillis());
            audit(c, actor, "place", id, s.type() + " x" + s.stack());
            return id;
        });
    }

    public CompletableFuture<Void> saveBatch(Collection<SpawnerRecord.Snapshot> list) {
        if (list.isEmpty()) return CompletableFuture.completedFuture(null);
        return db.tx(c -> {
            try (PreparedStatement ps = c.prepareStatement("UPDATE spawners SET type=?, stack=?, owner=?, storage=?, xp=?, carry=? WHERE id=?")) {
                for (var s : list) {
                    if (s.id() < 0) continue;
                    Database.bind(ps, s.type(), s.stack(), s.owner(), s.storage(), s.xp(), s.carry(), s.id());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            return null;
        });
    }

    public CompletableFuture<Void> update(SpawnerRecord.Snapshot s, String actor, String action, String detail) {
        return db.tx(c -> {
            Database.exec(c, "UPDATE spawners SET type=?, stack=?, owner=?, storage=?, xp=?, carry=? WHERE id=?",
                s.type(), s.stack(), s.owner(), s.storage(), s.xp(), s.carry(), s.id());
            audit(c, actor, action, s.id(), detail);
            return null;
        });
    }

    public CompletableFuture<Void> delete(long id, String actor, String detail) {
        return db.tx(c -> {
            Database.exec(c, "DELETE FROM spawners WHERE id=?", id);
            audit(c, actor, "remove", id, detail);
            return null;
        });
    }

    public CompletableFuture<List<String>> auditFor(long id, int limit) {
        return db.query(c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT ts,actor,action,detail FROM spawner_audit WHERE spawner_id=? ORDER BY id DESC LIMIT ?")) {
                ps.setLong(1, id); ps.setInt(2, limit);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) out.add(new java.util.Date(rs.getLong(1)) + " " + rs.getString(2) + " " + rs.getString(3) + " " + rs.getString(4));
                }
            }
            return out;
        });
    }

    static void audit(Connection c, String actor, String action, long id, String detail) throws SQLException {
        Database.exec(c, "INSERT INTO spawner_audit(ts,actor,action,spawner_id,detail) VALUES(?,?,?,?,?)",
            System.currentTimeMillis(), actor, action, id, detail);
    }
}
