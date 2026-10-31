package net.donutclassic.admin;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.crates.CrateModule;
import net.donutclassic.util.Module;
import net.donutclassic.util.Platform;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.*;

/** /dc admin command. Every sub-command requires dc.admin (OP by default). */
public final class AdminModule extends Module {
    public AdminModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "admin"; }

    private static final List<String> SUBS = List.of("help", "reload", "debug", "version", "status", "setupwizard", "setspawn", "setspawncorner1",
        "setspawncorner2", "setafk", "setafkcorner1", "setafkcorner2", "setcrate", "removecrate", "setnpc", "removenpc", "setwarp", "delwarp",
        "spawner", "key", "keyall", "shards", "money", "booster", "tool", "rank", "duel", "leaderboard", "hologram", "backup", "preset", "map", "border");

    @Override public void enable() {
        command("dc", this::cmd, (s, a) -> {
            if (a.length == 1) return SUBS;
            return switch (a[0].toLowerCase(Locale.ROOT)) {
                case "setcrate" -> CrateModule.TYPES;
                case "spawner" -> a.length == 2 ? List.of("give", "inspect", "audit", "reload", "benchmark", "list")
                    : a.length == 4 ? plugin.spawners.types().stream().map(t -> t.id()).toList() : null;
                case "key" -> a.length == 2 ? List.of("give", "take") : a.length == 4 ? CrateModule.TYPES : null;
                case "keyall" -> CrateModule.TYPES;
                case "shards", "money" -> a.length == 2 ? List.of("give", "take", "set") : null;
                case "preset" -> List.of("classic-early", "feb-2026", "post-2026");
                case "leaderboard" -> List.of("money", "shards", "kills", "deaths", "playtime", "duelwins");
                case "setnpc" -> new ArrayList<>(cfg("config.yml").getConfigurationSection("npcs") == null ? Set.of() : cfg("config.yml").getConfigurationSection("npcs").getKeys(false));
                case "reload" -> plugin.modules().stream().map(Module::name).toList();
                case "tool" -> a.length == 2 ? List.of("give") : a.length == 4 ? new ArrayList<>(plugin.tools.ids()) : null;
                case "rank" -> a.length == 4 ? new ArrayList<>(cfg("permissions.yml").getConfigurationSection("ranks").getKeys(false)) : null;
                case "duel" -> a.length == 2 ? List.of("setarena", "delarena") : null;
                case "border" -> a.length == 2 ? Bukkit.getWorlds().stream().map(org.bukkit.World::getName).toList() : List.of();
                case "map" -> a.length == 2 ? List.of("list", "paste", "status", "cancel", "tp", "region", "clearholograms")
                    : a.length == 3 && a[1].equalsIgnoreCase("paste") ? mapFiles() : a.length == 4 && a[1].equalsIgnoreCase("region") ? List.of("spawn", "afk") : null;
                default -> null;
            };
        });
    }

    private void cmd(CommandSender s, String[] a) {
        if (!perm(s, "dc.admin")) return;
        String sub = a.length == 0 ? "help" : a[0].toLowerCase(Locale.ROOT);
        Player p = s instanceof Player pl ? pl : null;
        switch (sub) {
            case "reload" -> msg().send(s, "admin.reloaded", "what", plugin.reload(a.length > 1 ? a[1] : null));
            case "version" -> msg().sendRaw(s, "&bDonutClassic &f" + plugin.getDescription().getVersion() + " &7on " + Bukkit.getName() + " " + Bukkit.getVersion());
            case "debug", "status" -> status(s);
            case "setupwizard" -> wizard(s);
            case "setspawn" -> bind(p, "spawn");
            case "setspawncorner1", "setspawnregion1" -> { bindBlock(p, "spawn-corner1"); plugin.region.reload(); }
            case "setspawncorner2", "setspawnregion2" -> { bindBlock(p, "spawn-corner2"); plugin.region.reload(); }
            case "setafk" -> bind(p, "afk");
            case "setafkcorner1" -> { bindBlock(p, "afk-corner1"); plugin.region.reload(); }
            case "setafkcorner2" -> { bindBlock(p, "afk-corner2"); plugin.region.reload(); }
            case "setwarp" -> { if (a.length < 2) msg().sendRaw(s, "&c/dc setwarp <name>"); else bind(p, "warps." + a[1].toLowerCase(Locale.ROOT)); }
            case "delwarp" -> { if (a.length > 1) { plugin.locs().set("warps." + a[1].toLowerCase(Locale.ROOT), null); msg().send(s, "admin.done"); } }
            case "setcrate" -> {
                if (p == null || a.length < 2 || !CrateModule.TYPES.contains(a[1].toLowerCase(Locale.ROOT))) { msg().sendRaw(s, "&c/dc setcrate <" + String.join("|", CrateModule.TYPES) + "> (look at a block)"); return; }
                Block b = p.getTargetBlockExact(6);
                if (b == null) { msg().send(p, "spawner.not-looking"); return; }
                plugin.crates.bind(b, a[1].toLowerCase(Locale.ROOT));
                msg().send(p, "admin.set", "what", a[1] + " crate at " + b.getX() + " " + b.getY() + " " + b.getZ());
            }
            case "removecrate" -> { if (p != null) { Block b = p.getTargetBlockExact(6); msg().send(p, b != null && plugin.crates.unbind(b) ? "admin.done" : "admin.failed"); } }
            case "setnpc" -> { if (p == null || a.length < 2) msg().sendRaw(s, "&c/dc setnpc <shop|shardshop|crates|rtp|duels|afk|ah|orders|...>"); else plugin.misc.spawnNpc(p, a[1].toLowerCase(Locale.ROOT)); }
            case "removenpc", "removeholo" -> { if (p != null) msg().send(p, plugin.misc.removeNearestNpc(p) ? "admin.done" : "admin.failed"); }
            case "spawner" -> plugin.spawners.adminCommand(s, a);
            case "key" -> plugin.crates.adminKey(s, a);
            case "keyall" -> {
                String type = a.length > 1 ? a[1].toLowerCase(Locale.ROOT) : "common";
                int n = a.length > 2 ? (int) Money.parseWhole(a[2], 1000) : 1;
                if (!CrateModule.TYPES.contains(type) || n <= 0) { msg().send(s, "error.bad-args"); return; }
                msg().send(s, "admin.keyall", "count", plugin.crates.keyAll(type, n, "admin keyall " + s.getName()));
            }
            case "shards", "money" -> currency(s, a, sub.equals("money") ? Ledger.MONEY : Ledger.SHARDS);
            case "booster" -> {
                Player t = a.length > 2 ? Bukkit.getPlayerExact(a[1]) : null;
                long min = a.length > 2 ? Money.parseWhole(a[2], 10_000) : -1;
                if (t == null || min <= 0) { msg().sendRaw(s, "&c/dc booster <player> <minutes>"); return; }
                t.getInventory().addItem(plugin.shards.boosterItem((int) min)).values().forEach(it -> plugin.mailbox.add(t.getUniqueId(), it, "admin"));
                msg().send(s, "admin.done");
            }
            case "tool" -> plugin.tools.adminGive(s, a);
            case "rank" -> {
                if (a.length < 4 || !a[1].equalsIgnoreCase("set")) { msg().sendRaw(s, "&c/dc rank set <player> <rank>"); return; }
                if (cfg("permissions.yml").getConfigurationSection("ranks." + a[3]) == null) { msg().send(s, "error.bad-args"); return; }
                plugin.ledger().findByName(a[2]).thenAccept(id -> plugin.runSync(() -> {
                    if (id == null) { msg().send(s, "error.unknown-player"); return; }
                    plugin.misc.setRank(id, a[3]);
                    msg().send(s, "admin.done");
                }));
            }
            case "duel" -> plugin.duels.adminArena(s, a);
            case "map" -> plugin.maps.command(s, a);
            case "border" -> plugin.region.borderCommand(s, a);
            case "leaderboard" -> { if (p != null && a.length > 1) { plugin.misc.addLeaderboard(p.getLocation().add(0, 2, 0), a[1].toLowerCase(Locale.ROOT)); msg().send(p, "admin.done"); } }
            case "hologram" -> { if (p != null && a.length > 1) { plugin.misc.hologram(p.getLocation().add(0, 2, 0), Arrays.asList(String.join(" ", Arrays.copyOfRange(a, 1, a.length)).split("\\|")), "static"); msg().send(p, "admin.done"); } }
            case "backup" -> {
                File dir = new File(plugin.getDataFolder(), "backups");
                dir.mkdirs();
                File f = new File(dir, "data-" + new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date()) + ".db");
                plugin.db().backup(f).whenComplete((v, err) -> plugin.runSync(() -> msg().sendRaw(s, err == null ? "&aBackup written: " + f.getName() : "&cBackup failed: " + err.getMessage())));
            }
            case "preset" -> {
                if (a.length < 2 || plugin.cfg("presets/" + a[1] + ".yml") == null) { msg().sendRaw(s, "&c/dc preset <classic-early|feb-2026|post-2026> &7(current: " + plugin.preset() + ")"); return; }
                plugin.cfg().set("preset", a[1]);
                plugin.saveCfg("config.yml");
                plugin.reload(null);
                msg().send(s, "admin.done");
            }
            default -> msg().list("admin.help").forEach(s::sendMessage);
        }
    }

    private List<String> mapFiles() {
        File[] fs = new File(plugin.getDataFolder(), "maps").listFiles((d, n) -> n.endsWith(".litematic"));
        return fs == null ? List.of() : Arrays.stream(fs).map(File::getName).toList();
    }

    private void bind(Player p, String path) {
        if (p == null) { msg().send(Bukkit.getConsoleSender(), "error.player-only"); return; }
        plugin.locs().set(path, p.getLocation());
        msg().send(p, "admin.set", "what", path);
    }

    private void bindBlock(Player p, String path) {
        if (p == null) return;
        Location l = p.getLocation().getBlock().getLocation();
        plugin.locs().set(path, l);
        msg().send(p, "admin.set", "what", path + " (" + l.getBlockX() + ", " + l.getBlockY() + ", " + l.getBlockZ() + ")");
    }

    private void currency(CommandSender s, String[] a, String cur) {
        // /dc money|shards give|take|set <player> <amount>
        if (a.length < 4) { msg().sendRaw(s, "&c/dc " + a[0] + " give|take|set <player> <amount>"); return; }
        long v = cur.equals(Ledger.MONEY) ? Money.parse(a[3]) : Money.parseWhole(a[3], Ledger.MAX_BALANCE);
        if (v < 0) { msg().send(s, "error.bad-args"); return; }
        plugin.ledger().findByName(a[2]).thenAccept(id -> plugin.runSync(() -> {
            if (id == null) { msg().send(s, "error.unknown-player"); return; }
            String reason = "admin " + s.getName();
            boolean ok = switch (a[1].toLowerCase(Locale.ROOT)) {
                case "give" -> plugin.ledger().deposit(id, cur, v, reason);
                case "take" -> plugin.ledger().withdraw(id, cur, v, reason);
                case "set" -> plugin.ledger().set(id, cur, v, reason);
                default -> false;
            };
            msg().send(s, ok ? "admin.done" : "admin.failed");
            plugin.getLogger().info("[audit] " + reason + " " + a[1] + " " + cur + " " + v + " " + a[2] + " ok=" + ok);
        }));
    }

    private void status(CommandSender s) {
        msg().sendRaw(s, "&bDonutClassic status");
        msg().sendRaw(s, "&7Preset: &f" + plugin.preset() + " &7| Locale: &f" + plugin.cfg().getString("locale", "en"));
        msg().sendRaw(s, "&7Spawners placed: &f" + plugin.spawners.count() + " &7| AH listings: &f" + plugin.auction.activeCount());
        msg().sendRaw(s, "&7Floodgate: &f" + (Platform.floodgatePresent() ? "detected" : "not installed") + " &7| Online: &f" + Bukkit.getOnlinePlayers().size());
        msg().sendRaw(s, "&7Keyall: &f" + (plugin.crates.keyAllEnabled() ? (plugin.crates.keyAllRemainingMs() / 1000) + "s left" : "disabled"));
        msg().sendRaw(s, "&7Modules: &f" + String.join(", ", plugin.modules().stream().map(Module::name).toList()));
    }

    private void wizard(CommandSender s) {
        msg().sendRaw(s, "&b&lSetup checklist &7(stand at the spot / look at the block, then run the command)");
        String[][] items = {{"spawn", "/dc setspawn"}, {"spawn-corner1", "/dc setspawncorner1"}, {"spawn-corner2", "/dc setspawncorner2"},
            {"afk", "/dc setafk"}, {"afk-corner1", "/dc setafkcorner1"}, {"afk-corner2", "/dc setafkcorner2"}, {"warps.crates", "/dc setwarp crates"}};
        for (String[] it : items) msg().sendRaw(s, (plugin.locs().get(it[0]) != null ? "&a[x] " : "&c[ ] ") + "&f" + it[0] + " &7- " + it[1]);
        int crates = plugin.cfg("warps.yml").getConfigurationSection("crate-blocks") == null ? 0 : plugin.cfg("warps.yml").getConfigurationSection("crate-blocks").getKeys(false).size();
        msg().sendRaw(s, (crates >= 5 ? "&a[x] " : "&c[ ] ") + "&fcrate blocks bound: " + crates + "/5 &7- /dc setcrate <type>");
        msg().sendRaw(s, (!plugin.locs().keys("duel-arenas").isEmpty() ? "&a[x] " : "&c[ ] ") + "&fduel arena &7- /dc duel setarena <name> 1|2");
        msg().sendRaw(s, "&7NPCs: /dc setnpc shop|shardshop|crates|rtp|duels|afk|ah|orders  Leaderboards: /dc leaderboard money");
    }
}
