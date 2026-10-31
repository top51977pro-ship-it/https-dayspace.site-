package net.donutclassic.spawner;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.*;
import net.donutclassic.util.*;
import org.bukkit.*;
import org.bukkit.block.Block;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.entity.SpawnerSpawnEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;

import java.util.*;

/**
 * VIRTUAL STACKED SPAWNERS. Placed spawner blocks never spawn entities; while a player is within the
 * activation distance (default policy) they accumulate drops into virtual storage, with diminishing
 * returns for stacking. All state is mutated on the main thread; persistence is batched to SQLite.
 */
public final class SpawnerModule extends Module {
    final Map<String, SpawnerType> types = new LinkedHashMap<>();
    private final Map<String, SpawnerRecord> byKey = new HashMap<>();
    private final Map<String, Map<Long, List<SpawnerRecord>>> byChunk = new HashMap<>();
    SpawnerRepo repo;
    StackCurve curve;
    private BukkitTask tickTask, saveTask;
    int cycleSeconds; double activationDistance; String policy;
    long storagePerSpawner, storageMax;
    boolean requireSilk, allowOthersBreak, publicAccess, protectExplosions;
    private boolean loaded;

    public SpawnerModule(DonutClassic plugin) { super(plugin); }
    DonutClassic plugin() { return plugin; }
    @Override public String name() { return "spawners"; }

    @Override public void enable() {
        repo = new SpawnerRepo(plugin.db());
        reload();
        repo.loadAll().thenAccept(list -> plugin.runSync(() -> {
            for (SpawnerRecord r : list) index(r);
            loaded = true;
            plugin.getLogger().info("Loaded " + list.size() + " virtual spawners.");
        }));
        command("spawner", (s, a) -> plugin.getServer().dispatchCommand(s, "dc spawner " + String.join(" ", a)));
    }

    @Override public void reload() {
        YamlConfiguration y = cfg("spawners.yml");
        types.clear();
        ConfigurationSection t = y.getConfigurationSection("types");
        if (t != null) for (String id : t.getKeys(false)) types.put(id.toUpperCase(Locale.ROOT), SpawnerType.load(id, t.getConfigurationSection(id)));
        Map<Integer, Double> table = new HashMap<>();
        ConfigurationSection ts = y.getConfigurationSection("stacking.table");
        if (ts != null) for (String k : ts.getKeys(false)) try { table.put(Integer.parseInt(k), ts.getDouble(k)); } catch (NumberFormatException ignored) { }
        curve = new StackCurve(y.getString("stacking.mode", "power"), y.getDouble("stacking.exponent", 0.85), table, y.getInt("stacking.max-stack", 10000));
        cycleSeconds = Math.max(5, y.getInt("cycle-seconds", 20));
        activationDistance = y.getDouble("activation-distance", 64);
        policy = y.getString("offline-policy", "near-player");
        storagePerSpawner = Math.max(1, y.getLong("storage.per-spawner", 2304));
        storageMax = Math.max(1, y.getLong("storage.max-total", 10_000_000));
        requireSilk = y.getBoolean("mining.require-silk-touch", true);
        allowOthersBreak = y.getBoolean("mining.allow-non-owner-break", false);
        publicAccess = y.getBoolean("access.public", false);
        protectExplosions = y.getBoolean("protect-from-explosions", true);
        if (tickTask != null) tickTask.cancel();
        if (saveTask != null) saveTask.cancel();
        tickTask = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, cycleSeconds * 20L, cycleSeconds * 20L);
        long save = Math.max(10, y.getLong("save-interval-seconds", 60)) * 20L;
        saveTask = Bukkit.getScheduler().runTaskTimer(plugin, this::saveDirty, save, save);
    }

    @Override public void disable() {
        if (tickTask != null) tickTask.cancel();
        if (saveTask != null) saveTask.cancel();
        saveDirty();
    }

    // ------------------------------------------------------------------ index
    private void index(SpawnerRecord r) {
        byKey.put(r.key(), r);
        byChunk.computeIfAbsent(r.world, k -> new HashMap<>()).computeIfAbsent(r.chunkKey(), k -> new ArrayList<>()).add(r);
    }

    private void unindex(SpawnerRecord r) {
        byKey.remove(r.key());
        Map<Long, List<SpawnerRecord>> w = byChunk.get(r.world);
        if (w != null) { List<SpawnerRecord> l = w.get(r.chunkKey()); if (l != null) { l.remove(r); if (l.isEmpty()) w.remove(r.chunkKey()); } }
    }

    public SpawnerRecord at(Block b) { return byKey.get(SpawnerRecord.key(b.getWorld().getUID().toString(), b.getX(), b.getY(), b.getZ())); }
    public int count() { return byKey.size(); }
    public Collection<SpawnerType> types() { return types.values(); }
    public SpawnerType type(String id) { return id == null ? null : types.get(id.toUpperCase(Locale.ROOT)); }

    // ------------------------------------------------------------------ production
    private void tick() {
        if (!loaded) return;
        double d2 = activationDistance * activationDistance;
        for (World w : Bukkit.getWorlds()) {
            Map<Long, List<SpawnerRecord>> chunks = byChunk.get(w.getUID().toString());
            if (chunks == null || chunks.isEmpty()) continue;
            List<Player> players = w.getPlayers();
            for (var entry : chunks.entrySet()) {
                List<SpawnerRecord> list = entry.getValue();
                if (list.isEmpty()) continue;
                SpawnerRecord first = list.get(0);
                if (!w.isChunkLoaded(first.x >> 4, first.z >> 4)) continue; // never load chunks; no catch-up
                for (SpawnerRecord r : list) {
                    boolean active = switch (policy) {
                        case "loaded-chunk" -> true;
                        default -> nearPlayer(players, r, d2);
                    };
                    if (!active) continue;
                    produce(r, cycleSeconds);
                }
            }
        }
    }

    private static boolean nearPlayer(List<Player> players, SpawnerRecord r, double d2) {
        for (Player p : players) {
            Location l = p.getLocation();
            double dx = l.getX() - r.x, dy = l.getY() - r.y, dz = l.getZ() - r.z;
            if (dx * dx + dy * dy + dz * dz <= d2 && p.getGameMode() != GameMode.SPECTATOR) return true;
        }
        return false;
    }

    void produce(SpawnerRecord r, double seconds) {
        SpawnerType t = types.get(r.type);
        if (t == null || !t.enabled()) return;
        double eff = curve.effective(r.stack);
        long cap = capacity(r);
        SpawnerMath.produce(t.drops(), eff, seconds, r.storage, r.carry, cap);
        r.full = SpawnerMath.total(r.storage) >= cap;
        double xp = t.xpPerMinute() * eff * seconds / 60.0 + r.xpCarry;
        long whole = (long) xp;
        r.xpCarry = xp - whole;
        r.xp = Math.min(1_000_000_000L, r.xp + whole);
        r.lastActive = System.currentTimeMillis();
        r.dirty = true;
    }

    long capacity(SpawnerRecord r) { return SpawnerMath.capacity(storagePerSpawner, r.stack, storageMax); }

    void saveDirty() {
        List<SpawnerRecord.Snapshot> batch = new ArrayList<>();
        for (SpawnerRecord r : byKey.values()) if (r.dirty && r.id >= 0) { batch.add(r.snapshot()); r.dirty = false; }
        if (!batch.isEmpty()) repo.saveBatch(batch);
    }

    /** Persist one record right now (after a player action like collect/sell/merge). */
    void saveNow(SpawnerRecord r, String actor, String action, String detail) {
        if (r.id < 0) { r.dirty = true; return; }
        r.dirty = false;
        repo.update(r.snapshot(), actor, action, detail);
    }

    // ------------------------------------------------------------------ items
    public ItemStack item(SpawnerType t, int amount) {
        List<String> lore = new ArrayList<>();
        for (SpawnerMath.Drop d : t.drops()) lore.add("&7Produces &f" + Items.pretty(Material.valueOf(d.material())));
        lore.add("&8Virtual spawner - no mobs");
        ItemStack it = Items.make(Material.SPAWNER, amount, t.display(), lore);
        return Items.setTag(it, Items.SPAWNER, t.id());
    }

    /** Gives spawner items; overflow goes to the mailbox (/claim) so nothing is lost. */
    public void give(Player p, SpawnerType t, long amount, String source) {
        List<ItemStack> left = Items.give(p, Items.stacks(item(t, 1), amount));
        if (!left.isEmpty()) { plugin.mailbox.addAll(p.getUniqueId(), left, source); msg().send(p, "mailbox.overflow"); }
    }

    public SpawnerType typeOf(ItemStack it) {
        if (it == null || it.getType() != Material.SPAWNER) return null;
        return type(Items.tag(it, Items.SPAWNER));
    }

    // ------------------------------------------------------------------ listeners
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) {
        SpawnerType t = typeOf(e.getItemInHand());
        if (t == null) return;
        if (!loaded || !t.enabled()) { e.setCancelled(true); return; }
        Block b = e.getBlockPlaced();
        configureBlock(b, t);
        SpawnerRecord r = new SpawnerRecord(b.getWorld().getUID().toString(), b.getX(), b.getY(), b.getZ(), t.id(), 1, e.getPlayer().getUniqueId());
        index(r);
        String actor = e.getPlayer().getName();
        repo.insert(r.snapshot(), actor).whenComplete((id, err) -> plugin.runSync(() -> {
            if (err != null) {
                plugin.getLogger().severe("Spawner insert failed at " + r.key() + ": " + err);
                return;
            }
            r.id = id;
            if (r.removed) repo.delete(id, actor, "removed before insert finished");
            else if (r.dirty) saveNow(r, actor, "sync", "post-insert");
        }));
        msg().send(e.getPlayer(), "spawner.placed", "type", Msg.color(t.display()));
    }

    void configureBlock(Block b, SpawnerType t) {
        if (!(b.getState() instanceof CreatureSpawner cs)) return;
        try { cs.setSpawnedType(t.entity()); } catch (Exception ignored) { }
        cs.setRequiredPlayerRange(0); // vanilla spawning disabled; SpawnerSpawnEvent is cancelled too
        cs.setSpawnCount(0);
        cs.update(true, false);
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onSpawn(SpawnerSpawnEvent e) {
        if (e.getSpawner() != null && at(e.getSpawner().getBlock()) != null) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onInteract(PlayerInteractEvent e) {
        if (e.getAction() != org.bukkit.event.block.Action.RIGHT_CLICK_BLOCK || e.getClickedBlock() == null) return;
        SpawnerRecord r = at(e.getClickedBlock());
        if (r == null) return;
        e.setCancelled(true); // no spawn-egg changes, no block placement against it
        if (e.getHand() != EquipmentSlot.HAND) return;
        Player p = e.getPlayer();
        if (!canAccess(p, r)) { msg().send(p, "spawner.no-access"); return; }
        ItemStack hand = p.getInventory().getItemInMainHand();
        SpawnerType held = typeOf(hand);
        if (p.isSneaking() && held != null) {
            if (!held.id().equals(r.type)) { msg().send(p, "spawner.type-mismatch"); return; }
            mergeFromHand(p, r);
            return;
        }
        new SpawnerMenu(this, r, p).open();
    }

    /** Adds every matching spawner item in the main hand to the stack (Java sneak+use). */
    void mergeFromHand(Player p, SpawnerRecord r) {
        ItemStack hand = p.getInventory().getItemInMainHand();
        SpawnerType held = typeOf(hand);
        if (held == null || !held.id().equals(r.type) || r.removed) return;
        int amount = hand.getAmount();
        long room = curve.maxStack() - r.stack;
        int use = (int) Math.max(0, Math.min(amount, room));
        if (use <= 0) { msg().send(p, "spawner.max-stack", "max", curve.maxStack()); return; }
        hand.setAmount(amount - use);
        p.getInventory().setItemInMainHand(hand.getAmount() <= 0 ? null : hand);
        r.stack += use;
        saveNow(r, p.getName(), "merge", "+" + use + " -> " + r.stack);
        msg().send(p, "spawner.merged", "amount", use, "stack", r.stack);
    }

    /** Adds every matching spawner item from the whole inventory (Bedrock-friendly "Add Stack" button). */
    void mergeFromInventory(Player p, SpawnerRecord r) {
        if (r.removed) return;
        long room = curve.maxStack() - r.stack;
        int added = 0;
        ItemStack[] c = p.getInventory().getStorageContents();
        for (int i = 0; i < c.length && room > 0; i++) {
            SpawnerType t = typeOf(c[i]);
            if (t == null || !t.id().equals(r.type)) continue;
            int take = (int) Math.min(c[i].getAmount(), room);
            room -= take; added += take;
            if (take == c[i].getAmount()) c[i] = null; else c[i].setAmount(c[i].getAmount() - take);
        }
        if (added == 0) { msg().send(p, room <= 0 ? "spawner.max-stack" : "spawner.none-to-add", "max", curve.maxStack()); return; }
        p.getInventory().setStorageContents(c);
        r.stack += added;
        saveNow(r, p.getName(), "merge", "+" + added + " -> " + r.stack);
        msg().send(p, "spawner.merged", "amount", added, "stack", r.stack);
    }

    boolean canAccess(Player p, SpawnerRecord r) {
        if (publicAccess || p.hasPermission("dc.admin.spawner")) return true;
        if (r.owner == null || r.owner.equals(p.getUniqueId())) return true;
        return plugin.teams.sameTeam(r.owner, p.getUniqueId());
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        SpawnerRecord r = at(e.getBlock());
        if (r == null) {
            // Natural/vanilla spawners keep vanilla behaviour unless configured otherwise.
            return;
        }
        Player p = e.getPlayer();
        if (!allowOthersBreak && !canAccess(p, r)) { e.setCancelled(true); msg().send(p, "spawner.no-access"); return; }
        ItemStack tool = p.getInventory().getItemInMainHand();
        if (requireSilk && p.getGameMode() != GameMode.CREATIVE && !tool.containsEnchantment(Enchantment.SILK_TOUCH)) {
            e.setCancelled(true); msg().send(p, "spawner.need-silk"); return;
        }
        SpawnerType t = types.get(r.type);
        e.setDropItems(false);
        e.setExpToDrop(0);
        long take = r.stack;
        if (p.isSneaking() && r.stack > 1) { // sneak-break removes only one spawner from the stack
            e.setCancelled(true);
            take = 1;
            r.stack -= 1;
            saveNow(r, p.getName(), "break-one", "-1 -> " + r.stack);
        } else {
            removeRecord(r, p.getName(), "mined x" + r.stack);
            List<ItemStack> contents = new ArrayList<>();
            for (var en : r.storage.entrySet()) {
                Material m = Material.matchMaterial(en.getKey());
                if (m != null) contents.addAll(Items.stacks(m, en.getValue()));
            }
            r.storage.clear();
            List<ItemStack> left = Items.give(p, contents);
            if (!left.isEmpty()) plugin.mailbox.addAll(p.getUniqueId(), left, "spawner storage");
            if (r.xp > 0) p.giveExp((int) Math.min(Integer.MAX_VALUE, r.xp));
        }
        if (t != null) give(p, t, take, "spawner mined");
        msg().send(p, "spawner.mined", "amount", take);
    }

    void removeRecord(SpawnerRecord r, String actor, String detail) {
        r.removed = true;
        unindex(r);
        if (r.id >= 0) repo.delete(r.id, actor, detail);
    }

    @EventHandler(ignoreCancelled = true)
    public void onExplode(EntityExplodeEvent e) {
        if (protectExplosions) e.blockList().removeIf(b -> at(b) != null);
    }

    @EventHandler(ignoreCancelled = true)
    public void onBlockExplode(BlockExplodeEvent e) {
        if (protectExplosions) e.blockList().removeIf(b -> at(b) != null);
    }

    @EventHandler(ignoreCancelled = true)
    public void onPiston(BlockPistonExtendEvent e) { for (Block b : e.getBlocks()) if (at(b) != null) { e.setCancelled(true); return; } }

    // ------------------------------------------------------------------ admin
    public void adminCommand(CommandSender s, String[] a) {
        String sub = a.length > 1 ? a[1].toLowerCase(Locale.ROOT) : "help";
        switch (sub) {
            case "give" -> {
                if (a.length < 4) { msg().sendRaw(s, "&c/dc spawner give <player> <type> [amount]"); return; }
                Player t = Bukkit.getPlayerExact(a[2]);
                SpawnerType type = type(a[3]);
                long n = a.length > 4 ? Money.parseWhole(a[4], 100_000) : 1;
                if (t == null || type == null || n <= 0) { msg().send(s, "error.bad-args"); return; }
                give(t, type, n, "admin " + s.getName());
                msg().send(s, "spawner.given", "player", t.getName(), "amount", n, "type", type.id());
                plugin.getLogger().info("[audit] " + s.getName() + " gave " + n + " " + type.id() + " spawner(s) to " + t.getName());
            }
            case "inspect", "audit" -> {
                Player p = player(s); if (p == null) return;
                Block b = p.getTargetBlockExact(6);
                SpawnerRecord r = b == null ? null : at(b);
                if (r == null) { msg().send(p, "spawner.not-looking"); return; }
                msg().sendRaw(p, "&6Spawner #" + r.id + " &7" + r.type + " x" + r.stack + " owner=" + ownerName(r) + " eff=" + String.format(Locale.ROOT, "%.2f", curve.effective(r.stack))
                    + " storage=" + SpawnerMath.encode(r.storage) + " xp=" + r.xp + " full=" + r.full);
                if (r.id >= 0) repo.auditFor(r.id, 8).thenAccept(l -> plugin.runSync(() -> l.forEach(x -> msg().sendRaw(p, "&8" + x))));
            }
            case "reload" -> { plugin.reload("spawners"); msg().send(s, "admin.reloaded", "what", "spawners"); }
            case "benchmark" -> {
                msg().sendRaw(s, "&6Output per minute (curve " + cfg("spawners.yml").getString("stacking.mode", "power") + "):");
                for (SpawnerType t : types.values()) {
                    if (!t.enabled()) continue;
                    StringBuilder sb = new StringBuilder("&e" + t.id() + "&7: ");
                    for (long st : new long[]{1, 10, 64, 100, 1000}) {
                        double eff = curve.effective(st);
                        sb.append("x").append(st).append("=");
                        List<String> parts = new ArrayList<>();
                        for (var d : t.drops()) parts.add(String.format(Locale.ROOT, "%.1f %s", d.perMinute() * eff, d.material().toLowerCase(Locale.ROOT)));
                        sb.append(String.join("+", parts)).append("  ");
                    }
                    msg().sendRaw(s, sb.toString());
                }
            }
            case "list" -> msg().sendRaw(s, "&7Types: &f" + String.join(", ", types.keySet()) + " &7| placed: &f" + count());
            default -> msg().sendRaw(s, "&e/dc spawner give|inspect|audit|reload|benchmark|list");
        }
    }

    String ownerName(SpawnerRecord r) {
        if (r.owner == null) return "-";
        OfflinePlayer op = Bukkit.getOfflinePlayer(r.owner);
        return op.getName() == null ? r.owner.toString().substring(0, 8) : op.getName();
    }

    /** Server-shop sell price for a stored material (prices.yml), in cents. */
    long priceOf(String material) { return plugin.economy.sellPrice(Material.matchMaterial(material)); }
}
