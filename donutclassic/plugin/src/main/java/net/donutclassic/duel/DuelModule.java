package net.donutclassic.duel;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Rules;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.*;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;

import java.io.*;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/**
 * Duels (/duel <player>, /duel accept, /duel queue) in admin-defined arenas, plus survival combat tag.
 * Before a duel each player's inventory, armour, XP, health and location are snapshotted to SQLite; the
 * snapshot is restored after the duel, on disconnect, and on next join after a crash. In the default
 * "own-gear" mode nothing is lost (drops are cleared, the snapshot restores everything).
 */
public final class DuelModule extends Module {
    private record Req(UUID from, long expires) { }
    final class Match { String arena; UUID a, b; boolean over; }

    private final Map<UUID, Req> requests = new HashMap<>();
    private final Map<UUID, Match> matches = new HashMap<>();
    private final Set<String> busyArenas = new HashSet<>();
    private final List<Rules.QueueEntry> queue = new ArrayList<>();
    private final Map<UUID, long[]> stats = new HashMap<>(); // wins, losses
    private final Map<UUID, Long> tagged = new HashMap<>();
    private BukkitTask queueTask, tagTask;

    public DuelModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "duels"; }
    private YamlConfiguration y() { return cfg("duels.yml"); }

    @Override public void enable() {
        command("duel", this::cmd, (s, a) -> a.length == 1 ? merge(List.of("accept", "deny", "queue", "leave", "stats"), players()) : null);
        queueTask = Bukkit.getScheduler().runTaskTimer(plugin, this::matchQueue, 40L, 40L);
        tagTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tagTick, 20L, 20L);
    }

    @Override public void disable() {
        if (queueTask != null) queueTask.cancel();
        if (tagTask != null) tagTask.cancel();
        for (Match m : new ArrayList<>(new HashSet<>(matches.values()))) { restore(m.a); restore(m.b); }
    }

    private static List<String> merge(List<String> a, List<String> b) { List<String> l = new ArrayList<>(a); l.addAll(b); return l; }

    public boolean inDuel(UUID id) { return matches.containsKey(id); }
    public boolean isTagged(UUID id) { Long t = tagged.get(id); return t != null && t > System.currentTimeMillis(); }
    public long tagRemaining(UUID id) { Long t = tagged.get(id); return t == null ? 0 : Math.max(0, t - System.currentTimeMillis()); }

    // ------------------------------------------------------------------ commands
    private void cmd(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length == 0) { menu(p); return; }
        switch (a[0].toLowerCase(Locale.ROOT)) {
            case "accept" -> {
                Req r = requests.remove(p.getUniqueId());
                Player from = r == null ? null : Bukkit.getPlayer(r.from());
                if (from == null || r.expires() < System.currentTimeMillis()) { msg().send(p, "duel.no-request"); return; }
                start(from, p);
            }
            case "deny" -> { if (requests.remove(p.getUniqueId()) != null) msg().send(p, "duel.denied"); }
            case "queue" -> toggleQueue(p);
            case "leave" -> { Match m = matches.get(p.getUniqueId()); if (m != null) finish(m, other(m, p.getUniqueId()), "forfeit"); else leaveQueue(p); }
            case "stats" -> {
                Player t = a.length > 1 ? Bukkit.getPlayerExact(a[1]) : p;
                if (t == null) { msg().send(p, "error.unknown-player"); return; }
                long[] st = stats.getOrDefault(t.getUniqueId(), new long[2]);
                msg().send(p, "duel.stats", "player", t.getName(), "wins", st[0], "losses", st[1],
                    "rate", String.format(Locale.ROOT, "%.0f%%", Rules.winRate(st[0], st[1]) * 100));
            }
            default -> {
                Player t = Bukkit.getPlayerExact(a[0]);
                if (t == null || t.equals(p)) { msg().send(p, "error.unknown-player"); return; }
                if (!plugin.misc.setting(t.getUniqueId(), "duels", true)) { msg().send(p, "duel.disabled"); return; }
                if (inDuel(t.getUniqueId()) || inDuel(p.getUniqueId())) { msg().send(p, "duel.busy"); return; }
                requests.put(t.getUniqueId(), new Req(p.getUniqueId(), System.currentTimeMillis() + 60_000));
                msg().send(p, "duel.sent", "player", t.getName());
                msg().send(t, "duel.received", "player", p.getName());
            }
        }
    }

    public void menu(Player p) {
        Menu m = new Menu(3, "&8Duels");
        boolean queued = queue.stream().anyMatch(e -> e.id().equals(p.getUniqueId()));
        m.set(11, Items.make(Material.DIAMOND_SWORD, queued ? "&cLeave queue" : "&aJoin random queue", "&7Matched by win rate and armour",
            "&8(approximation of the classic queue)"), e -> { toggleQueue(p); p.closeInventory(); });
        long[] st = stats.getOrDefault(p.getUniqueId(), new long[2]);
        m.set(13, Items.make(Material.BOOK, "&eYour stats", "&7Wins: &a" + st[0], "&7Losses: &c" + st[1]));
        m.set(15, Items.make(Material.PAPER, "&bChallenge a player", "&7/duel <player>", "&7/duel accept"));
        m.open(p);
    }

    private void toggleQueue(Player p) {
        if (queue.removeIf(e -> e.id().equals(p.getUniqueId()))) { msg().send(p, "duel.queue-left"); return; }
        if (inDuel(p.getUniqueId())) return;
        long[] st = stats.getOrDefault(p.getUniqueId(), new long[2]);
        queue.add(new Rules.QueueEntry(p.getUniqueId(), Rules.winRate(st[0], st[1]), armor(p), System.currentTimeMillis()));
        msg().send(p, "duel.queue-joined");
    }

    private void leaveQueue(Player p) { queue.removeIf(e -> e.id().equals(p.getUniqueId())); }

    /** Armour points from worn armour material tiers (vanilla values). */
    static double armor(Player p) {
        double sum = 0;
        for (ItemStack it : p.getInventory().getArmorContents()) {
            if (it == null) continue;
            String n = it.getType().name();
            int slot = n.endsWith("_HELMET") ? 0 : n.endsWith("_CHESTPLATE") ? 1 : n.endsWith("_LEGGINGS") ? 2 : n.endsWith("_BOOTS") ? 3 : -1;
            if (slot < 0) continue;
            int[] pts = n.startsWith("NETHERITE") || n.startsWith("DIAMOND") ? new int[]{3, 8, 6, 3} : n.startsWith("IRON") ? new int[]{2, 6, 5, 2}
                : n.startsWith("CHAINMAIL") ? new int[]{2, 5, 4, 1} : n.startsWith("GOLDEN") ? new int[]{2, 5, 3, 1} : n.startsWith("LEATHER") ? new int[]{1, 3, 2, 1} : new int[]{2, 0, 0, 0};
            sum += pts[slot];
        }
        return sum;
    }

    private void matchQueue() {
        queue.removeIf(e -> Bukkit.getPlayer(e.id()) == null || inDuel(e.id()));
        if (queue.size() < 2) return;
        Rules.QueueEntry[] pair = Rules.bestPair(queue, y().getDouble("queue.win-rate-weight", 0.5), y().getDouble("queue.base-gap", 0.15),
            y().getDouble("queue.gap-growth-per-second", 0.01), System.currentTimeMillis());
        if (pair == null) return;
        queue.remove(pair[0]); queue.remove(pair[1]);
        Player a = Bukkit.getPlayer(pair[0].id()), b = Bukkit.getPlayer(pair[1].id());
        if (a != null && b != null) start(a, b);
    }

    // ------------------------------------------------------------------ match lifecycle
    private String freeArena() {
        ConfigurationSection s = y().getConfigurationSection("arenas");
        if (s == null) return null;
        for (String k : s.getKeys(false)) if (!busyArenas.contains(k) && plugin.locs().get("duel-arenas." + k + ".pos1") != null && plugin.locs().get("duel-arenas." + k + ".pos2") != null) return k;
        for (String k : plugin.locs().keys("duel-arenas")) if (!busyArenas.contains(k) && plugin.locs().get("duel-arenas." + k + ".pos1") != null && plugin.locs().get("duel-arenas." + k + ".pos2") != null) return k;
        return null;
    }

    private void start(Player a, Player b) {
        if (inDuel(a.getUniqueId()) || inDuel(b.getUniqueId())) return;
        if (isTagged(a.getUniqueId()) || isTagged(b.getUniqueId())) { msg().send(a, "combat.no-teleport"); msg().send(b, "combat.no-teleport"); return; }
        String arena = freeArena();
        if (arena == null) { msg().send(a, "duel.no-arena"); msg().send(b, "duel.no-arena"); return; }
        busyArenas.add(arena);
        Match m = new Match(); m.arena = arena; m.a = a.getUniqueId(); m.b = b.getUniqueId();
        matches.put(m.a, m); matches.put(m.b, m);
        snapshot(a); snapshot(b);
        leaveQueue(a); leaveQueue(b);
        for (Player p : List.of(a, b)) { p.setHealth(p.getMaxHealth()); p.setFoodLevel(20); p.setFireTicks(0); p.setGameMode(GameMode.SURVIVAL); }
        a.teleportAsync(plugin.locs().get("duel-arenas." + arena + ".pos1"));
        b.teleportAsync(plugin.locs().get("duel-arenas." + arena + ".pos2"));
        msg().send(a, "duel.start", "player", b.getName());
        msg().send(b, "duel.start", "player", a.getName());
        long max = y().getLong("max-duration-seconds", 300) * 20L;
        Bukkit.getScheduler().runTaskLater(plugin, () -> { if (!m.over) finish(m, null, "time limit"); }, max);
    }

    private UUID other(Match m, UUID id) { return m.a.equals(id) ? m.b : m.a; }

    /** winner == null -> draw. */
    private void finish(Match m, UUID winner, String reason) {
        if (m.over) return;
        m.over = true;
        matches.remove(m.a); matches.remove(m.b);
        if (winner != null) {
            UUID loser = other(m, winner);
            addStat(winner, true); addStat(loser, false);
            Player w = Bukkit.getPlayer(winner), l = Bukkit.getPlayer(loser);
            String wn = w != null ? w.getName() : "?", ln = l != null ? l.getName() : "?";
            for (UUID u : List.of(m.a, m.b)) { Player p = Bukkit.getPlayer(u); if (p != null) msg().send(p, "duel.end", "winner", wn, "loser", ln, "reason", reason); }
        } else for (UUID u : List.of(m.a, m.b)) { Player p = Bukkit.getPlayer(u); if (p != null) msg().send(p, "duel.draw", "reason", reason); }
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            for (UUID u : List.of(m.a, m.b)) { Player p = Bukkit.getPlayer(u); if (p != null && !p.isDead()) restore(u); }
            busyArenas.remove(m.arena);
        }, 60L);
    }

    private void addStat(UUID id, boolean win) {
        long[] st = stats.computeIfAbsent(id, k -> new long[2]);
        st[win ? 0 : 1]++;
        String col = win ? "duel_wins" : "duel_losses";
        plugin.db().query(c -> { Database.exec(c, "INSERT OR IGNORE INTO stats(uuid) VALUES(?)", id.toString());
            Database.exec(c, "UPDATE stats SET " + col + " = " + col + " + 1 WHERE uuid=?", id.toString()); return null; });
    }

    // ------------------------------------------------------------------ snapshots
    private void snapshot(Player p) {
        byte[] data;
        try (ByteArrayOutputStream bo = new ByteArrayOutputStream(); DataOutputStream out = new DataOutputStream(bo)) {
            byte[] inv = Items.toBytes(p.getInventory().getContents());
            out.writeInt(inv.length); out.write(inv);
            out.writeDouble(p.getHealth()); out.writeInt(p.getFoodLevel()); out.writeInt(p.getLevel()); out.writeFloat(p.getExp());
            out.writeUTF(p.getGameMode().name());
            out.flush(); data = bo.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException(e); }
        String loc = Locs.serialize(p.getLocation());
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO snapshots(uuid,kind,data,location,ts) VALUES(?,?,?,?,?)",
            p.getUniqueId().toString(), "duel", data, loc, System.currentTimeMillis()); return null; });
    }

    /** Restores and deletes the snapshot (if any) for an online player. */
    private void restore(UUID id) {
        plugin.db().tx(c -> {
            Object[] row = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT data,location FROM snapshots WHERE uuid=? AND kind='duel'")) {
                ps.setString(1, id.toString());
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) row = new Object[]{rs.getBytes(1), rs.getString(2)}; }
            }
            return row;
        }).thenAccept(row -> plugin.runSync(() -> {
            Player p = Bukkit.getPlayer(id);
            if (row == null || p == null) return;
            try (DataInputStream in = new DataInputStream(new ByteArrayInputStream((byte[]) row[0]))) {
                byte[] inv = new byte[in.readInt()]; in.readFully(inv);
                p.getInventory().setContents(Items.arrayFromBytes(inv));
                double hp = in.readDouble(); int food = in.readInt(), lvl = in.readInt(); float exp = in.readFloat();
                GameMode gm = GameMode.valueOf(in.readUTF());
                p.setHealth(Math.max(1, Math.min(hp, p.getMaxHealth()))); p.setFoodLevel(food); p.setLevel(lvl); p.setExp(exp); p.setGameMode(gm);
                p.setFireTicks(0);
            } catch (Exception e) { plugin.getLogger().severe("Snapshot restore failed for " + id + ": " + e); return; }
            Location l = Locs.deserialize((String) row[1]);
            p.teleportAsync(l != null ? l : plugin.locs().spawn());
            plugin.db().query(c -> { Database.exec(c, "DELETE FROM snapshots WHERE uuid=? AND kind='duel'", id.toString()); return null; });
        }));
    }

    @Override public void onDataLoaded(Player p) {
        plugin.db().query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT duel_wins, duel_losses FROM stats WHERE uuid=?")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? new long[]{rs.getLong(1), rs.getLong(2)} : new long[2]; }
            }
        }).thenAccept(st -> plugin.runSync(() -> stats.put(p.getUniqueId(), st)));
        if (!inDuel(p.getUniqueId())) restore(p.getUniqueId()); // crash / disconnect recovery
    }

    // ------------------------------------------------------------------ events
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onDeath(PlayerDeathEvent e) {
        Match m = matches.get(e.getEntity().getUniqueId());
        if (m == null) return;
        if (y().getString("gear-mode", "own-gear-no-loss").equals("own-gear-no-loss")) {
            e.setKeepInventory(true); e.getDrops().clear(); e.setKeepLevel(true); e.setDroppedExp(0);
        }
        finish(m, other(m, e.getEntity().getUniqueId()), "death");
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onRespawn(PlayerRespawnEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        Bukkit.getScheduler().runTaskLater(plugin, () -> { if (!inDuel(id)) restore(id); }, 2L);
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        requests.remove(id); leaveQueue(e.getPlayer());
        Match m = matches.get(id);
        if (m != null) finish(m, other(m, id), "disconnect"); // snapshot restores on next join
        if (isTagged(id) && y().getBoolean("combat.kill-on-logout", true) && !e.getPlayer().hasPermission("dc.combat.bypass")) {
            e.getPlayer().setHealth(0);
            Bukkit.broadcastMessage(msg().get("combat.logged-out", "player", e.getPlayer().getName()));
        }
        tagged.remove(id);
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onHit(EntityDamageByEntityEvent e) {
        if (!(e.getEntity() instanceof Player victim)) return;
        Entity d = e.getDamager();
        if (d instanceof Projectile pr && pr.getShooter() instanceof Entity sh) d = sh;
        if (!(d instanceof Player attacker) || attacker.equals(victim)) return;
        Match m = matches.get(victim.getUniqueId());
        if (m != null || inDuel(attacker.getUniqueId())) {
            if (m == null || !m.equals(matches.get(attacker.getUniqueId()))) e.setCancelled(true); // no outside interference
            return;
        }
        long until = System.currentTimeMillis() + y().getLong("combat.tag-seconds", 15) * 1000;
        if (!isTagged(victim.getUniqueId())) msg().send(victim, "combat.tagged");
        if (!isTagged(attacker.getUniqueId())) msg().send(attacker, "combat.tagged");
        tagged.put(victim.getUniqueId(), until); tagged.put(attacker.getUniqueId(), until);
    }

    @EventHandler(ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        String cmd = e.getMessage().substring(1).split(" ")[0].toLowerCase(Locale.ROOT);
        if (cmd.contains(":")) cmd = cmd.substring(cmd.indexOf(':') + 1);
        if (inDuel(id) && !y().getStringList("allowed-commands-in-duel").contains(cmd)) { e.setCancelled(true); msg().send(e.getPlayer(), "duel.no-commands"); return; }
        if (isTagged(id) && !e.getPlayer().hasPermission("dc.combat.bypass") && y().getStringList("combat.blocked-commands").contains(cmd)) {
            e.setCancelled(true); msg().send(e.getPlayer(), "combat.no-teleport");
        }
    }

    private void tagTick() {
        long now = System.currentTimeMillis();
        tagged.entrySet().removeIf(en -> {
            if (en.getValue() > now) return false;
            Player p = Bukkit.getPlayer(en.getKey());
            if (p != null) msg().send(p, "combat.untagged");
            return true;
        });
    }

    // ------------------------------------------------------------------ admin
    public void adminArena(CommandSender s, String[] a) {
        // /dc duel setarena <name> <1|2>   |   /dc duel delarena <name>
        Player p = player(s); if (p == null) return;
        if (a.length >= 4 && a[1].equalsIgnoreCase("setarena") && (a[3].equals("1") || a[3].equals("2"))) {
            String name = a[2].toLowerCase(Locale.ROOT);
            plugin.locs().set("duel-arenas." + name + ".pos" + a[3], p.getLocation());
            msg().send(p, "admin.set", "what", "arena " + name + " spawn " + a[3]);
        } else if (a.length >= 3 && a[1].equalsIgnoreCase("delarena")) {
            plugin.locs().set("duel-arenas." + a[2].toLowerCase(Locale.ROOT), null);
            msg().send(p, "admin.done");
        } else msg().sendRaw(p, "&e/dc duel setarena <name> <1|2> &7| &e/dc duel delarena <name>");
    }
}
