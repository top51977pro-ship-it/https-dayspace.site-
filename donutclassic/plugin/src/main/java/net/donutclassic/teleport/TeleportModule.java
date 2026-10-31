package net.donutclassic.teleport;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.scheduler.BukkitTask;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ThreadLocalRandom;

/**
 * /spawn /afk /warp /rtp /sethome /home /delhome /homes /tpa /tpahere /tpaccept /tpdeny /back.
 * Classic 5-second warm-up cancelled by moving a block or taking damage (bypass: dc.teleport.bypass).
 */
public final class TeleportModule extends Module {
    private record Pending(BukkitTask task, Location start) { }
    private record Request(UUID from, boolean here, long expires) { }

    private final Map<UUID, Pending> pending = new HashMap<>();
    private final Map<UUID, Map<String, Location>> homes = new HashMap<>();
    private final Map<UUID, Request> requests = new HashMap<>(); // target -> request
    private final Map<UUID, Location> back = new HashMap<>();
    private final Map<UUID, Long> rtpCooldown = new HashMap<>();
    private final Set<UUID> searching = new HashSet<>();

    public TeleportModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "teleport"; }
    private YamlConfiguration y() { return cfg("config.yml"); }

    @Override public void enable() {
        command("spawn", (s, a) -> { Player p = player(s); if (p != null) warmup(p, plugin.locs().spawn(), "spawn"); }, (s, a) -> List.of());
        command("afk", (s, a) -> {
            Player p = player(s); if (p == null) return;
            Location l = plugin.locs().get("afk");
            if (l == null) { msg().send(p, "teleport.not-set", "what", "AFK"); return; }
            warmup(p, l, "AFK");
        }, (s, a) -> List.of());
        command("warp", this::warp, (s, a) -> new ArrayList<>(plugin.locs().keys("warps")));
        command("rtp", this::rtpCmd, (s, a) -> List.of("overworld", "nether", "end"));
        command("sethome", this::setHome, (s, a) -> List.of());
        command("home", this::home, (s, a) -> s instanceof Player pl ? new ArrayList<>(homes.getOrDefault(pl.getUniqueId(), Map.of()).keySet()) : List.of());
        command("delhome", this::delHome, (s, a) -> s instanceof Player pl ? new ArrayList<>(homes.getOrDefault(pl.getUniqueId(), Map.of()).keySet()) : List.of());
        command("homes", (s, a) -> { Player p = player(s); if (p != null) homesMenu(p); }, (s, a) -> List.of());
        command("tpa", (s, a) -> request(s, a, false));
        command("tpahere", (s, a) -> request(s, a, true));
        command("tpaccept", (s, a) -> respond(s, true));
        command("tpdeny", (s, a) -> respond(s, false));
        command("back", (s, a) -> {
            Player p = player(s); if (p == null) return;
            if (!y().getBoolean("teleport.back-enabled", true)) { msg().send(p, "error.disabled"); return; }
            Location l = back.get(p.getUniqueId());
            if (l == null) { msg().send(p, "teleport.no-back"); return; }
            warmup(p, l, "back");
        }, (s, a) -> List.of());
    }

    // ------------------------------------------------------------------ warmup
    public void warmup(Player p, Location target, String label) {
        if (target == null) return;
        if (plugin.duels.inDuel(p.getUniqueId())) { msg().send(p, "duel.no-teleport"); return; }
        if (plugin.duels.isTagged(p.getUniqueId()) && !p.hasPermission("dc.combat.bypass")) { msg().send(p, "combat.no-teleport"); return; }
        cancel(p.getUniqueId(), null);
        int seconds = y().getInt("teleport.warmup-seconds", 5);
        if (seconds <= 0 || p.hasPermission("dc.teleport.bypass")) { go(p, target, label); return; }
        int[] left = {seconds};
        msg().send(p, "teleport.warmup", "seconds", seconds, "where", label);
        BukkitTask t = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (!p.isOnline()) { cancel(p.getUniqueId(), null); return; }
            if (left[0] <= 0) { pending.remove(p.getUniqueId()).task().cancel(); go(p, target, label); return; }
            msg().actionBar(p, msg().raw("teleport.countdown").replace("{seconds}", String.valueOf(left[0])));
            left[0]--;
        }, 0L, 20L);
        pending.put(p.getUniqueId(), new Pending(t, p.getLocation().clone()));
    }

    private void go(Player p, Location target, String label) {
        back.put(p.getUniqueId(), p.getLocation().clone());
        p.setFallDistance(0);
        p.teleportAsync(target, PlayerTeleportEvent.TeleportCause.PLUGIN).thenAccept(ok -> { if (ok) msg().send(p, "teleport.done", "where", label); });
    }

    private void cancel(UUID id, String reasonKey) {
        Pending pd = pending.remove(id);
        if (pd == null) return;
        pd.task().cancel();
        Player p = Bukkit.getPlayer(id);
        if (p != null && reasonKey != null) msg().send(p, reasonKey);
    }

    @EventHandler(ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        Pending pd = pending.get(e.getPlayer().getUniqueId());
        if (pd == null || e.getTo() == null) return;
        Location s = pd.start();
        if (s.getBlockX() != e.getTo().getBlockX() || s.getBlockY() != e.getTo().getBlockY() || s.getBlockZ() != e.getTo().getBlockZ())
            cancel(e.getPlayer().getUniqueId(), "teleport.cancelled-move");
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent e) { if (e.getEntity() instanceof Player p) cancel(p.getUniqueId(), "teleport.cancelled-damage"); }

    @EventHandler public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        cancel(id, null); homes.remove(id); requests.remove(id); searching.remove(id);
    }

    @EventHandler public void onDeath(PlayerDeathEvent e) { back.put(e.getEntity().getUniqueId(), e.getEntity().getLocation().clone()); }

    // ------------------------------------------------------------------ warps
    private void warp(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length == 0) { msg().sendRaw(p, "&6Warps: &f" + String.join(", ", plugin.locs().keys("warps"))); return; }
        Location l = plugin.locs().get("warps." + a[0].toLowerCase(Locale.ROOT));
        if (l == null) { msg().send(p, "teleport.not-set", "what", a[0]); return; }
        warmup(p, l, a[0]);
    }

    // ------------------------------------------------------------------ homes
    @Override public void onDataLoaded(Player p) {
        plugin.db().query(c -> {
            Map<String, String[]> m = new LinkedHashMap<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT name,world,x,y,z,yaw,pitch FROM homes WHERE uuid=?")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) m.put(rs.getString(1), new String[]{rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7)});
                }
            }
            return m;
        }).thenAccept(m -> plugin.runSync(() -> {
            Map<String, Location> out = new LinkedHashMap<>();
            for (var e : m.entrySet()) {
                Location l = Locs.deserialize(String.join(";", e.getValue()));
                if (l != null) out.put(e.getKey().toLowerCase(Locale.ROOT), l);
            }
            homes.put(p.getUniqueId(), out);
        }));
    }

    public int maxHomes(Player p) {
        int max = y().getInt("homes.default-max", 2);
        for (int i = 50; i > max; i--) if (p.hasPermission("dc.homes." + i)) return i;
        return max;
    }

    private void setHome(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        String name = a.length > 0 ? a[0].toLowerCase(Locale.ROOT) : "home";
        if (!name.matches("[a-z0-9_]{1,16}")) { msg().send(p, "error.bad-args"); return; }
        if (plugin.region.isProtected(p.getLocation())) { msg().send(p, "teleport.no-home-here"); return; }
        Map<String, Location> h = homes.computeIfAbsent(p.getUniqueId(), k -> new LinkedHashMap<>());
        if (!h.containsKey(name) && h.size() >= maxHomes(p)) { msg().send(p, "teleport.max-homes", "max", maxHomes(p)); return; }
        Location l = p.getLocation().clone();
        h.put(name, l);
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO homes(uuid,name,world,x,y,z,yaw,pitch) VALUES(?,?,?,?,?,?,?,?)",
            p.getUniqueId().toString(), name, l.getWorld().getUID().toString(), l.getX(), l.getY(), l.getZ(), l.getYaw(), l.getPitch()); return null; });
        msg().send(p, "teleport.home-set", "name", name);
    }

    private void home(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        Map<String, Location> h = homes.getOrDefault(p.getUniqueId(), Map.of());
        if (a.length == 0) {
            if (h.size() == 1) { var e = h.entrySet().iterator().next(); warmup(p, e.getValue(), e.getKey()); }
            else homesMenu(p);
            return;
        }
        Location l = h.get(a[0].toLowerCase(Locale.ROOT));
        if (l == null) { msg().send(p, "teleport.no-home", "name", a[0]); return; }
        warmup(p, l, a[0]);
    }

    private void delHome(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length == 0) { msg().sendRaw(p, "&c/delhome <name>"); return; }
        String name = a[0].toLowerCase(Locale.ROOT);
        if (homes.getOrDefault(p.getUniqueId(), new HashMap<>()).remove(name) == null) { msg().send(p, "teleport.no-home", "name", name); return; }
        plugin.db().query(c -> { Database.exec(c, "DELETE FROM homes WHERE uuid=? AND name=?", p.getUniqueId().toString(), name); return null; });
        msg().send(p, "teleport.home-deleted", "name", name);
    }

    private void homesMenu(Player p) {
        Map<String, Location> h = homes.getOrDefault(p.getUniqueId(), Map.of());
        Menu m = new Menu(3, "&8Homes &7(" + h.size() + "/" + maxHomes(p) + ")");
        int i = 10;
        for (var e : h.entrySet()) {
            if (i > 16) break;
            Location l = e.getValue();
            m.set(i++, Items.make(Material.RED_BED, "&a" + e.getKey(), "&7" + l.getWorld().getName() + " " + l.getBlockX() + ", " + l.getBlockY() + ", " + l.getBlockZ(), "&eClick to teleport"),
                ev -> { p.closeInventory(); warmup(p, l, e.getKey()); });
        }
        if (plugin.teams.teamOf(p.getUniqueId()) != null)
            m.set(22, Items.make(Material.CYAN_BANNER, "&bTeam home"), ev -> { p.closeInventory(); p.performCommand("team home"); });
        m.set(26, Items.make(Material.OAK_SIGN, "&7/sethome <name>", "&7/delhome <name>"));
        m.open(p);
    }

    // ------------------------------------------------------------------ tpa
    private void request(CommandSender s, String[] a, boolean here) {
        Player p = player(s); if (p == null) return;
        Player t = a.length > 0 ? Bukkit.getPlayerExact(a[0]) : null;
        if (t == null || t.equals(p)) { msg().send(p, "error.unknown-player"); return; }
        if (!plugin.misc.setting(t.getUniqueId(), "tpa", true)) { msg().send(p, "teleport.tpa-disabled"); return; }
        requests.put(t.getUniqueId(), new Request(p.getUniqueId(), here, System.currentTimeMillis() + y().getLong("teleport.tpa-expire-seconds", 60) * 1000));
        msg().send(p, "teleport.tpa-sent", "player", t.getName());
        msg().send(t, here ? "teleport.tpahere-received" : "teleport.tpa-received", "player", p.getName());
    }

    private void respond(CommandSender s, boolean accept) {
        Player p = player(s); if (p == null) return;
        Request r = requests.remove(p.getUniqueId());
        Player from = r == null ? null : Bukkit.getPlayer(r.from());
        if (r == null || from == null || r.expires() < System.currentTimeMillis()) { msg().send(p, "teleport.no-request"); return; }
        if (!accept) { msg().send(p, "teleport.denied"); msg().send(from, "teleport.denied-by", "player", p.getName()); return; }
        msg().send(p, "teleport.accepted");
        if (r.here()) warmup(p, from.getLocation(), from.getName());
        else warmup(from, p.getLocation(), p.getName());
    }

    // ------------------------------------------------------------------ rtp
    private void rtpCmd(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length == 0) {
            Menu m = new Menu(3, "&8Random Teleport");
            m.set(11, Items.make(Material.GRASS_BLOCK, "&aOverworld"), e -> { p.closeInventory(); rtp(p, "overworld"); });
            m.set(13, Items.make(Material.NETHERRACK, "&cNether"), e -> { p.closeInventory(); rtp(p, "nether"); });
            m.set(15, Items.make(Material.END_STONE, "&eThe End"), e -> { p.closeInventory(); rtp(p, "end"); });
            m.open(p);
            return;
        }
        rtp(p, a[0].toLowerCase(Locale.ROOT));
    }

    public void rtp(Player p, String dim) {
        String worldName = y().getString("rtp.worlds." + dim);
        World w = worldName == null ? null : Bukkit.getWorld(worldName);
        if (w == null) { msg().send(p, "teleport.rtp-no-world", "world", dim); return; }
        long now = System.currentTimeMillis();
        long cd = y().getLong("rtp.cooldown-seconds", 30) * 1000;
        if (!p.hasPermission("dc.teleport.bypass") && now - rtpCooldown.getOrDefault(p.getUniqueId(), 0L) < cd) {
            msg().send(p, "teleport.rtp-cooldown", "seconds", (cd - (now - rtpCooldown.get(p.getUniqueId()))) / 1000); return;
        }
        if (!searching.add(p.getUniqueId())) return;
        msg().send(p, "teleport.rtp-searching");
        int attempts = y().getInt("rtp.attempts", 12);
        find(w, dim, attempts).whenComplete((loc, err) -> plugin.runSync(() -> {
            searching.remove(p.getUniqueId());
            if (!p.isOnline()) return;
            if (loc == null) { msg().send(p, "teleport.rtp-failed"); return; }
            rtpCooldown.put(p.getUniqueId(), System.currentTimeMillis());
            warmup(p, loc, "RTP " + dim);
        }));
    }

    /** Loads candidate chunks asynchronously (Paper getChunkAtAsync); safety checks run on the main thread. */
    private CompletableFuture<Location> find(World w, String dim, int attemptsLeft) {
        if (attemptsLeft <= 0) return CompletableFuture.completedFuture(null);
        int min = y().getInt("rtp." + dim + ".min-radius", y().getInt("rtp.min-radius", 500));
        int max = Math.max(min + 1, y().getInt("rtp." + dim + ".max-radius", y().getInt("rtp.max-radius", 5000)));
        ThreadLocalRandom r = ThreadLocalRandom.current();
        double ang = r.nextDouble(Math.PI * 2), dist = min + r.nextDouble(max - min);
        Location center = w.getWorldBorder().getCenter();
        int x = (int) (center.getX() + Math.cos(ang) * dist), z = (int) (center.getZ() + Math.sin(ang) * dist);
        return w.getChunkAtAsync(x >> 4, z >> 4).thenCompose(chunk -> {
            Location l = safe(w, dim, x, z);
            return l != null ? CompletableFuture.completedFuture(l) : find(w, dim, attemptsLeft - 1);
        });
    }

    private Location safe(World w, String dim, int x, int z) {
        if (!w.getWorldBorder().isInside(new Location(w, x, 64, z))) return null;
        if (plugin.region.isProtected(new Location(w, x, 64, z))) return null;
        if (w.getEnvironment() == World.Environment.NETHER) {
            int top = Math.min(w.getMaxHeight() - 1, 120); // stay below the bedrock roof
            for (int y = 32; y < top; y++) if (standable(w.getBlockAt(x, y - 1, z), w.getBlockAt(x, y, z), w.getBlockAt(x, y + 1, z)))
                return new Location(w, x + 0.5, y, z + 0.5);
            return null;
        }
        Block ground = w.getHighestBlockAt(x, z);
        if (ground.getY() <= w.getMinHeight() + 1) return null; // void (End)
        if (!standable(ground, ground.getRelative(0, 1, 0), ground.getRelative(0, 2, 0))) return null;
        return new Location(w, x + 0.5, ground.getY() + 1, z + 0.5);
    }

    private static final Set<Material> HAZARD = EnumSet.of(Material.LAVA, Material.WATER, Material.MAGMA_BLOCK, Material.CACTUS, Material.FIRE,
        Material.SOUL_FIRE, Material.CAMPFIRE, Material.SOUL_CAMPFIRE, Material.SWEET_BERRY_BUSH, Material.POWDER_SNOW, Material.POINTED_DRIPSTONE,
        Material.WITHER_ROSE, Material.BEDROCK);

    private static boolean standable(Block floor, Block feet, Block head) {
        return floor.getType().isSolid() && !HAZARD.contains(floor.getType()) && !Tag.LEAVES.isTagged(floor.getType())
            && feet.isPassable() && !feet.isLiquid() && !HAZARD.contains(feet.getType())
            && head.isPassable() && !head.isLiquid() && !HAZARD.contains(head.getType());
    }
}
