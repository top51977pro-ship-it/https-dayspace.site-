package net.donutclassic.core;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.Executor;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;

class CoreTest {
    static final Executor DIRECT = Runnable::run;
    @TempDir File dir;

    Database open(String name) { return new Database(new File(dir, name), Logger.getLogger("test")); }

    @Test void moneyParseAndFormat() {
        assertEquals(150_000, Money.parse("1.5k"));
        assertEquals(200_000_000, Money.parse("2m"));
        assertEquals(-1, Money.parse("-5"));
        assertEquals(-1, Money.parse("NaN"));
        assertEquals(-1, Money.parse("99999999999999999999999"));
        assertEquals(-1, Money.parse("abc"));
        assertEquals("$1.5K", Money.format(150_000));
        assertEquals("$12", Money.format(1200));
        assertEquals(-1, Money.mul(Long.MAX_VALUE / 2, 3));
        assertEquals(150, Money.applyMultiplier(100, 1.5));
    }

    @Test void curveIsDiminishingAndCapped() {
        StackCurve c = StackCurve.defaults();
        assertEquals(1.0, c.effective(1), 1e-9);
        double prevPer = 1.0;
        for (long s : new long[]{10, 64, 100, 1000}) {
            double eff = c.effective(s);
            assertTrue(eff <= s, "never above stack");
            double per = eff / s;
            assertTrue(per < prevPer, "marginal output decreases");
            prevPer = per;
        }
        assertEquals(c.effective(10_000), c.effective(Long.MAX_VALUE), 1e-9, "capped at maxStack");
        StackCurve t = new StackCurve("table", 1, Map.of(1, 1.0, 10, 8.0, 100, 60.0), 1000);
        assertEquals(1 + 4.0 / 9 * 7, t.effective(5), 0.01);
        assertEquals(34.0, t.effective(55), 0.01);
    }

    @Test void productionCarriesFractionsAndRespectsCap() {
        var drops = List.of(new SpawnerMath.Drop("BONE", 3), new SpawnerMath.Drop("ARROW", 0.5));
        Map<String, Long> st = new HashMap<>(); Map<String, Double> carry = new HashMap<>();
        for (int i = 0; i < 6; i++) SpawnerMath.produce(drops, 1.0, 10, st, carry, 1000);
        assertEquals(3L, st.get("BONE"));   // 3/min for 60s
        assertEquals(0L, st.getOrDefault("ARROW", 0L)); // 0.5 accumulated as carry
        SpawnerMath.produce(drops, 1.0, 60, st, carry, 1000);
        assertEquals(1L, st.get("ARROW"));
        Map<String, Long> s2 = new HashMap<>();
        SpawnerMath.produce(drops, 1000, 600, s2, new HashMap<>(), 50);
        assertEquals(50, SpawnerMath.total(s2), "storage cap enforced");
        assertEquals(-1, SpawnerMath.mergeStack(Long.MAX_VALUE, 1, Long.MAX_VALUE));
        assertEquals(-1, SpawnerMath.mergeStack(9999, 2, 10000));
        assertEquals(Map.of("A", 1L, "B", 22L), SpawnerMath.decodeLongs(SpawnerMath.encode(Map.of("A", 1L, "B", 22L))));
    }

    @Test void ledgerDeltasPersistAndRejectOverdraft() throws Exception {
        UUID a = UUID.randomUUID(), b = UUID.randomUUID();
        try (Database db = open("l.db")) {
            Ledger l = new Ledger(db, DIRECT);
            l.load(a, "Alice", "1.1.1.1").get();
            l.load(b, "Bob", "2.2.2.2").get();
            assertTrue(l.deposit(a, Ledger.MONEY, 1000, "test"));
            assertFalse(l.withdraw(a, Ledger.MONEY, 1001, "overdraft"));
            assertFalse(l.withdraw(a, Ledger.MONEY, -5, "neg"));
            assertTrue(l.transfer(a, b, Ledger.MONEY, 400, "pay"));
            assertFalse(l.transfer(a, a, Ledger.MONEY, 1, "self"));
            l.unload(b);
            assertTrue(l.deposit(b, Ledger.SHARDS, 7, "offline credit"));
            assertFalse(l.deposit(a, Ledger.MONEY, Ledger.MAX_BALANCE, "overflow"));
            db.flush(5000);
        }
        try (Database db = open("l.db")) { // "restart"
            Ledger l = new Ledger(db, DIRECT);
            l.load(a, "Alice", null).get(); l.load(b, "Bob", null).get();
            assertEquals(600, l.get(a, Ledger.MONEY));
            assertEquals(400, l.get(b, Ledger.MONEY));
            assertEquals(7, l.get(b, Ledger.SHARDS));
            assertEquals("Alice", l.top(Ledger.MONEY, 10).get().get(0).name());
            assertEquals(b, l.findByName("bob").get());
        }
    }

    @Test void depositDuringLoadIsNotLost() throws Exception {
        UUID a = UUID.randomUUID();
        List<Runnable> queued = new ArrayList<>();
        try (Database db = open("p.db")) {
            Ledger l = new Ledger(db, queued::add); // main-thread hop is deferred
            var f = l.load(a, "A", null);
            Thread.sleep(200);
            l.deposit(a, Ledger.key("common"), 1, "keyall during load");
            queued.forEach(Runnable::run);
            f.get();
            assertEquals(1, l.get(a, Ledger.key("common")));
        }
    }

    @Test void spawnerRepoRoundTripAndUniqueBlock() throws Exception {
        try (Database db = open("s.db")) {
            SpawnerRepo repo = new SpawnerRepo(db);
            SpawnerRecord r = new SpawnerRecord("w", 1, 64, 2, "SKELETON", 2, UUID.randomUUID());
            r.storage.put("BONE", 12L); r.storage.put("ARROW", 9L); r.carry.put("BONE", 0.25); r.xpCarry = 0.5;
            r.id = repo.insert(r.snapshot(), "test").get();
            assertTrue(r.id > 0);
            SpawnerRecord dup = new SpawnerRecord("w", 1, 64, 2, "PIG", 1, null);
            assertThrows(Exception.class, () -> repo.insert(dup.snapshot(), "test").get(), "one record per block");
            r.stack = 3; r.storage.put("BONE", 20L);
            repo.saveBatch(List.of(r.snapshot())).get();
            List<SpawnerRecord> all = repo.loadAll().get();
            assertEquals(1, all.size());
            SpawnerRecord l = all.get(0);
            assertEquals(3, l.stack); assertEquals(20L, l.storage.get("BONE")); assertEquals(0.25, l.carry.get("BONE"), 1e-9);
            assertEquals(0.5, l.xpCarry, 1e-9);
            repo.delete(l.id, "test", "mined").get();
            assertTrue(repo.loadAll().get().isEmpty());
            assertEquals(2, repo.auditFor(l.id, 10).get().size());
        }
    }

    @Test void migrationsIdempotent() throws Exception {
        try (Database db = open("m.db")) { }
        try (Database db = open("m.db")) {
            int v = db.query(c -> { try (ResultSet rs = c.createStatement().executeQuery("PRAGMA user_version")) { rs.next(); return rs.getInt(1); } }).get();
            assertEquals(Schema.MIGRATIONS.length, v);
            assertTrue(db.query(Database::tables).get().contains("ah_listings"));
        }
    }

    @Test void transactionRollsBack() throws Exception {
        try (Database db = open("t.db")) {
            assertThrows(Exception.class, () -> db.tx(c -> {
                Database.exec(c, "INSERT INTO meta(k,v) VALUES('x','1')");
                Database.exec(c, "INSERT INTO nope VALUES(1)");
                return null;
            }).get());
            assertEquals(0, (int) db.query(c -> { try (ResultSet rs = c.createStatement().executeQuery("SELECT COUNT(*) FROM meta")) { rs.next(); return rs.getInt(1); } }).get());
        }
    }

    @Test void rules() {
        var pool = new ArrayList<Rules.Weighted<String>>();
        for (int i = 0; i < 10; i++) pool.add(new Rules.Weighted<>("r" + i, 1));
        List<String> seven = Rules.rollCandidates(pool, 7, new Random(1));
        assertEquals(7, seven.size()); assertEquals(7, new HashSet<>(seven).size());
        assertEquals(7, Rules.rollCandidates(List.of(new Rules.Weighted<>("only", 1)), 7, new Random()).size());

        var afk = new Rules.AfkTracker(60); UUID p = UUID.randomUUID();
        int rewards = 0;
        for (int i = 0; i < 59; i++) rewards += afk.tick(p, true);
        assertEquals(0, rewards);
        afk.tick(p, false); // left: partial minute discarded
        for (int i = 0; i < 120; i++) rewards += afk.tick(p, true);
        assertEquals(2, rewards);

        var kg = new Rules.KillGuard(600_000); UUID k = UUID.randomUUID(), v = UUID.randomUUID();
        assertTrue(kg.allow(k, v, "a", "b", true, 0));
        assertFalse(kg.allow(k, v, "a", "b", true, 1000));
        assertTrue(kg.allow(k, v, "a", "b", true, 700_000));
        assertFalse(kg.allow(k, UUID.randomUUID(), "a", "a", true, 0));

        assertTrue(Rules.keyAllDue(0, 5, 3_600_000));
        assertFalse(Rules.keyAllDue(1000, 3_000_000, 3_600_000));

        long now = 100_000;
        var q = List.of(new Rules.QueueEntry(UUID.randomUUID(), 0.9, 20, now), new Rules.QueueEntry(UUID.randomUUID(), 0.1, 0, now),
                        new Rules.QueueEntry(UUID.randomUUID(), 0.85, 18, now));
        var pair = Rules.bestPair(q, 0.5, 0.1, 0.01, now);
        assertNotNull(pair);
        assertTrue(Set.of(pair[0].winRate(), pair[1].winRate()).containsAll(Set.of(0.9, 0.85)));
        assertNull(Rules.bestPair(q.subList(0, 2), 0.5, 0.1, 0.0, now));
    }
}
