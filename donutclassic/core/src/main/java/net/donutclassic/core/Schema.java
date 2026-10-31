package net.donutclassic.core;

import java.sql.*;
import java.util.logging.Logger;

/** Versioned migrations driven by PRAGMA user_version. Append only; never edit old entries. */
final class Schema {
    private Schema() { }

    static final String[] MIGRATIONS = {
        // v1
        """
        CREATE TABLE accounts(uuid TEXT PRIMARY KEY, name TEXT, first_join INTEGER, last_seen INTEGER, last_ip TEXT);
        CREATE TABLE balances(uuid TEXT NOT NULL, currency TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(uuid, currency));
        CREATE TABLE ledger_log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, uuid TEXT, currency TEXT, delta INTEGER, reason TEXT);
        CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE spawners(id INTEGER PRIMARY KEY AUTOINCREMENT, world TEXT NOT NULL, x INTEGER, y INTEGER, z INTEGER,
            type TEXT NOT NULL, stack INTEGER NOT NULL, owner TEXT, storage TEXT, xp INTEGER DEFAULT 0, carry TEXT,
            created INTEGER, UNIQUE(world, x, y, z));
        CREATE TABLE spawner_audit(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, actor TEXT, action TEXT, spawner_id INTEGER, detail TEXT);
        CREATE TABLE homes(uuid TEXT, name TEXT COLLATE NOCASE, world TEXT, x REAL, y REAL, z REAL, yaw REAL, pitch REAL,
            PRIMARY KEY(uuid, name));
        CREATE TABLE teams(name TEXT PRIMARY KEY COLLATE NOCASE, leader TEXT, created INTEGER, friendly_fire INTEGER DEFAULT 0,
            home TEXT);
        CREATE TABLE team_members(uuid TEXT PRIMARY KEY, team TEXT COLLATE NOCASE, role TEXT, joined INTEGER);
        CREATE TABLE stats(uuid TEXT PRIMARY KEY, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, playtime INTEGER DEFAULT 0,
            duel_wins INTEGER DEFAULT 0, duel_losses INTEGER DEFAULT 0);
        CREATE TABLE ah_listings(id INTEGER PRIMARY KEY AUTOINCREMENT, seller TEXT, seller_name TEXT, item BLOB, material TEXT,
            search TEXT, price INTEGER, created INTEGER, expires INTEGER, status TEXT, buyer TEXT);
        CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, owner_name TEXT, material TEXT, amount INTEGER,
            filled INTEGER DEFAULT 0, price_each INTEGER, escrow INTEGER, created INTEGER, status TEXT);
        CREATE TABLE mailbox(id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, item BLOB, source TEXT, ts INTEGER);
        CREATE TABLE sell_log(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, uuid TEXT, material TEXT, amount INTEGER, total INTEGER, source TEXT);
        CREATE TABLE snapshots(uuid TEXT PRIMARY KEY, kind TEXT, data BLOB, location TEXT, ts INTEGER);
        CREATE TABLE settings(uuid TEXT, k TEXT, v TEXT, PRIMARY KEY(uuid, k));
        CREATE TABLE reports(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, reporter TEXT, target TEXT, reason TEXT);
        CREATE TABLE ranks(uuid TEXT PRIMARY KEY, rank TEXT);
        CREATE INDEX idx_ah_status ON ah_listings(status, expires);
        CREATE INDEX idx_mail_uuid ON mailbox(uuid);
        CREATE INDEX idx_bal_cur ON balances(currency, amount);
        """
    };

    static void migrate(Connection c, Logger log) throws SQLException {
        int version;
        try (ResultSet rs = c.createStatement().executeQuery("PRAGMA user_version")) { version = rs.next() ? rs.getInt(1) : 0; }
        for (int v = version; v < MIGRATIONS.length; v++) {
            c.setAutoCommit(false);
            try (Statement s = c.createStatement()) {
                for (String stmt : MIGRATIONS[v].split(";")) if (!stmt.isBlank()) s.execute(stmt);
                s.execute("PRAGMA user_version = " + (v + 1));
                c.commit();
                if (log != null) log.info("Database migrated to schema v" + (v + 1));
            } catch (SQLException e) { c.rollback(); throw e; }
            finally { c.setAutoCommit(true); }
        }
    }
}
