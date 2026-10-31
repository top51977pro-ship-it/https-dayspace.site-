package net.donutclassic.mod;

import net.donutclassic.DonutClassic;
import net.donutclassic.util.Module;
import net.donutclassic.util.Platform;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.*;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.*;
import org.bukkit.potion.PotionEffect;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

import java.io.File;
import java.util.*;

/**
 * Lightweight, low-false-positive server-side checks: Fly, Speed, Reach, hit angle (KillAura),
 * CPS (autoclicker), FastBreak/Nuker, and X-ray behaviour (ore ratio). Violations decay over time;
 * thresholds alert staff, can set players back and (optionally) kick. It never bans automatically.
 * Bedrock (Geyser) players get relaxed movement/reach limits because their movement is translated.
 * For competitive servers a dedicated anticheat (e.g. Grim) is still recommended - see ANTICHEAT.md.
 * Real anti-xray is Paper's built-in engine anti-xray, which /dc antixray configures.
 */
public final class AntiCheatModule extends Module {
    private static final class Data {
        final Map<String, Double> vl = new HashMap<>();
        Location lastGround; int airTicks, riseTicks; long lastVelocity, lastTeleport, lastDamage;
        double distWindow; long windowStart;
        final Deque<Long> clicks = new ArrayDeque<>(), breaks = new ArrayDeque<>();
        final Deque<long[]> mined = new ArrayDeque<>(); // ts, valuable(1/0)
        long lastAlert;
    }

    private final Map<UUID, Data> data = new HashMap<>();
    private static final Set<Material> VALUABLE = EnumSet.noneOf(Material.class);
    private static final Set<Material> STONE_LIKE = EnumSet.noneOf(Material.class);
    static {
        for (String n : List.of("DIAMOND_ORE", "DEEPSLATE_DIAMOND_ORE", "ANCIENT_DEBRIS", "EMERALD_ORE", "DEEPSLATE_EMERALD_ORE")) {
            Material m = Material.matchMaterial(n); if (m != null) VALUABLE.add(m);
        }
        for (String n : List.of("STONE", "DEEPSLATE", "NETHERRACK", "TUFF", "GRANITE", "DIORITE", "ANDESITE", "BASALT", "BLACKSTONE", "COBBLED_DEEPSLATE")) {
            Material m = Material.matchMaterial(n); if (m != null) STONE_LIKE.add(m);
        }
    }

    public AntiCheatModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "anticheat"; }
    private YamlConfiguration y() { return cfg("config.yml"); }
    private boolean on(String check) { return y().getBoolean("anticheat.enabled", true) && y().getBoolean("anticheat.checks." + check + ".enabled", true); }
    private double limit(String check, String key, double def) { return y().getDouble("anticheat.checks." + check + "." + key, def); }

    @Override public void enable() {
        Bukkit.getScheduler().runTaskTimer(plugin, this::decay, 20L, 20L);
        if (y().getBoolean("anticheat.antixray.auto-configure", true)) configureAntiXray(null);
    }

    private Data d(Player p) { return data.computeIfAbsent(p.getUniqueId(), k -> new Data()); }

    private boolean exempt(Player p) {
        GameMode gm = p.getGameMode();
        return gm == GameMode.CREATIVE || gm == GameMode.SPECTATOR || p.hasPermission("dc.anticheat.bypass") || p.isFlying() || p.getAllowFlight()
            || p.isInsideVehicle() || p.isGliding() || p.isRiptiding() || p.isDead();
    }

    private void decay() {
        double rate = y().getDouble("anticheat.vl-decay-per-second", 0.05);
        for (Data dd : data.values()) dd.vl.replaceAll((k, v) -> Math.max(0, v - rate * Math.max(1, v)));
    }

    private void flag(Player p, String check, double add, String detail) {
        Data dd = d(p);
        double v = dd.vl.merge(check, add, Double::sum);
        double alertAt = limit(check, "alert-vl", 5), kickAt = limit(check, "kick-vl", 25);
        long now = System.currentTimeMillis();
        if (v >= alertAt && now - dd.lastAlert > 3000) { dd.lastAlert = now; plugin.moderation.alert(p, check, v, detail); }
        if (y().getBoolean("anticheat.kick-enabled", true) && v >= kickAt) {
            dd.vl.put(check, 0.0);
            plugin.getLogger().warning("[anticheat] kicking " + p.getName() + " for " + check + " (VL " + v + ")");
            p.kickPlayer(net.donutclassic.util.Msg.color(y().getString("anticheat.kick-message", "&cUnfair advantage detected (" + check + ").")));
        }
    }

    // ------------------------------------------------------------------ movement
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent e) { Data dd = d(e.getPlayer()); dd.lastTeleport = System.currentTimeMillis(); dd.airTicks = 0; dd.riseTicks = 0; dd.lastGround = e.getTo(); }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onVelocity(PlayerVelocityEvent e) { d(e.getPlayer()).lastVelocity = System.currentTimeMillis(); }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamaged(EntityDamageEvent e) { if (e.getEntity() instanceof Player p) d(p).lastDamage = System.currentTimeMillis(); }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        Player p = e.getPlayer();
        Location from = e.getFrom(), to = e.getTo();
        if (to == null || exempt(p)) return;
        Data dd = d(p);
        long now = System.currentTimeMillis();
        boolean recent = now - dd.lastVelocity < 2500 || now - dd.lastTeleport < 2000 || now - dd.lastDamage < 1500;
        boolean bedrock = Platform.isBedrock(p);
        boolean ground = supported(to);
        if (ground) { dd.airTicks = 0; dd.riseTicks = 0; dd.lastGround = to.clone(); }
        else dd.airTicks++;

        // ---- Fly: rising / hovering in the air without any reason
        if (on("fly") && !ground && !recent && !special(p, to)) {
            double dy = to.getY() - from.getY();
            if (dy >= -0.01) dd.riseTicks++; else dd.riseTicks = Math.max(0, dd.riseTicks - 1);
            int maxRise = (int) limit("fly", bedrock ? "bedrock-max-rise-moves" : "max-rise-moves", bedrock ? 20 : 12);
            if (jumpBoost(p) == 0 && dd.riseTicks > maxRise) {
                flag(p, "Fly", 1, "air=" + dd.airTicks + " rising=" + dd.riseTicks);
                if (y().getBoolean("anticheat.setback", true) && dd.lastGround != null) { e.setTo(dd.lastGround); dd.riseTicks = 0; }
            }
        }

        // ---- Speed: horizontal blocks per second over a 1 s window
        if (on("speed")) {
            if (now - dd.windowStart > 1000) {
                double max = limit("speed", bedrock ? "bedrock-max-bps" : "max-bps", bedrock ? 16 : 13.5) * (1 + 0.25 * speedLevel(p));
                if (dd.windowStart > 0 && !recent && dd.distWindow > max && !onIce(to))
                    flag(p, "Speed", Math.min(5, (dd.distWindow - max) / 2 + 1), String.format(Locale.ROOT, "%.1f b/s (max %.1f)", dd.distWindow, max));
                dd.distWindow = 0; dd.windowStart = now;
            }
            double dx = to.getX() - from.getX(), dz = to.getZ() - from.getZ();
            if (from.getWorld() == to.getWorld()) dd.distWindow += Math.sqrt(dx * dx + dz * dz);
        }
    }

    private static boolean supported(Location l) {
        BoundingBox box = BoundingBox.of(l.clone().add(-0.3, -0.6, -0.3), l.clone().add(0.3, 0.1, 0.3));
        World w = l.getWorld();
        for (int x = (int) Math.floor(box.getMinX()); x <= (int) Math.floor(box.getMaxX()); x++)
            for (int y = (int) Math.floor(box.getMinY()); y <= (int) Math.floor(box.getMaxY()); y++)
                for (int z = (int) Math.floor(box.getMinZ()); z <= (int) Math.floor(box.getMaxZ()); z++) {
                    Block b = w.getBlockAt(x, y, z);
                    if (!b.isPassable() || b.isLiquid() || climbable(b.getType())) return true;
                }
        return false;
    }

    private static boolean climbable(Material m) {
        String n = m.name();
        return n.contains("LADDER") || n.contains("VINE") || n.equals("SCAFFOLDING") || n.contains("POWDER_SNOW") || n.contains("COBWEB") || n.contains("HONEY") || n.contains("BUBBLE");
    }

    private boolean special(Player p, Location to) {
        if (p.isSwimming() || p.getLocation().getBlock().isLiquid()) return true;
        return effect(p, "levitation") > 0 || effect(p, "slow_falling") > 0;
    }

    /** Effect level by namespaced key (stable across versions, unlike the renamed enum-style constants). */
    private static int effect(Player p, String key) {
        for (PotionEffect e : p.getActivePotionEffects()) if (e.getType().getKey().getKey().equals(key)) return e.getAmplifier() + 1;
        return 0;
    }
    private static int jumpBoost(Player p) { return effect(p, "jump_boost"); }
    private static int speedLevel(Player p) { return effect(p, "speed"); }
    private static boolean onIce(Location l) { String n = l.clone().add(0, -0.6, 0).getBlock().getType().name(); return n.contains("ICE"); }

    // ------------------------------------------------------------------ combat
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onHit(EntityDamageByEntityEvent e) {
        if (!(e.getDamager() instanceof Player p) || exempt(p) || !(e.getEntity() instanceof LivingEntity target)) return;
        if (e.getCause() != EntityDamageEvent.DamageCause.ENTITY_ATTACK && e.getCause() != EntityDamageEvent.DamageCause.ENTITY_SWEEP_ATTACK) return;
        boolean bedrock = Platform.isBedrock(p);
        Location eye = p.getEyeLocation();
        BoundingBox box = target.getBoundingBox();
        Vector closest = new Vector(clamp(eye.getX(), box.getMinX(), box.getMaxX()), clamp(eye.getY(), box.getMinY(), box.getMaxY()), clamp(eye.getZ(), box.getMinZ(), box.getMaxZ()));
        double dist = closest.distance(eye.toVector());
        double max = limit("reach", bedrock ? "bedrock-max" : "max", bedrock ? 4.6 : 3.6);
        if (on("reach") && dist > max) { flag(p, "Reach", Math.min(4, (dist - max) * 3 + 1), String.format(Locale.ROOT, "%.2f blocks (max %.1f)", dist, max)); if (dist > max + 1.5) e.setCancelled(true); }
        if (on("killaura") && e.getCause() == EntityDamageEvent.DamageCause.ENTITY_ATTACK && dist > 1.5) {
            Vector toTarget = box.getCenter().subtract(eye.toVector()).normalize();
            double angle = Math.toDegrees(eye.getDirection().angle(toTarget));
            if (angle > limit("killaura", "max-angle", bedrock ? 110 : 95)) flag(p, "KillAura", 1.5, String.format(Locale.ROOT, "hit at %.0f°", angle));
        }
        if (on("autoclicker")) click(p);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onSwing(PlayerAnimationEvent e) { if (on("autoclicker") && !exempt(e.getPlayer())) click(e.getPlayer()); }

    private void click(Player p) {
        Data dd = d(p);
        long now = System.currentTimeMillis();
        dd.clicks.addLast(now);
        while (!dd.clicks.isEmpty() && now - dd.clicks.peekFirst() > 1000) dd.clicks.pollFirst();
        int max = (int) limit("autoclicker", "max-cps", 22);
        if (dd.clicks.size() > max) { flag(p, "AutoClicker", 0.5, dd.clicks.size() + " CPS"); dd.clicks.clear(); }
    }

    private static double clamp(double v, double a, double b) { return Math.max(a, Math.min(b, v)); }

    // ------------------------------------------------------------------ breaking / x-ray
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        Player p = e.getPlayer();
        if (plugin.tools.isBusy() || exempt(p)) return; // shard-tool area breaks are ours
        Data dd = d(p);
        long now = System.currentTimeMillis();
        Material type = e.getBlock().getType();
        if (on("fastbreak") && type.getHardness() >= 1.0f && effect(p, "haste") == 0) {
            dd.breaks.addLast(now);
            while (!dd.breaks.isEmpty() && now - dd.breaks.peekFirst() > 1000) dd.breaks.pollFirst();
            int max = (int) limit("fastbreak", "max-per-second", 9);
            if (dd.breaks.size() > max) { flag(p, "FastBreak", 1, dd.breaks.size() + " hard blocks/s"); e.setCancelled(true); }
        }
        if (on("xray") && (VALUABLE.contains(type) || STONE_LIKE.contains(type))) {
            dd.mined.addLast(new long[]{now, VALUABLE.contains(type) ? 1 : 0});
            long window = (long) limit("xray", "window-minutes", 20) * 60_000L;
            while (!dd.mined.isEmpty() && now - dd.mined.peekFirst()[0] > window) dd.mined.pollFirst();
            long ores = dd.mined.stream().filter(x -> x[1] == 1).count(), total = dd.mined.size();
            if (VALUABLE.contains(type) && ores >= limit("xray", "min-ores", 10) && (double) ores / total > limit("xray", "max-ratio", 0.04))
                flag(p, "Xray", 1, ores + " valuable ores / " + total + " blocks in " + window / 60000 + "m (" + String.format(Locale.ROOT, "%.1f%%", 100.0 * ores / total) + ")");
        }
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) { data.remove(e.getPlayer().getUniqueId()); }

    public Map<String, Double> violations(UUID id) { Data dd = data.get(id); return dd == null ? Map.of() : Map.copyOf(dd.vl); }

    // ------------------------------------------------------------------ Paper engine anti-xray
    /**
     * Turns on Paper's built-in anti-xray (engine-mode 2) in config/paper-world-defaults.yml and the nether
     * world config. Returns a status line. Changes take effect after a restart.
     */
    public String configureAntiXray(org.bukkit.command.CommandSender who) {
        try {
            File root = Bukkit.getWorldContainer();
            File defaults = new File(root, "config/paper-world-defaults.yml");
            if (!defaults.isFile()) return log(who, "Paper anti-xray: config/paper-world-defaults.yml not found (very old Paper?) - configure anti-xray manually.");
            YamlConfiguration y = YamlConfiguration.loadConfiguration(defaults);
            boolean changed = false;
            if (!y.getBoolean("anticheat.anti-xray.enabled", false)) {
                y.set("anticheat.anti-xray.enabled", true);
                y.set("anticheat.anti-xray.engine-mode", 2);
                y.set("anticheat.anti-xray.max-block-height", 64);
                y.set("anticheat.anti-xray.update-radius", 2);
                y.set("anticheat.anti-xray.lava-obscures", false);
                y.set("anticheat.anti-xray.hidden-blocks", List.of("chest", "coal_ore", "deepslate_coal_ore", "copper_ore", "deepslate_copper_ore", "raw_copper_block",
                    "diamond_ore", "deepslate_diamond_ore", "emerald_ore", "deepslate_emerald_ore", "gold_ore", "deepslate_gold_ore", "iron_ore", "deepslate_iron_ore",
                    "raw_iron_block", "lapis_ore", "deepslate_lapis_ore", "redstone_ore", "deepslate_redstone_ore", "spawner"));
                y.set("anticheat.anti-xray.replacement-blocks", List.of("stone", "oak_planks", "deepslate"));
                y.save(defaults); changed = true;
            }
            World nether = Bukkit.getWorlds().stream().filter(w -> w.getEnvironment() == World.Environment.NETHER).findFirst().orElse(null);
            if (nether != null) {
                File nf = new File(nether.getWorldFolder(), "paper-world.yml");
                YamlConfiguration n = YamlConfiguration.loadConfiguration(nf);
                if (!n.contains("anticheat.anti-xray.hidden-blocks")) {
                    n.set("anticheat.anti-xray.enabled", true);
                    n.set("anticheat.anti-xray.engine-mode", 2);
                    n.set("anticheat.anti-xray.max-block-height", 128);
                    n.set("anticheat.anti-xray.hidden-blocks", List.of("ancient_debris", "nether_gold_ore", "nether_quartz_ore", "bone_block"));
                    n.set("anticheat.anti-xray.replacement-blocks", List.of("netherrack", "basalt", "blackstone"));
                    n.save(nf); changed = true;
                }
            }
            return log(who, changed ? "Paper engine anti-xray enabled (engine-mode 2). RESTART the server to apply." : "Paper engine anti-xray is already enabled.");
        } catch (Exception ex) { return log(who, "Could not configure anti-xray: " + ex.getMessage()); }
    }

    private String log(org.bukkit.command.CommandSender who, String s) {
        plugin.getLogger().info(s);
        if (who != null) who.sendMessage(s);
        return s;
    }
}
