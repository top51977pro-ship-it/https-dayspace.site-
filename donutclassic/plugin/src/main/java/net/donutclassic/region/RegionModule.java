package net.donutclassic.region;

import net.donutclassic.DonutClassic;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.player.*;

/**
 * Protects the bound spawn region (and AFK region): no building, griefing, PvP or damage for normal
 * players, no hunger loss, no natural mob spawns, void-safe return to spawn. Bypass: dc.admin.build.
 */
public final class RegionModule extends Module {
    private Locs.Cuboid spawn, afk;

    public RegionModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "region"; }
    @Override public void enable() { reload(); }
    @Override public void reload() {
        spawn = plugin.locs().cuboid("spawn-corner1", "spawn-corner2");
        afk = cfg("config.yml").getBoolean("regions.protect-afk", true) ? plugin.locs().cuboid("afk-corner1", "afk-corner2") : null;
    }

    public boolean isProtected(Location l) { return (spawn != null && spawn.contains(l)) || (afk != null && afk.contains(l)); }
    public boolean inSpawn(Location l) { return spawn != null && spawn.contains(l); }
    private boolean bypass(Player p) { return p.hasPermission("dc.admin.build"); }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) { if (isProtected(e.getBlock().getLocation()) && !bypass(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) { if (isProtected(e.getBlock().getLocation()) && !bypass(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onBucket(PlayerBucketEmptyEvent e) { if (isProtected(e.getBlock().getLocation()) && !bypass(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onBucketFill(PlayerBucketFillEvent e) { if (isProtected(e.getBlock().getLocation()) && !bypass(e.getPlayer())) e.setCancelled(true); }

    @EventHandler(priority = EventPriority.LOW)
    public void onInteract(PlayerInteractEvent e) {
        Block b = e.getClickedBlock();
        if (b == null || bypass(e.getPlayer()) || !isProtected(b.getLocation())) return;
        if (e.getAction() == org.bukkit.event.block.Action.PHYSICAL) { e.setCancelled(true); return; } // crop trampling, plates
        if (b.getState() instanceof org.bukkit.inventory.InventoryHolder && !cfg("config.yml").getBoolean("regions.allow-containers", false)) {
            // Crates and spawners are handled by their own modules before this (HIGH priority cancels after).
            if (plugin.crates.crateAt(b) == null) e.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        if (!isProtected(p.getLocation())) return;
        if (e.getCause() == EntityDamageEvent.DamageCause.VOID) { e.setCancelled(true); p.teleportAsync(plugin.locs().spawn()); return; }
        e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onPvp(EntityDamageByEntityEvent e) {
        Entity d = e.getDamager();
        if (d instanceof Projectile pr && pr.getShooter() instanceof Entity sh) d = sh;
        if (d instanceof Player attacker && isProtected(attacker.getLocation()) && !(attacker.hasPermission("dc.admin.build"))) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onHunger(FoodLevelChangeEvent e) {
        if (e.getEntity() instanceof Player p && isProtected(p.getLocation()) && e.getFoodLevel() < p.getFoodLevel()) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onMobSpawn(CreatureSpawnEvent e) {
        if (e.getSpawnReason() == CreatureSpawnEvent.SpawnReason.NATURAL && isProtected(e.getLocation())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onExplode(EntityExplodeEvent e) { e.blockList().removeIf(b -> isProtected(b.getLocation())); }

    @EventHandler(ignoreCancelled = true)
    public void onBlockExplode(BlockExplodeEvent e) { e.blockList().removeIf(b -> isProtected(b.getLocation())); }

    @EventHandler(ignoreCancelled = true)
    public void onSpread(BlockSpreadEvent e) { if (isProtected(e.getBlock().getLocation())) e.setCancelled(true); }

    @EventHandler(ignoreCancelled = true)
    public void onBurn(BlockBurnEvent e) { if (isProtected(e.getBlock().getLocation())) e.setCancelled(true); }

    /** Void-safe: falling below the world in the spawn world returns to spawn. */
    @EventHandler(ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        if (e.getTo() == null || e.getFrom().getBlockY() == e.getTo().getBlockY()) return;
        Location sp = plugin.locs().spawn();
        Location to = e.getTo();
        if (to.getWorld().equals(sp.getWorld()) && to.getY() < to.getWorld().getMinHeight() - cfg("config.yml").getInt("regions.void-return-depth", 10)
            && (spawn == null || horizontallyNear(to))) {
            e.getPlayer().setFallDistance(0);
            e.getPlayer().teleportAsync(sp);
        }
    }

    private boolean horizontallyNear(Location l) {
        return l.getBlockX() >= spawn.minX() - 32 && l.getBlockX() <= spawn.maxX() + 32 && l.getBlockZ() >= spawn.minZ() - 32 && l.getBlockZ() <= spawn.maxZ() + 32;
    }

    @EventHandler
    public void onFirstJoin(PlayerJoinEvent e) {
        if (!e.getPlayer().hasPlayedBefore() && cfg("config.yml").getBoolean("spawn.teleport-on-first-join", true)) e.getPlayer().teleportAsync(plugin.locs().spawn());
        else if (cfg("config.yml").getBoolean("spawn.teleport-on-join", false)) e.getPlayer().teleportAsync(plugin.locs().spawn());
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onRespawn(PlayerRespawnEvent e) {
        if (!e.isBedSpawn() && !e.isAnchorSpawn() && cfg("config.yml").getBoolean("spawn.respawn-at-spawn", true)) e.setRespawnLocation(plugin.locs().spawn());
    }
}
