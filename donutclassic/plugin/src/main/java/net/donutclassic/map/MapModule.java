package net.donutclassic.map;

import com.destroystokyo.paper.profile.PlayerProfile;
import com.destroystokyo.paper.profile.ProfileProperty;
import net.donutclassic.DonutClassic;
import net.donutclassic.core.Litematic;
import net.donutclassic.core.Nbt;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.*;
import org.bukkit.block.*;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.sign.Side;
import org.bukkit.block.sign.SignSide;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.*;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Transformation;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import java.io.File;
import java.util.*;

/**
 * Pastes Litematica (.litematic) builds - e.g. the community spawn/AFK schematics - into a world.
 * The file is parsed off the main thread; blocks are then placed on the main thread within a
 * per-tick time budget, so the server keeps ticking. Afterwards signs, player heads, container
 * contents, armour-stand holograms and text displays are restored. Map files are NOT shipped with
 * the plugin: the owner uploads them to plugins/DonutClassic/maps/.
 */
public final class MapModule extends Module {
    private PasteJob job;

    public MapModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "maps"; }

    private final Deque<String[]> queue = new ArrayDeque<>(); // {file, world, x|null, y, z}

    @Override public void enable() {
        new File(plugin.getDataFolder(), "maps").mkdirs();
        for (String w : cfg("config.yml").getStringList("worlds.void-worlds")) loadVoidWorld(w);
        extractBundled();
        // Auto-paste bundled maps once (after the server finished loading), one after another.
        Bukkit.getScheduler().runTaskLater(plugin, this::queueBundled, 100L);
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (job != null || queue.isEmpty()) return;
            String[] q = queue.poll();
            File f = new File(new File(plugin.getDataFolder(), "maps"), q[0]);
            if (!f.isFile()) return;
            Integer[] at = q[2] == null ? null : new Integer[]{Integer.parseInt(q[2]), Integer.parseInt(q[3]), Integer.parseInt(q[4])};
            plugin.getLogger().info("Auto-pasting bundled map " + q[0] + " into world " + q[1]);
            start(Bukkit.getConsoleSender(), f, q[1], at, false);
        }, 120L, 40L);
    }

    /** Copies map files shipped inside the jar (bundled-maps/*.litematic) to plugins/DonutClassic/maps once. */
    private void extractBundled() {
        File dir = new File(plugin.getDataFolder(), "maps");
        int found = 0;
        try (java.util.jar.JarFile jar = new java.util.jar.JarFile(plugin.getPluginFile())) {
            var en = jar.entries();
            while (en.hasMoreElements()) {
                var e = en.nextElement();
                if (!e.getName().startsWith("bundled-maps/") || !e.getName().endsWith(".litematic")) continue;
                found++;
                File out = new File(dir, e.getName().substring("bundled-maps/".length()));
                if (out.exists()) continue;
                try (var in = jar.getInputStream(e)) { java.nio.file.Files.copy(in, out.toPath()); }
                plugin.getLogger().info("Extracted bundled map " + out.getName());
            }
        } catch (Exception ex) { plugin.getLogger().warning("Could not read bundled maps: " + ex.getMessage()); }
        plugin.getLogger().info(found == 0 ? "No maps bundled in this jar (use /dc map paste for your own .litematic files)."
            : "Found " + found + " map(s) bundled in the jar.");
    }

    private void queueBundled() {
        if (!cfg("config.yml").getBoolean("worlds.auto-paste-bundled", true)) return;
        var sec = cfg("config.yml").getConfigurationSection("worlds.bundled");
        if (sec == null) return;
        for (String key : sec.getKeys(false)) {
            String file = sec.getString(key + ".file", key + ".litematic");
            String name = file.replace(".litematic", "");
            if (plugin.locs().get("maps." + name + ".min") != null) { plugin.getLogger().info("Map " + name + " already pasted earlier - skipping."); continue; }
            if (!new File(new File(plugin.getDataFolder(), "maps"), file).isFile()) continue; // not shipped
            List<Integer> at = sec.getIntegerList(key + ".at");
            String world = sec.getString(key + ".world", cfg("config.yml").getString("worlds.spawn-world", "spawn"));
            plugin.getLogger().info("Queued map " + file + " for pasting into world '" + world + "'. It only progresses while the server is running (not paused).");
            queue.add(at.size() == 3 ? new String[]{file, world, at.get(0).toString(), at.get(1).toString(), at.get(2).toString()} : new String[]{file, world, null, null, null});
        }
    }

    /** Role of a pasted map from worlds.bundled.<key>.role (spawn | afk), matched by file name. */
    private String roleOf(String name) {
        var sec = cfg("config.yml").getConfigurationSection("worlds.bundled");
        if (sec == null) return null;
        for (String key : sec.getKeys(false))
            if (sec.getString(key + ".file", key + ".litematic").replace(".litematic", "").equalsIgnoreCase(name)) return sec.getString(key + ".role");
        return null;
    }

    @Override public void disable() { if (job != null) job.cancel("server stopping"); }

    public World loadVoidWorld(String name) {
        World w = Bukkit.getWorld(name);
        if (w != null) return w;
        w = new WorldCreator(name).generator(new VoidGenerator()).generateStructures(false).createWorld();
        if (w != null) {
            w.setGameRule(GameRule.DO_MOB_SPAWNING, false);
            w.setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false);
            w.setGameRule(GameRule.DO_WEATHER_CYCLE, false);
            w.setTime(6000);
            plugin.getLogger().info("Loaded void world " + name);
        }
        return w;
    }

    private void remember(String world) {
        List<String> l = new ArrayList<>(cfg("config.yml").getStringList("worlds.void-worlds"));
        if (!l.contains(world)) { l.add(world); cfg("config.yml").set("worlds.void-worlds", l); plugin.saveCfg("config.yml"); }
    }

    // ------------------------------------------------------------------ command
    public void command(CommandSender s, String[] a) {
        String sub = a.length > 1 ? a[1].toLowerCase(Locale.ROOT) : "help";
        File dir = new File(plugin.getDataFolder(), "maps");
        switch (sub) {
            case "list" -> {
                File[] fs = dir.listFiles((d, n) -> n.endsWith(".litematic"));
                msg().sendRaw(s, "&6Map files in plugins/DonutClassic/maps: &f" + (fs == null || fs.length == 0 ? "(none)" : String.join(", ", Arrays.stream(fs).map(File::getName).toList())));
                for (String k : plugin.locs().keys("maps")) msg().sendRaw(s, "&7pasted: &f" + k + " &7" + boundsText(k));
            }
            case "paste" -> {
                // /dc map paste <file> [world] [x y z] [air]
                if (a.length < 3) { msg().sendRaw(s, "&c/dc map paste <file.litematic> [world] [x y z] [air]"); return; }
                if (job != null) { msg().sendRaw(s, "&cA paste is already running (/dc map status, /dc map cancel)."); return; }
                File f = new File(dir, a[2].endsWith(".litematic") ? a[2] : a[2] + ".litematic");
                if (!f.isFile() || !f.getParentFile().equals(dir)) { msg().sendRaw(s, "&cFile not found in plugins/DonutClassic/maps: " + f.getName()); return; }
                String world = a.length > 3 ? a[3] : cfg("config.yml").getString("worlds.spawn-world", "spawn");
                Integer[] at = null;
                if (a.length > 6) try { at = new Integer[]{Integer.parseInt(a[4]), Integer.parseInt(a[5]), Integer.parseInt(a[6])}; }
                    catch (NumberFormatException e) { msg().send(s, "error.bad-args"); return; }
                boolean air = Arrays.asList(a).contains("air");
                start(s, f, world, at, air);
            }
            case "status" -> msg().sendRaw(s, job == null ? "&7No paste running." : job.status());
            case "cancel" -> { if (job != null) job.cancel("cancelled by " + s.getName()); else msg().sendRaw(s, "&7Nothing to cancel."); }
            case "tp" -> {
                if (!(s instanceof Player p) || a.length < 3) { msg().sendRaw(s, "&c/dc map tp <name>"); return; }
                Location c = center(a[2]);
                if (c == null) { msg().sendRaw(s, "&cUnknown pasted map."); return; }
                p.teleportAsync(c);
            }
            case "region" -> {
                // /dc map region <name> spawn|afk  -> protection / AFK reward corners = pasted bounds
                if (a.length < 4) { msg().sendRaw(s, "&c/dc map region <name> spawn|afk"); return; }
                Location l1 = plugin.locs().get("maps." + a[2] + ".min"), l2 = plugin.locs().get("maps." + a[2] + ".max");
                if (l1 == null || l2 == null) { msg().sendRaw(s, "&cUnknown pasted map."); return; }
                String pre = a[3].equalsIgnoreCase("afk") ? "afk" : "spawn";
                plugin.locs().set(pre + "-corner1", l1); plugin.locs().set(pre + "-corner2", l2);
                plugin.region.reload();
                msg().send(s, "admin.set", "what", pre + " region = map " + a[2]);
            }
            case "clearholograms" -> {
                int n = 0;
                for (World w : Bukkit.getWorlds()) for (Entity e : w.getEntities()) {
                    String t = e.getPersistentDataContainer().get(Items.HOLO, PersistentDataType.STRING);
                    if (t != null && t.startsWith("map:") && (a.length < 3 || t.equals("map:" + a[2]))) { e.remove(); n++; }
                }
                msg().sendRaw(s, "&aRemoved " + n + " map hologram entities (loaded chunks only).");
            }
            default -> msg().sendRaw(s, "&e/dc map list | paste <file> [world] [x y z] [air] | status | cancel | tp <name> | region <name> spawn|afk | clearholograms [name]");
        }
    }

    private String boundsText(String k) {
        Location a = plugin.locs().get("maps." + k + ".min"), b = plugin.locs().get("maps." + k + ".max");
        return a == null || b == null ? "" : a.getWorld().getName() + " " + a.getBlockX() + "," + a.getBlockY() + "," + a.getBlockZ() + " -> " + b.getBlockX() + "," + b.getBlockY() + "," + b.getBlockZ();
    }

    public Location center(String name) {
        Location a = plugin.locs().get("maps." + name + ".min"), b = plugin.locs().get("maps." + name + ".max");
        if (a == null || b == null) return null;
        int x = (a.getBlockX() + b.getBlockX()) / 2, z = (a.getBlockZ() + b.getBlockZ()) / 2;
        int y = a.getWorld().getHighestBlockYAt(x, z) + 1;
        return new Location(a.getWorld(), x + 0.5, Math.max(y, a.getBlockY() + 1), z + 0.5);
    }

    private void start(CommandSender s, File f, String worldName, Integer[] at, boolean air) {
        World w = Bukkit.getWorld(worldName);
        if (w == null) { w = loadVoidWorld(worldName); remember(worldName); if (plugin.region != null) plugin.region.applyBorders(); }
        if (w == null) { msg().sendRaw(s, "&cCould not load/create world " + worldName); return; }
        final World world = w;
        msg().sendRaw(s, "&7Reading " + f.getName() + " ...");
        job = new PasteJob(s, f.getName().replace(".litematic", ""), world, air); // placeholder so a 2nd paste is refused
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                Litematic l = Litematic.read(f);
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (job == null || job.cancelled) return;
                    int x = at != null ? at[0] : -l.sizeX / 2, y = at != null ? at[1] : cfg("config.yml").getInt("worlds.paste-base-y", 0), z = at != null ? at[2] : -l.sizeZ / 2;
                    if (y < world.getMinHeight() || y + l.sizeY > world.getMaxHeight()) { msg().sendRaw(s, "&cDoes not fit in the world height at y=" + y); job = null; return; }
                    job.begin(l, new Location(world, x, y, z));
                });
            } catch (Exception e) {
                plugin.getLogger().severe("Could not read " + f.getName() + ": " + e);
                Bukkit.getScheduler().runTask(plugin, () -> { msg().sendRaw(s, "&cCould not read map: " + e.getMessage()); job = null; });
            }
        });
    }

    // ------------------------------------------------------------------ job
    private final class PasteJob {
        final CommandSender who; final String name; final World world; final boolean pasteAir;
        Litematic lit; Location origin;
        BukkitTask task; boolean cancelled;
        int regionIdx, chunkIdx; List<int[]> chunks; BlockData[] cache; boolean[] airIdx;
        long placed, checked, total, unknown; long started; final Set<String> unknownStates = new TreeSet<>();

        PasteJob(CommandSender who, String name, World world, boolean air) { this.who = who; this.name = name; this.world = world; this.pasteAir = air; }

        void begin(Litematic l, Location origin) {
            this.lit = l; this.origin = origin; this.started = System.currentTimeMillis();
            for (Litematic.Region r : l.regions) total += r.volume();
            msg().sendRaw(who, "&aPasting &f" + l.name + " &aby &f" + l.author + " &7(" + l.sizeX + "x" + l.sizeY + "x" + l.sizeZ + ", data version " + l.dataVersion
                + ") &aat &f" + world.getName() + " " + origin.getBlockX() + " " + origin.getBlockY() + " " + origin.getBlockZ());
            plugin.getLogger().info("Paste of " + name + " started at " + world.getName() + " " + origin.toVector());
            prepareRegion();
            task = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 1L, 1L);
        }

        void prepareRegion() {
            Litematic.Region r = lit.regions.get(regionIdx);
            cache = new BlockData[r.palette.size()];
            airIdx = new boolean[r.palette.size()];
            for (int i = 0; i < cache.length; i++) {
                String st = r.palette.get(i);
                airIdx[i] = Litematic.isAir(st);
                cache[i] = blockData(st);
            }
            chunks = new ArrayList<>();
            int x0 = origin.getBlockX() + r.offX, z0 = origin.getBlockZ() + r.offZ;
            for (int cx = x0 >> 4; cx <= (x0 + r.sx - 1) >> 4; cx++) for (int cz = z0 >> 4; cz <= (z0 + r.sz - 1) >> 4; cz++) chunks.add(new int[]{cx, cz});
            chunkIdx = 0;
        }

        BlockData blockData(String st) {
            try { return Bukkit.createBlockData(st); }
            catch (IllegalArgumentException e) {
                String base = st.contains("[") ? st.substring(0, st.indexOf('[')) : st;
                try { unknownStates.add(st); return Bukkit.createBlockData(base); }
                catch (IllegalArgumentException e2) { unknownStates.add(base); return Bukkit.createBlockData(Material.AIR); }
            }
        }

        void tick() {
            if (cancelled) return;
            long budget = Math.max(5, cfg("config.yml").getLong("worlds.paste-ms-per-tick", 30)) * 1_000_000L;
            long t0 = System.nanoTime();
            while (System.nanoTime() - t0 < budget) {
                if (regionIdx >= lit.regions.size()) { finishBlocks(); return; }
                Litematic.Region r = lit.regions.get(regionIdx);
                if (chunkIdx >= chunks.size()) { regionIdx++; if (regionIdx < lit.regions.size()) prepareRegion(); continue; }
                int[] c = chunks.get(chunkIdx++);
                int bx = origin.getBlockX() + r.offX, by = origin.getBlockY() + r.offY, bz = origin.getBlockZ() + r.offZ;
                int lx0 = Math.max(0, (c[0] << 4) - bx), lx1 = Math.min(r.sx - 1, (c[0] << 4) + 15 - bx);
                int lz0 = Math.max(0, (c[1] << 4) - bz), lz1 = Math.min(r.sz - 1, (c[1] << 4) + 15 - bz);
                Chunk chunk = null;
                for (int y = 0; y < r.sy; y++) for (int z = lz0; z <= lz1; z++) for (int x = lx0; x <= lx1; x++) {
                    int idx = r.get(x, y, z);
                    checked++;
                    if (airIdx[idx] && !pasteAir) continue;
                    if (chunk == null) chunk = world.getChunkAt(c[0], c[1]);
                    world.getBlockAt(bx + x, by + y, bz + z).setBlockData(cache[idx], false);
                    placed++;
                }
            }
            if (Bukkit.getCurrentTick() % 100 == 0) msg().sendRaw(who, status());
        }

        String status() {
            if (lit == null) return "&7Reading file...";
            return String.format(Locale.ROOT, "&7Paste %s: &f%.1f%% &7(%,d blocks placed, %ds)", name, total == 0 ? 100 : checked * 100.0 / total, placed,
                (System.currentTimeMillis() - started) / 1000);
        }

        void finishBlocks() {
            task.cancel();
            int tiles = 0, ents = 0;
            for (Litematic.Region r : lit.regions) {
                int bx = origin.getBlockX() + r.offX, by = origin.getBlockY() + r.offY, bz = origin.getBlockZ() + r.offZ;
                for (Map<String, Object> te : r.tileEntities) {
                    try { if (applyTile(world.getBlockAt(bx + Nbt.i(te.get("x")), by + Nbt.i(te.get("y")), bz + Nbt.i(te.get("z"))), te)) tiles++; }
                    catch (Exception e) { plugin.getLogger().warning("Block entity " + te.get("id") + " failed: " + e.getMessage()); }
                }
                for (Map<String, Object> en : r.entities) {
                    try {
                        List<Object> pos = Nbt.list(en.get("Pos"));
                        if (pos.size() < 3) continue;
                        Location l = new Location(world, origin.getBlockX() + r.originX + Nbt.d(pos.get(0)), origin.getBlockY() + r.originY + Nbt.d(pos.get(1)),
                            origin.getBlockZ() + r.originZ + Nbt.d(pos.get(2)));
                        List<Object> rot = Nbt.list(en.get("Rotation"));
                        if (rot.size() == 2) { l.setYaw((float) Nbt.d(rot.get(0))); l.setPitch((float) Nbt.d(rot.get(1))); }
                        if (spawnEntity(l, en)) ents++;
                    } catch (Exception e) { plugin.getLogger().warning("Entity " + en.get("id") + " failed: " + e.getMessage()); }
                }
            }
            Location min = origin.clone(), max = origin.clone().add(lit.sizeX - 1, lit.sizeY - 1, lit.sizeZ - 1);
            plugin.locs().set("maps." + name + ".min", min);
            plugin.locs().set("maps." + name + ".max", max);
            String done = String.format(Locale.ROOT, "Paste of %s finished: %,d blocks, %d block entities, %d entities in %ds. Unknown block states: %d",
                name, placed, tiles, ents, (System.currentTimeMillis() - started) / 1000, unknownStates.size());
            plugin.getLogger().info(done);
            if (!unknownStates.isEmpty()) plugin.getLogger().warning("Replaced/simplified block states: " + unknownStates);
            msg().sendRaw(who, "&a" + done);
            // First spawn-world paste: bind spawn + protection automatically if the admin hasn't yet.
            if ("afk".equalsIgnoreCase(roleOf(name))) {
                if (plugin.locs().get("afk-corner1") == null) { plugin.locs().set("afk-corner1", min); plugin.locs().set("afk-corner2", max); }
                if (plugin.locs().get("afk") == null) { Location c = center(name); if (c != null) plugin.locs().set("afk", c); }
                plugin.region.reload();
                msg().sendRaw(who, "&aAFK area bound: /afk point + AFK reward region = " + name + ". Adjust with /dc setafk.");
            } else if (world.getName().equalsIgnoreCase(cfg("config.yml").getString("worlds.spawn-world", "spawn"))) {
                Location old = plugin.locs().get("spawn");
                // A bundled spawn always takes over; a manual paste only fills an unset/other-world spawn.
                if (old == null || "spawn".equalsIgnoreCase(roleOf(name)) || !old.getWorld().equals(world)) {
                    Location c = center(name);
                    if (c != null) { plugin.locs().set("spawn", c); msg().sendRaw(who, "&aSpawn set to the middle of " + name + " (" + c.getBlockX() + ", " + c.getBlockY() + ", " + c.getBlockZ() + "). Move it with /dc setspawn."); }
                }
                if (plugin.locs().get("spawn-corner1") == null) {
                    plugin.locs().set("spawn-corner1", min); plugin.locs().set("spawn-corner2", max);
                    plugin.region.reload();
                    msg().sendRaw(who, "&aSpawn protection set to the pasted area.");
                }
            }
            msg().sendRaw(who, "&7Next: &f/dc map tp " + name + "&7, stand where players should appear, &f/dc setspawn&7.");
            job = null;
        }

        void cancel(String why) {
            cancelled = true;
            if (task != null) task.cancel();
            msg().sendRaw(who, "&cPaste " + name + " stopped: " + why + " (blocks already placed stay).");
            job = null;
        }

        // ---------------------------------------------------------- block entities
        boolean applyTile(Block b, Map<String, Object> te) {
            BlockState st = b.getState();
            if (st instanceof Sign sign) {
                text(sign.getSide(Side.FRONT), Nbt.map(te.get("front_text")));
                text(sign.getSide(Side.BACK), Nbt.map(te.get("back_text")));
                sign.setWaxed(Nbt.b(te.get("is_waxed")));
                return sign.update(true, false);
            }
            if (st instanceof Skull skull && te.get("profile") != null) {
                Object prof = te.get("profile");
                PlayerProfile p;
                if (prof instanceof String n) p = Bukkit.createProfile(n);
                else {
                    Map<String, Object> m = Nbt.map(prof);
                    UUID id = m.get("id") instanceof int[] ia && ia.length == 4
                        ? new UUID(((long) ia[0] << 32) | (ia[1] & 0xffffffffL), ((long) ia[2] << 32) | (ia[3] & 0xffffffffL)) : UUID.randomUUID();
                    p = Bukkit.createProfile(id, Nbt.s(m.get("name")));
                    for (Object o : Nbt.list(m.get("properties"))) {
                        Map<String, Object> pm = Nbt.map(o);
                        if (Nbt.s(pm.get("name")) != null && Nbt.s(pm.get("value")) != null)
                            p.setProperty(new ProfileProperty(Nbt.s(pm.get("name")), Nbt.s(pm.get("value")), Nbt.s(pm.get("signature"))));
                    }
                }
                skull.setPlayerProfile(p);
                return skull.update(true, false);
            }
            if (st instanceof Container c && te.get("Items") != null) {
                var inv = c.getSnapshotInventory();
                for (Object o : Nbt.list(te.get("Items"))) {
                    Map<String, Object> it = new LinkedHashMap<>(Nbt.map(o));
                    int slot = Nbt.i(it.remove("Slot"));
                    ItemStack item = item(it);
                    if (item != null && slot >= 0 && slot < inv.getSize()) inv.setItem(slot, item);
                }
                return c.update(true, false);
            }
            return false;
        }

        void text(SignSide side, Map<String, Object> t) {
            List<Object> lines = Nbt.list(t.get("messages"));
            for (int i = 0; i < Math.min(4, lines.size()); i++) side.setLine(i, Msg.color(Nbt.text(lines.get(i))));
            String col = Nbt.s(t.get("color"));
            if (col != null) try { side.setColor(DyeColor.valueOf(col.toUpperCase(Locale.ROOT))); } catch (IllegalArgumentException ignored) { }
            side.setGlowingText(Nbt.b(t.get("has_glowing_text")));
        }

        /** Re-encodes an item compound with the schematic's DataVersion so Paper's DataFixer upgrades it. */
        ItemStack item(Map<String, Object> nbt) {
            if (nbt.get("id") == null) return null;
            Map<String, Object> m = new LinkedHashMap<>(nbt);
            // Paper refuses "newer" data; maps saved on a slightly newer version (e.g. 1.21.5 on a 1.21.4 server)
            // are labelled with the server's own version instead, which works for ordinary items.
            @SuppressWarnings("deprecation") int serverDv = Bukkit.getUnsafe().getDataVersion();
            m.put("DataVersion", Math.min(lit.dataVersion, serverDv));
            if (!m.containsKey("count") && m.get("Count") instanceof Number n) m.put("count", n.intValue());
            try { return ItemStack.deserializeBytes(Nbt.writeGzip(m)); }
            catch (Exception e) { plugin.getLogger().warning("Item " + nbt.get("id") + " skipped: " + e.getMessage()); return null; }
        }

        // ---------------------------------------------------------- entities
        boolean spawnEntity(Location l, Map<String, Object> en) {
            String id = String.valueOf(en.get("id"));
            String tag = "map:" + name;
            switch (id) {
                case "minecraft:armor_stand" -> {
                    ArmorStand as = world.spawn(l, ArmorStand.class);
                    {
                        as.setInvisible(Nbt.b(en.get("Invisible")));
                        as.setSmall(Nbt.b(en.get("Small")));
                        as.setMarker(Nbt.b(en.get("Marker")));
                        as.setBasePlate(!Nbt.b(en.get("NoBasePlate")));
                        as.setArms(Nbt.b(en.get("ShowArms")));
                        as.setGravity(false); // decorative/hologram stands must not fall
                        as.setInvulnerable(true);
                        as.setPersistent(true);
                        if (en.get("CustomName") != null) { as.setCustomName(Msg.color(Nbt.text(en.get("CustomName")))); as.setCustomNameVisible(Nbt.b(en.get("CustomNameVisible"))); }
                        EntityEquipment eq = as.getEquipment();
                        Map<String, Object> equip = Nbt.map(en.get("equipment"));
                        if (eq != null) {
                            setIf(equip.get("head"), eq::setHelmet); setIf(equip.get("chest"), eq::setChestplate);
                            setIf(equip.get("legs"), eq::setLeggings); setIf(equip.get("feet"), eq::setBoots);
                            setIf(equip.get("mainhand"), eq::setItemInMainHand); setIf(equip.get("offhand"), eq::setItemInOffHand);
                        }
                        as.getPersistentDataContainer().set(Items.HOLO, PersistentDataType.STRING, tag);
                    }
                    return true;
                }
                case "minecraft:text_display" -> {
                    TextDisplay td = world.spawn(l, TextDisplay.class);
                    {
                        td.setText(Msg.color(Nbt.text(en.get("text"))));
                        String bb = Nbt.s(en.get("billboard"));
                        if (bb != null) try { td.setBillboard(Display.Billboard.valueOf(bb.toUpperCase(Locale.ROOT))); } catch (IllegalArgumentException ignored) { }
                        if (en.get("line_width") instanceof Number n) td.setLineWidth(n.intValue());
                        td.setSeeThrough(Nbt.b(en.get("see_through")));
                        td.setShadowed(Nbt.b(en.get("shadow")));
                        if (en.get("background") instanceof Number n) td.setBackgroundColor(Color.fromARGB(n.intValue()));
                        List<Object> sc = Nbt.list(Nbt.map(en.get("transformation")).get("scale"));
                        if (sc.size() == 3) {
                            Transformation t = td.getTransformation();
                            td.setTransformation(new Transformation(t.getTranslation(), t.getLeftRotation(),
                                new Vector3f((float) Nbt.d(sc.get(0)), (float) Nbt.d(sc.get(1)), (float) Nbt.d(sc.get(2))), new Quaternionf(t.getRightRotation())));
                        }
                        td.setPersistent(true);
                        td.getPersistentDataContainer().set(Items.HOLO, PersistentDataType.STRING, tag);
                    }
                    return true;
                }
                default -> { return false; }
            }
        }

        void setIf(Object nbt, java.util.function.Consumer<ItemStack> set) {
            Map<String, Object> m = Nbt.map(nbt);
            if (m.isEmpty()) return;
            ItemStack it = item(m);
            if (it != null) set.accept(it);
        }
    }
}
