package net.donutclassic.crates;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.*;
import net.donutclassic.menu.Menu;
import net.donutclassic.spawner.SpawnerType;
import net.donutclassic.util.Items;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.scheduler.BukkitTask;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/**
 * Five classic crates with VIRTUAL keys (ledger currencies key_<type>). Opening consumes one key,
 * shows N (default 7) candidate rewards, the player picks one. Closing without a choice refunds the key
 * (configurable); a crash mid-choice is refunded on next join via a persisted "pending" marker.
 */
public final class CrateModule extends Module {
    public static final List<String> TYPES = List.of("common", "prime", "gold", "amethyst", "crimson");
    private final Random rnd = new Random();
    private final Set<UUID> opening = new HashSet<>();
    private long lastKeyAll;
    private BukkitTask keyAllTask;

    public CrateModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "crates"; }
    private YamlConfiguration y() { return cfg("crate-rewards.yml"); }

    @Override public void enable() {
        plugin.db().query(c -> {
            try (ResultSet rs = c.createStatement().executeQuery("SELECT v FROM meta WHERE k='keyall_last'")) { return rs.next() ? Long.parseLong(rs.getString(1)) : 0L; }
        }).thenAccept(v -> plugin.runSync(() -> lastKeyAll = v));
        command("crates", (s, a) -> { Player p = player(s); if (p != null) openList(p); }, (s, a) -> List.of());
        command("keys", (s, a) -> { Player p = player(s); if (p != null) showKeys(p); }, (s, a) -> List.of());
        reload();
    }

    @Override public void reload() {
        if (keyAllTask != null) keyAllTask.cancel();
        keyAllTask = Bukkit.getScheduler().runTaskTimer(plugin, this::keyAllCheck, 20L * 30, 20L * 30);
    }

    @Override public void disable() { if (keyAllTask != null) keyAllTask.cancel(); }

    // ------------------------------------------------------------------ keyall
    public long keyAllIntervalMs() { return Math.max(1, y().getLong("keyall.interval-minutes", 60)) * 60_000L; }
    public long keyAllRemainingMs() { return lastKeyAll <= 0 ? 0 : Math.max(0, keyAllIntervalMs() - (System.currentTimeMillis() - lastKeyAll)); }
    public boolean keyAllEnabled() {
        return plugin.presetCfg().getBoolean("keyall.enabled", y().getBoolean("keyall.enabled", true));
    }

    private void keyAllCheck() {
        if (!keyAllEnabled() || Bukkit.getOnlinePlayers().isEmpty()) return;
        long now = System.currentTimeMillis();
        if (lastKeyAll == 0) { setLastKeyAll(now); return; } // first start: begin the clock, don't fire instantly
        if (!Rules.keyAllDue(lastKeyAll, now, keyAllIntervalMs())) return;
        keyAll(y().getString("keyall.key", "common"), y().getInt("keyall.amount", 1), "hourly keyall");
        setLastKeyAll(now);
    }

    private void setLastKeyAll(long now) {
        lastKeyAll = now;
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO meta(k,v) VALUES('keyall_last',?)", String.valueOf(now)); return null; });
    }

    public int keyAll(String type, int amount, String reason) {
        int n = 0;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (plugin.ledger().deposit(p.getUniqueId(), Ledger.key(type), amount, reason)) n++;
        }
        Bukkit.broadcastMessage(Msg.color(msg().raw("prefix") + Msg.fill(msg().raw("crates.keyall"), "amount", amount, "type", cap(type))));
        return n;
    }

    // ------------------------------------------------------------------ menus
    private void showKeys(Player p) {
        StringBuilder sb = new StringBuilder("&6Keys: ");
        for (String t : TYPES) sb.append("&f").append(cap(t)).append(" &e").append(plugin.ledger().get(p.getUniqueId(), Ledger.key(t))).append("  ");
        msg().sendRaw(p, sb.toString());
    }

    public void openList(Player p) {
        Menu m = new Menu(3, y().getString("menu-title", "&8Crates"));
        int[] slots = {11, 12, 13, 14, 15};
        int i = 0;
        for (String t : TYPES) {
            ConfigurationSection c = y().getConfigurationSection("crates." + t);
            if (c == null || !c.getBoolean("enabled", true)) { i++; continue; }
            long keys = plugin.ledger().get(p.getUniqueId(), Ledger.key(t));
            Material icon = Material.matchMaterial(c.getString("icon", "CHEST"));
            m.set(slots[i++], Items.make(icon == null ? Material.CHEST : icon, 1, c.getString("display", cap(t) + " Crate"),
                List.of("&7Your keys: &e" + keys, "", "&eClick to open", "&7(Preview below)")), e -> open(p, t));
            m.set(slots[i - 1] + 9, Items.make(Material.SPYGLASS, "&7Preview " + cap(t)), e -> preview(p, t));
        }
        m.open(p);
    }

    public void preview(Player p, String type) {
        List<Reward> rewards = rewards(type);
        Menu m = new Menu(6, "&8Preview: " + cap(type));
        int s = 0;
        double total = rewards.stream().mapToDouble(Reward::weight).sum();
        for (Reward r : rewards) {
            if (s >= 45) break;
            ItemStack icon = r.icon(this);
            ItemMeta meta = icon.getItemMeta();
            List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
            lore.add(Msg.color(String.format(Locale.ROOT, "&7Chance per candidate: &f%.1f%%", total <= 0 ? 0 : r.weight() / total * 100)));
            meta.setLore(lore); icon.setItemMeta(meta);
            m.set(s++, icon);
        }
        m.set(49, Items.make(Material.OAK_DOOR, "&cBack"), e -> openList(p));
        m.open(p);
    }

    public void open(Player p, String type) {
        if (!TYPES.contains(type)) return;
        if (opening.contains(p.getUniqueId())) return;
        List<Reward> pool = rewards(type);
        if (pool.isEmpty()) { msg().send(p, "crates.empty"); return; }
        if (!plugin.ledger().withdraw(p.getUniqueId(), Ledger.key(type), 1, "open " + type)) { msg().send(p, "crates.no-key", "type", cap(type)); return; }
        opening.add(p.getUniqueId());
        setPending(p.getUniqueId(), type);
        int n = Math.max(1, Math.min(9, y().getInt("candidates-shown", 7)));
        List<Rules.Weighted<Reward>> w = new ArrayList<>();
        for (Reward r : pool) w.add(new Rules.Weighted<>(r, r.weight()));
        List<Reward> picks = Rules.rollCandidates(w, n, rnd);
        boolean[] resolved = {false};
        Menu m = new Menu(3, "&8" + cap(type) + " - choose 1 reward");
        int start = 13 - picks.size() / 2;
        for (int i = 0; i < picks.size(); i++) {
            Reward r = picks.get(i);
            m.set(start + i, r.icon(this), e -> {
                if (resolved[0]) return;
                resolved[0] = true;
                opening.remove(p.getUniqueId());
                clearPending(p.getUniqueId());
                r.give(this, p);
                msg().send(p, "crates.won", "reward", r.label(), "type", cap(type));
                plugin.getLogger().info("[crate] " + p.getName() + " opened " + type + " -> " + r.label());
                p.closeInventory();
            });
        }
        m.onClose(() -> {
            if (resolved[0]) return;
            resolved[0] = true;
            opening.remove(p.getUniqueId());
            clearPending(p.getUniqueId());
            if ("random".equalsIgnoreCase(y().getString("on-close-without-choice", "refund")) && p.isOnline()) {
                Reward r = picks.get(rnd.nextInt(picks.size()));
                r.give(this, p);
                msg().send(p, "crates.won", "reward", r.label(), "type", cap(type));
            } else {
                plugin.ledger().deposit(p.getUniqueId(), Ledger.key(type), 1, "refund " + type);
                if (p.isOnline()) msg().send(p, "crates.refunded", "type", cap(type));
            }
        });
        m.open(p);
    }

    private void setPending(UUID id, String type) {
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO settings(uuid,k,v) VALUES(?, 'pending_crate', ?)", id.toString(), type); return null; });
    }

    private void clearPending(UUID id) {
        plugin.db().query(c -> { Database.exec(c, "DELETE FROM settings WHERE uuid=? AND k='pending_crate'", id.toString()); return null; });
    }

    /** Crash recovery: a crate left open when the server stopped is refunded. */
    @Override public void onDataLoaded(Player p) {
        if (opening.contains(p.getUniqueId())) return;
        plugin.db().tx(c -> {
            String type = null;
            try (PreparedStatement ps = c.prepareStatement("SELECT v FROM settings WHERE uuid=? AND k='pending_crate'")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) { if (rs.next()) type = rs.getString(1); }
            }
            if (type != null) Database.exec(c, "DELETE FROM settings WHERE uuid=? AND k='pending_crate'", p.getUniqueId().toString());
            return type;
        }).thenAccept(type -> plugin.runSync(() -> {
            if (type == null) return;
            plugin.ledger().deposit(p.getUniqueId(), Ledger.key(type), 1, "crash refund " + type);
            msg().send(p, "crates.refunded", "type", cap(type));
        }));
    }

    // ------------------------------------------------------------------ world crate blocks
    public String crateAt(Block b) { return cfg("warps.yml").getString("crate-blocks." + Locs.blockKey(b).replace('.', '_')); }

    public void bind(Block b, String type) {
        cfg("warps.yml").set("crate-blocks." + Locs.blockKey(b).replace('.', '_'), type);
        plugin.saveCfg("warps.yml");
    }

    public boolean unbind(Block b) {
        String k = "crate-blocks." + Locs.blockKey(b).replace('.', '_');
        if (cfg("warps.yml").get(k) == null) return false;
        cfg("warps.yml").set(k, null);
        plugin.saveCfg("warps.yml");
        return true;
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onClick(PlayerInteractEvent e) {
        if (e.getClickedBlock() == null || e.getHand() != EquipmentSlot.HAND) return;
        String type = crateAt(e.getClickedBlock());
        if (type == null) return;
        e.setCancelled(true);
        if (e.getAction() == Action.LEFT_CLICK_BLOCK) preview(e.getPlayer(), type);
        else if (e.getAction() == Action.RIGHT_CLICK_BLOCK) open(e.getPlayer(), type);
    }

    // ------------------------------------------------------------------ rewards
    record Reward(String kind, String value, int amount, double weight, String name, List<String> lore, Map<String, Integer> enchants) {
        String label() { return name != null ? Msg.strip(name) : amount + "x " + ShardLabel.of(kind, value); }

        ItemStack icon(CrateModule mod) {
            ItemStack it = switch (kind) {
                case "spawner" -> { SpawnerType t = mod.plugin.spawners.type(value); yield t == null ? new ItemStack(Material.BARRIER) : mod.plugin.spawners.item(t, Math.min(64, amount)); }
                case "money" -> Items.make(Material.GOLD_INGOT, "&a" + Money.format(Money.parse(value)));
                case "shards" -> Items.make(Material.AMETHYST_SHARD, "&d" + value + " Shards");
                case "key" -> Items.make(Material.TRIPWIRE_HOOK, amount, "&e" + amount + "x " + cap(value) + " Key", List.of());
                case "booster" -> mod.plugin.shards.boosterItem(Integer.parseInt(value));
                case "tool" -> { ItemStack t = mod.plugin.tools.item(value); yield t == null ? new ItemStack(Material.BARRIER) : t; }
                default -> item();
            };
            return it;
        }

        ItemStack item() {
            Material m = Items.material(value);
            ItemStack it = Items.make(m == null ? Material.BARRIER : m, amount, name, lore.isEmpty() ? null : lore);
            ItemMeta meta = it.getItemMeta();
            for (var e : enchants.entrySet()) {
                Enchantment en = Items.enchant(e.getKey());
                if (en != null) meta.addEnchant(en, e.getValue(), true);
            }
            it.setItemMeta(meta);
            return it;
        }

        void give(CrateModule mod, Player p) {
            UUID id = p.getUniqueId();
            switch (kind) {
                case "spawner" -> { SpawnerType t = mod.plugin.spawners.type(value); if (t != null) mod.plugin.spawners.give(p, t, amount, "crate"); }
                case "money" -> mod.plugin.ledger().deposit(id, Ledger.MONEY, Money.mul(Money.parse(value), Math.max(1, amount)), "crate reward");
                case "shards" -> mod.plugin.ledger().deposit(id, Ledger.SHARDS, Money.parseWhole(value, Ledger.MAX_BALANCE) * Math.max(1, amount), "crate reward");
                case "key" -> mod.plugin.ledger().deposit(id, Ledger.key(value), amount, "crate reward");
                default -> {
                    ItemStack it = icon(mod);
                    List<ItemStack> list = kind.equals("item") ? Items.stacks(it, amount) : Collections.nCopies(Math.max(1, amount), it);
                    List<ItemStack> left = Items.give(p, list);
                    if (!left.isEmpty()) mod.plugin.mailbox.addAll(id, left, "crate reward");
                }
            }
        }
    }

    /** Small helper for reward labels. */
    static final class ShardLabel { static String of(String kind, String value) { return kind.equals("item") ? value.toLowerCase(Locale.ROOT).replace('_', ' ') : kind + " " + value; } }

    List<Reward> rewards(String type) {
        List<Reward> out = new ArrayList<>();
        for (Map<?, ?> m : y().getMapList("crates." + type + ".rewards")) {
            String kind = "item", value;
            if (m.get("spawner") != null) { kind = "spawner"; value = String.valueOf(m.get("spawner")); }
            else if (m.get("money") != null) { kind = "money"; value = String.valueOf(m.get("money")); }
            else if (m.get("shards") != null) { kind = "shards"; value = String.valueOf(m.get("shards")); }
            else if (m.get("key") != null) { kind = "key"; value = String.valueOf(m.get("key")); }
            else if (m.get("booster") != null) { kind = "booster"; value = String.valueOf(m.get("booster")); }
            else if (m.get("tool") != null) { kind = "tool"; value = String.valueOf(m.get("tool")); }
            else value = String.valueOf(m.get("item"));
            int amount = m.get("amount") instanceof Number n ? n.intValue() : 1;
            double weight = m.get("weight") instanceof Number n ? n.doubleValue() : 1;
            String name = m.get("name") == null ? null : String.valueOf(m.get("name"));
            List<String> lore = new ArrayList<>();
            if (m.get("lore") instanceof List<?> l) for (Object o : l) lore.add(String.valueOf(o));
            Map<String, Integer> ench = new LinkedHashMap<>();
            if (m.get("enchants") instanceof Map<?, ?> em) for (var e : em.entrySet()) ench.put(String.valueOf(e.getKey()), e.getValue() instanceof Number n ? n.intValue() : 1);
            if (amount <= 0 || amount > 10_000 || weight < 0) continue;
            out.add(new Reward(kind, value, amount, weight, name, lore, ench));
        }
        return out;
    }

    // ------------------------------------------------------------------ admin
    public void adminKey(CommandSender s, String[] a) {
        // /dc key give|take <player> <type> <amount>
        if (a.length < 5) { msg().sendRaw(s, "&c/dc key give|take <player> <type> <amount>"); return; }
        String type = a[3].toLowerCase(Locale.ROOT);
        long n = Money.parseWhole(a[4], 1_000_000);
        if (!TYPES.contains(type) || n <= 0) { msg().send(s, "error.bad-args"); return; }
        plugin.ledger().findByName(a[2]).thenAccept(id -> plugin.runSync(() -> {
            if (id == null) { msg().send(s, "error.unknown-player"); return; }
            boolean ok = a[1].equalsIgnoreCase("give") ? plugin.ledger().deposit(id, Ledger.key(type), n, "admin " + s.getName())
                : plugin.ledger().withdraw(id, Ledger.key(type), n, "admin " + s.getName());
            msg().send(s, ok ? "admin.done" : "admin.failed");
        }));
    }

    static String cap(String s) { return s == null || s.isEmpty() ? "" : Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT); }
}
