package net.donutclassic.misc;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.*;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.*;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.*;
import org.bukkit.permissions.PermissionAttachment;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.scheduler.BukkitTask;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stats (kills/deaths/playtime), /stats /playtime /top, /settings, ranks (permissions.yml, admin-assigned,
 * never sold), chat format + anti-spam, /rules /help /report, announcements, NPCs and hologram leaderboards.
 */
public final class MiscModule extends Module {
    private final Map<UUID, long[]> stats = new ConcurrentHashMap<>(); // kills, deaths, playtimeSeconds
    private final Map<UUID, Map<String, String>> settings = new ConcurrentHashMap<>();
    private final Map<UUID, String> ranks = new ConcurrentHashMap<>();
    private final Map<UUID, PermissionAttachment> attachments = new HashMap<>();
    private final Map<UUID, long[]> chat = new ConcurrentHashMap<>();        // lastTs, hash
    private final Map<UUID, Long> sessionStart = new HashMap<>();
    private BukkitTask playtimeTask, announceTask, holoTask;
    private int announceIndex;

    public MiscModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "misc"; }

    @Override public void enable() {
        command("stats", (s, a) -> statsCmd(s, a));
        command("playtime", (s, a) -> {
            Player t = a.length > 0 ? Bukkit.getPlayerExact(a[0]) : (s instanceof Player p ? p : null);
            if (t == null) { msg().send(s, "error.unknown-player"); return; }
            msg().send(s, "misc.playtime", "player", t.getName(), "time", formatTime(stats(t.getUniqueId())[2]));
        });
        command("top", this::top, (s, a) -> List.of("money", "shards", "kills", "deaths", "playtime", "duelwins"));
        command("settings", (s, a) -> { Player p = player(s); if (p != null) settingsMenu(p); }, (s, a) -> List.of());
        command("rules", (s, a) -> msg().list("misc.rules").forEach(s::sendMessage), (s, a) -> List.of());
        command("help", (s, a) -> msg().list("misc.help").forEach(s::sendMessage), (s, a) -> List.of());
        command("report", this::report);
        reload();
    }

    @Override public void reload() {
        if (playtimeTask != null) playtimeTask.cancel();
        if (announceTask != null) announceTask.cancel();
        if (holoTask != null) holoTask.cancel();
        playtimeTask = Bukkit.getScheduler().runTaskTimer(plugin, this::playtimeTick, 1200L, 1200L);
        long ann = cfg("config.yml").getLong("announcements.interval-seconds", 300) * 20L;
        if (ann > 0) announceTask = Bukkit.getScheduler().runTaskTimer(plugin, this::announce, ann, ann);
        holoTask = Bukkit.getScheduler().runTaskTimer(plugin, this::refreshLeaderboards, 200L, 20L * 60);
        for (Player p : Bukkit.getOnlinePlayers()) applyRank(p);
    }

    @Override public void disable() {
        if (playtimeTask != null) playtimeTask.cancel();
        if (announceTask != null) announceTask.cancel();
        if (holoTask != null) holoTask.cancel();
        playtimeTick();
    }

    // ------------------------------------------------------------------ data
    public long[] stats(UUID id) { return stats.getOrDefault(id, new long[3]); }

    public boolean setting(UUID id, String key, boolean def) {
        Map<String, String> m = settings.get(id);
        String v = m == null ? null : m.get(key);
        return v == null ? def : Boolean.parseBoolean(v);
    }

    private void setSetting(UUID id, String key, boolean v) {
        settings.computeIfAbsent(id, k -> new ConcurrentHashMap<>()).put(key, String.valueOf(v));
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO settings(uuid,k,v) VALUES(?,?,?)", id.toString(), "s_" + key, String.valueOf(v)); return null; });
    }

    @Override public void onDataLoaded(Player p) {
        UUID id = p.getUniqueId();
        sessionStart.put(id, System.currentTimeMillis());
        plugin.db().query(c -> {
            Object[] out = new Object[3];
            Database.exec(c, "INSERT OR IGNORE INTO stats(uuid) VALUES(?)", id.toString());
            try (PreparedStatement ps = c.prepareStatement("SELECT kills,deaths,playtime FROM stats WHERE uuid=?")) {
                ps.setString(1, id.toString());
                try (ResultSet rs = ps.executeQuery()) { out[0] = rs.next() ? new long[]{rs.getLong(1), rs.getLong(2), rs.getLong(3)} : new long[3]; }
            }
            Map<String, String> s = new ConcurrentHashMap<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT k,v FROM settings WHERE uuid=? AND k LIKE 's\\_%' ESCAPE '\\'")) {
                ps.setString(1, id.toString());
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) s.put(rs.getString(1).substring(2), rs.getString(2)); }
            }
            out[1] = s;
            try (PreparedStatement ps = c.prepareStatement("SELECT rank FROM ranks WHERE uuid=?")) {
                ps.setString(1, id.toString());
                try (ResultSet rs = ps.executeQuery()) { out[2] = rs.next() ? rs.getString(1) : null; }
            }
            return out;
        }).thenAccept(o -> plugin.runSync(() -> {
            stats.put(id, (long[]) o[0]);
            @SuppressWarnings("unchecked") Map<String, String> s = (Map<String, String>) o[1];
            settings.put(id, s);
            if (o[2] != null) ranks.put(id, (String) o[2]);
            Player now = Bukkit.getPlayer(id);
            if (now != null) applyRank(now);
        }));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        flushPlaytime(id);
        sessionStart.remove(id);
        chat.remove(id);
        PermissionAttachment pa = attachments.remove(id);
        if (pa != null) try { e.getPlayer().removeAttachment(pa); } catch (IllegalArgumentException ignored) { }
        Bukkit.getScheduler().runTaskLater(plugin, () -> { if (Bukkit.getPlayer(id) == null) { stats.remove(id); settings.remove(id); ranks.remove(id); } }, 5L);
    }

    private void playtimeTick() { for (UUID id : new ArrayList<>(sessionStart.keySet())) flushPlaytime(id); }

    private void flushPlaytime(UUID id) {
        Long start = sessionStart.get(id);
        if (start == null) return;
        long now = System.currentTimeMillis();
        long secs = (now - start) / 1000;
        if (secs <= 0) return;
        sessionStart.put(id, start + secs * 1000);
        long[] st = stats.get(id);
        if (st != null) st[2] += secs;
        plugin.db().query(c -> { Database.exec(c, "UPDATE stats SET playtime = playtime + ? WHERE uuid=?", secs, id.toString()); return null; });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent e) {
        Player v = e.getEntity(), k = v.getKiller();
        if (plugin.duels.inDuel(v.getUniqueId())) return;
        bump(v.getUniqueId(), 1, "deaths");
        if (k != null && !k.equals(v)) bump(k.getUniqueId(), 0, "kills");
    }

    private void bump(UUID id, int idx, String col) {
        long[] st = stats.get(id);
        if (st != null) st[idx]++;
        plugin.db().query(c -> { Database.exec(c, "INSERT OR IGNORE INTO stats(uuid) VALUES(?)", id.toString());
            Database.exec(c, "UPDATE stats SET " + col + " = " + col + " + 1 WHERE uuid=?", id.toString()); return null; });
    }

    public String formatTime(long secs) {
        long d = secs / 86400, h = secs / 3600 % 24, m = secs / 60 % 60;
        return d > 0 ? d + "d " + h + "h" : h > 0 ? h + "h " + m + "m" : m + "m";
    }

    // ------------------------------------------------------------------ commands
    private void statsCmd(CommandSender s, String[] a) {
        Player t = a.length > 0 ? Bukkit.getPlayerExact(a[0]) : (s instanceof Player p ? p : null);
        if (t == null) { msg().send(s, "error.unknown-player"); return; }
        long[] st = stats(t.getUniqueId());
        msg().list("misc.stats", "player", t.getName(), "kills", st[0], "deaths", st[1],
            "kdr", String.format(Locale.ROOT, "%.2f", st[1] == 0 ? st[0] : (double) st[0] / st[1]), "playtime", formatTime(st[2]),
            "money", Money.format(plugin.ledger().get(t.getUniqueId(), Ledger.MONEY)), "shards", Money.formatWhole(plugin.ledger().get(t.getUniqueId(), Ledger.SHARDS)),
            "team", Objects.requireNonNullElse(plugin.teams.teamName(t.getUniqueId()), "-")).forEach(s::sendMessage);
    }

    private static final Map<String, String> STAT_COLS = Map.of("kills", "kills", "deaths", "deaths", "playtime", "playtime", "duelwins", "duel_wins");

    private void top(CommandSender s, String[] a) {
        String what = a.length > 0 ? a[0].toLowerCase(Locale.ROOT) : "money";
        if (what.equals("money")) { plugin.economy.top(s, Ledger.MONEY, "Money"); return; }
        if (what.equals("shards")) { plugin.economy.top(s, Ledger.SHARDS, "Shards"); return; }
        String col = STAT_COLS.get(what);
        if (col == null) { msg().sendRaw(s, "&c/top <money|shards|kills|deaths|playtime|duelwins>"); return; }
        topStat(col, 10).thenAccept(l -> plugin.runSync(() -> {
            msg().sendRaw(s, "&6&lTop " + what);
            int i = 1;
            for (String[] r : l) msg().sendRaw(s, "&e" + (i++) + ". &f" + r[0] + " &7- &a" + (col.equals("playtime") ? formatTime(Long.parseLong(r[1])) : r[1]));
        }));
    }

    private java.util.concurrent.CompletableFuture<List<String[]>> topStat(String col, int limit) {
        flushAll();
        return plugin.db().query(c -> {
            List<String[]> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT a.name, s." + col + " FROM stats s JOIN accounts a ON a.uuid=s.uuid WHERE s." + col + ">0 ORDER BY s." + col + " DESC LIMIT ?")) {
                ps.setInt(1, limit);
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) out.add(new String[]{rs.getString(1), String.valueOf(rs.getLong(2))}); }
            }
            return out;
        });
    }

    private void flushAll() { playtimeTick(); }

    private void settingsMenu(Player p) {
        Menu m = new Menu(3, "&8Settings");
        String[][] opts = {{"scoreboard", "Scoreboard", "PAINTING"}, {"tpa", "Teleport requests", "ENDER_PEARL"}, {"duels", "Duel requests", "IRON_SWORD"}, {"pay", "Receive /pay", "GOLD_NUGGET"}};
        int slot = 10;
        for (String[] o : opts) {
            boolean on = setting(p.getUniqueId(), o[0], true);
            m.set(slot, Items.make(Material.valueOf(o[2]), (on ? "&a" : "&c") + o[1] + ": " + (on ? "ON" : "OFF"), "&7Click to toggle"),
                e -> { setSetting(p.getUniqueId(), o[0], !on); settingsMenu(p); });
            slot += 2;
        }
        m.open(p);
    }

    private void report(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length < 2) { msg().sendRaw(p, "&c/report <player> <reason>"); return; }
        String reason = String.join(" ", Arrays.copyOfRange(a, 1, a.length));
        plugin.db().query(c -> { Database.exec(c, "INSERT INTO reports(ts,reporter,target,reason) VALUES(?,?,?,?)", System.currentTimeMillis(), p.getName(), a[0], reason); return null; });
        msg().send(p, "misc.reported");
        for (Player st : Bukkit.getOnlinePlayers()) if (st.hasPermission("dc.staff")) msg().send(st, "misc.report-staff", "reporter", p.getName(), "target", a[0], "reason", reason);
    }

    private void announce() {
        List<String> l = cfg("config.yml").getStringList("announcements.messages");
        if (l.isEmpty() || Bukkit.getOnlinePlayers().isEmpty()) return;
        Bukkit.broadcastMessage(Msg.color(l.get(announceIndex++ % l.size())));
    }

    // ------------------------------------------------------------------ chat
    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent e) {
        Player p = e.getPlayer();
        if (!p.hasPermission("dc.chat.bypass")) {
            long now = System.currentTimeMillis();
            long[] last = chat.get(p.getUniqueId());
            long gap = cfg("config.yml").getLong("chat.min-interval-ms", 1500);
            long hash = e.getMessage().toLowerCase(Locale.ROOT).hashCode();
            if (last != null && (now - last[0] < gap || (last[1] == hash && now - last[0] < cfg("config.yml").getLong("chat.duplicate-window-ms", 10000)))) {
                e.setCancelled(true); msg().send(p, "misc.spam"); return;
            }
            chat.put(p.getUniqueId(), new long[]{now, hash});
        }
        String rank = ranks.getOrDefault(p.getUniqueId(), "default");
        String prefix = cfg("permissions.yml").getString("ranks." + rank + ".prefix", "");
        String team = plugin.teams.teamName(p.getUniqueId());
        String fmt = cfg("config.yml").getString("chat.format", "{team}{prefix}&f%1$s&7: &f%2$s");
        fmt = fmt.replace("{prefix}", prefix).replace("{team}", team == null ? "" : "&8[&b" + team + "&8] ");
        e.setFormat(Msg.color(fmt));
    }

    // ------------------------------------------------------------------ ranks
    public String rank(UUID id) { return ranks.getOrDefault(id, "default"); }

    public void setRank(UUID id, String rank) {
        ranks.put(id, rank);
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO ranks(uuid,rank) VALUES(?,?)", id.toString(), rank); return null; });
        Player p = Bukkit.getPlayer(id);
        if (p != null) applyRank(p);
    }

    @SuppressWarnings("deprecation")
    private void applyRank(Player p) {
        PermissionAttachment old = attachments.remove(p.getUniqueId());
        if (old != null) try { p.removeAttachment(old); } catch (IllegalArgumentException ignored) { }
        PermissionAttachment pa = p.addAttachment(plugin);
        attachments.put(p.getUniqueId(), pa);
        Set<String> seen = new HashSet<>();
        Deque<String> stack = new ArrayDeque<>(List.of(rank(p.getUniqueId())));
        while (!stack.isEmpty()) { // inheritance
            String r = stack.pop();
            if (!seen.add(r)) continue;
            ConfigurationSection s = cfg("permissions.yml").getConfigurationSection("ranks." + r);
            if (s == null) continue;
            for (String perm : s.getStringList("permissions")) {
                if (perm.startsWith("-")) pa.setPermission(perm.substring(1), false); else if (!pa.getPermissions().containsKey(perm)) pa.setPermission(perm, true);
            }
            stack.addAll(s.getStringList("inherits"));
        }
        String prefix = cfg("permissions.yml").getString("ranks." + rank(p.getUniqueId()) + ".prefix", "");
        if (cfg("config.yml").getBoolean("tablist.show-rank-prefix", true)) p.setPlayerListName(Msg.color(prefix + p.getName()));
    }

    // ------------------------------------------------------------------ NPCs
    public void spawnNpc(Player admin, String action) {
        Location l = admin.getLocation();
        Villager v = l.getWorld().spawn(l, Villager.class, e -> {
            e.setAI(false); e.setInvulnerable(true); e.setSilent(true); e.setCollidable(false); e.setPersistent(true);
            e.setRemoveWhenFarAway(false);
            e.setCustomName(Msg.color(cfg("config.yml").getString("npcs." + action + ".name", "&e" + action)));
            e.setCustomNameVisible(true);
            e.getPersistentDataContainer().set(Items.NPC, PersistentDataType.STRING, action);
        });
        msg().send(admin, "admin.set", "what", "NPC " + action + " (" + v.getUniqueId().toString().substring(0, 8) + ")");
    }

    public boolean removeNearestNpc(Player admin) {
        for (Entity e : admin.getNearbyEntities(4, 4, 4)) {
            if (e.getPersistentDataContainer().has(Items.NPC, PersistentDataType.STRING) || e.getPersistentDataContainer().has(Items.HOLO, PersistentDataType.STRING)) { e.remove(); return true; }
        }
        return false;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onNpc(PlayerInteractEntityEvent e) {
        String action = e.getRightClicked().getPersistentDataContainer().get(Items.NPC, PersistentDataType.STRING);
        if (action == null) return;
        e.setCancelled(true);
        if (e.getHand() != org.bukkit.inventory.EquipmentSlot.HAND) return;
        String cmd = cfg("config.yml").getString("npcs." + action + ".command", action);
        e.getPlayer().performCommand(cmd);
    }

    @EventHandler(ignoreCancelled = true)
    public void onNpcDamage(EntityDamageEvent e) {
        if (e.getEntity().getPersistentDataContainer().has(Items.NPC, PersistentDataType.STRING)) e.setCancelled(true);
    }

    // ------------------------------------------------------------------ holograms / leaderboards
    /** Static hologram lines: invisible marker armour stands (Geyser shows their name tags on Bedrock). */
    public void hologram(Location base, List<String> lines, String tag) {
        double y = 0;
        for (String line : lines) {
            Location l = base.clone().add(0, -y, 0);
            l.getWorld().spawn(l, ArmorStand.class, as -> {
                as.setMarker(true); as.setInvisible(true); as.setGravity(false); as.setInvulnerable(true); as.setPersistent(true);
                as.setCustomName(Msg.color(line)); as.setCustomNameVisible(true);
                as.getPersistentDataContainer().set(Items.HOLO, PersistentDataType.STRING, tag);
            });
            y += 0.28;
        }
    }

    public void addLeaderboard(Location l, String category) {
        String id = "lb" + System.currentTimeMillis();
        plugin.locs().set("leaderboards." + id + ".location", l);
        cfg("warps.yml").set("leaderboards." + id + ".category", category);
        plugin.saveCfg("warps.yml");
        refreshLeaderboards();
    }

    private void refreshLeaderboards() {
        for (String id : plugin.locs().keys("leaderboards")) {
            Location l = plugin.locs().get("leaderboards." + id + ".location");
            String cat = cfg("warps.yml").getString("leaderboards." + id + ".category", "money");
            if (l == null || !l.getWorld().isChunkLoaded(l.getBlockX() >> 4, l.getBlockZ() >> 4)) continue;
            var fut = switch (cat) {
                case "money" -> plugin.ledger().top(Ledger.MONEY, 10).thenApply(x -> x.stream().map(e -> new String[]{e.name(), Money.format(e.amount())}).toList());
                case "shards" -> plugin.ledger().top(Ledger.SHARDS, 10).thenApply(x -> x.stream().map(e -> new String[]{e.name(), Money.formatWhole(e.amount())}).toList());
                default -> topStat(STAT_COLS.getOrDefault(cat, "kills"), 10).thenApply(x -> x.stream()
                    .map(r -> new String[]{r[0], cat.equals("playtime") ? formatTime(Long.parseLong(r[1])) : r[1]}).toList());
            };
            fut.thenAccept(rows -> plugin.runSync(() -> {
                for (Entity e : l.getWorld().getNearbyEntities(l, 1, 5, 1))
                    if (id.equals(e.getPersistentDataContainer().get(Items.HOLO, PersistentDataType.STRING))) e.remove();
                List<String> lines = new ArrayList<>();
                lines.add("&b&lTop " + cat.substring(0, 1).toUpperCase(Locale.ROOT) + cat.substring(1));
                int i = 1;
                for (String[] r : rows) lines.add("&e" + (i++) + ". &f" + r[0] + " &7- &a" + r[1]);
                hologram(l, lines, id);
            }));
        }
    }
}
