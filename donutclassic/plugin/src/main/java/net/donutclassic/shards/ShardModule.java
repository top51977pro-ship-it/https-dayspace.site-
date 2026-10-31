package net.donutclassic.shards;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.core.Rules;
import net.donutclassic.menu.Menu;
import net.donutclassic.spawner.SpawnerType;
import net.donutclassic.util.Items;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/** Shards currency, historic AFK zone (1 shard / complete minute), PvP kill reward, AFK booster, shard shop. */
public final class ShardModule extends Module {
    private Rules.AfkTracker afk;
    private Rules.KillGuard killGuard;
    private BukkitTask task;
    private final Map<UUID, Long> boosterUntil = new HashMap<>();

    public ShardModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "shards"; }
    private YamlConfiguration y() { return cfg("shards.yml"); }

    @Override public void enable() {
        reload();
        command("shards", (s, a) -> {
            if (a.length == 0) { Player p = player(s); if (p != null) msg().send(p, "shards.balance", "shards", Money.formatWhole(plugin.ledger().get(p.getUniqueId(), Ledger.SHARDS))); return; }
            plugin.ledger().findByName(a[0]).thenAccept(id -> plugin.runSync(() -> {
                if (id == null) { msg().send(s, "error.unknown-player"); return; }
                plugin.ledger().getAny(id, Ledger.SHARDS).thenAccept(v -> plugin.runSync(() -> msg().send(s, "shards.balance-other", "player", a[0], "shards", Money.formatWhole(v))));
            }));
        });
        command("shardshop", (s, a) -> { Player p = player(s); if (p != null) openShop(p); }, (s, a) -> List.of());
    }

    @Override public void reload() {
        afk = new Rules.AfkTracker(y().getInt("afk.seconds-per-reward", 60));
        killGuard = new Rules.KillGuard(y().getLong("kill-reward.same-victim-cooldown-seconds", 600) * 1000L);
        if (task != null) task.cancel();
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::afkTick, 20L, 20L);
    }

    @Override public void disable() { if (task != null) task.cancel(); }

    // ------------------------------------------------------------- AFK
    public Locs.Cuboid afkRegion() { return plugin.locs().cuboid("afk-corner1", "afk-corner2"); }

    private void afkTick() {
        Locs.Cuboid region = afkRegion();
        int perIp = y().getInt("afk.max-rewarded-accounts-per-ip", 0);
        Map<String, Integer> ipCount = new HashMap<>();
        for (Player p : Bukkit.getOnlinePlayers()) {
            boolean in = region != null && region.contains(p.getLocation()) && p.getGameMode() != GameMode.SPECTATOR;
            if (in && perIp > 0 && p.getAddress() != null) {
                String ip = p.getAddress().getAddress().getHostAddress();
                int n = ipCount.merge(ip, 1, Integer::sum);
                if (n > perIp) { if (afk.progress(p.getUniqueId()) == 0) msg().actionBar(p, msg().raw("afk.ip-limit")); in = false; }
            }
            int due = afk.tick(p.getUniqueId(), in);
            if (in) {
                int left = afk.secondsPerReward() - afk.progress(p.getUniqueId());
                msg().actionBar(p, msg().raw("afk.progress").replace("{seconds}", String.valueOf(due > 0 ? afk.secondsPerReward() : left)));
            }
            if (due > 0) {
                long amount = (long) y().getInt("afk.shards-per-reward", 1) * due;
                if (boosted(p.getUniqueId())) amount *= Math.max(1, y().getInt("booster.multiplier", 4));
                if (plugin.ledger().deposit(p.getUniqueId(), Ledger.SHARDS, amount, "afk"))
                    msg().send(p, "afk.reward", "amount", amount);
            }
        }
    }

    // ------------------------------------------------------------- booster
    public boolean boosted(UUID id) { Long t = boosterUntil.get(id); return t != null && t > System.currentTimeMillis(); }
    public long boosterRemainingMs(UUID id) { Long t = boosterUntil.get(id); return t == null ? 0 : Math.max(0, t - System.currentTimeMillis()); }

    public void addBooster(UUID id, long minutes) {
        long now = System.currentTimeMillis();
        long until = Math.max(now, boosterUntil.getOrDefault(id, 0L)) + minutes * 60_000L;
        boosterUntil.put(id, until);
        plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO settings(uuid,k,v) VALUES(?,?,?)", id.toString(), "booster_until", String.valueOf(until)); return null; });
    }

    public ItemStack boosterItem(int minutes) {
        ItemStack it = Items.make(Material.AMETHYST_SHARD, 1, "&d&lAFK Booster &7(" + minutes + "m)",
            List.of("&7Right-click to activate.", "&7AFK shard rewards x" + y().getInt("booster.multiplier", 4), "&7for " + minutes + " minutes."));
        Items.glow(it);
        return Items.setTag(it, Items.BOOSTER, String.valueOf(minutes));
    }

    @Override public void onDataLoaded(Player p) {
        plugin.db().query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT v FROM settings WHERE uuid=? AND k='booster_until'")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? Long.parseLong(rs.getString(1)) : 0L; }
            }
        }).thenAccept(v -> plugin.runSync(() -> { if (v > System.currentTimeMillis()) boosterUntil.put(p.getUniqueId(), v); }));
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) { afk.remove(e.getPlayer().getUniqueId()); boosterUntil.remove(e.getPlayer().getUniqueId()); }

    @EventHandler(priority = EventPriority.HIGH)
    public void onUseBooster(PlayerInteractEvent e) {
        if (e.getHand() != EquipmentSlot.HAND || (e.getAction() != Action.RIGHT_CLICK_AIR && e.getAction() != Action.RIGHT_CLICK_BLOCK)) return;
        ItemStack it = e.getItem();
        String tag = Items.tag(it, Items.BOOSTER);
        if (tag == null) return;
        e.setCancelled(true);
        int minutes;
        try { minutes = Integer.parseInt(tag); } catch (NumberFormatException ex) { return; }
        it.setAmount(it.getAmount() - 1);
        addBooster(e.getPlayer().getUniqueId(), minutes);
        msg().send(e.getPlayer(), "shards.booster-on", "minutes", minutes);
    }

    // ------------------------------------------------------------- kill rewards
    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent e) {
        Player victim = e.getEntity();
        Player killer = victim.getKiller();
        if (killer == null || !y().getBoolean("kill-reward.enabled", true)) return;
        if (killer.getGameMode() == GameMode.CREATIVE || killer.getGameMode() == GameMode.SPECTATOR || killer.getAllowFlight() && !killer.hasPermission("dc.admin")) return;
        if (plugin.duels.inDuel(victim.getUniqueId())) return; // duels have their own stats
        String kip = killer.getAddress() == null ? null : killer.getAddress().getAddress().getHostAddress();
        String vip = victim.getAddress() == null ? null : victim.getAddress().getAddress().getHostAddress();
        if (!killGuard.allow(killer.getUniqueId(), victim.getUniqueId(), kip, vip, y().getBoolean("kill-reward.block-same-ip", true), System.currentTimeMillis())) return;
        long amount = y().getLong("kill-reward.shards", 10);
        if (plugin.ledger().deposit(killer.getUniqueId(), Ledger.SHARDS, amount, "kill " + victim.getName()))
            msg().send(killer, "shards.kill-reward", "amount", amount, "player", victim.getName());
    }

    // ------------------------------------------------------------- shop
    /** Entries come from the active preset (presets/<preset>.yml -> shardshop) falling back to shards.yml. */
    private ConfigurationSection shopSection() {
        ConfigurationSection s = plugin.presetCfg() == null ? null : plugin.presetCfg().getConfigurationSection("shardshop");
        return s != null ? s : y().getConfigurationSection("shardshop");
    }

    public void openShop(Player p) {
        Menu m = new Menu(6, y().getString("shop-title", "&5Shard Shop"));
        ConfigurationSection s = shopSection();
        int slot = 10;
        if (s != null) for (String key : s.getKeys(false)) {
            ConfigurationSection e = s.getConfigurationSection(key);
            if (e == null || !e.getBoolean("enabled", true)) continue;
            long price = e.getLong("price");
            if (price <= 0) continue;
            String type = e.getString("type", "item");
            ItemStack icon;
            String what = e.getString("value", "");
            switch (type) {
                case "spawner" -> { SpawnerType t = plugin.spawners.type(what); if (t == null || !t.enabled()) continue; icon = plugin.spawners.item(t, 1); }
                case "key" -> icon = Items.make(Material.TRIPWIRE_HOOK, "&e" + cap(what) + " Key", "&7Virtual crate key");
                case "booster" -> icon = boosterItem(e.getInt("minutes", 60));
                case "tool" -> { icon = plugin.tools.item(what); if (icon == null) continue; }
                default -> { continue; }
            }
            int amount = Math.max(1, e.getInt("amount", 1));
            var meta = icon.getItemMeta();
            List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
            lore.add(""); lore.add(net.donutclassic.util.Msg.color("&7Amount: &f" + amount));
            lore.add(net.donutclassic.util.Msg.color("&7Price: &d" + Money.formatWhole(price) + " Shards"));
            lore.add(net.donutclassic.util.Msg.color("&eClick to buy"));
            meta.setLore(lore); icon.setItemMeta(meta);
            int sl = e.getInt("slot", slot);
            if (sl == slot) slot += (slot % 9 == 7) ? 3 : 1;
            final String fType = type, fWhat = what; final int fMin = e.getInt("minutes", 60);
            m.set(sl, icon, ev -> buy(p, fType, fWhat, amount, price, fMin));
        }
        m.set(49, Items.make(Material.AMETHYST_SHARD, "&dYour Shards: &f" + Money.formatWhole(plugin.ledger().get(p.getUniqueId(), Ledger.SHARDS))));
        m.open(p);
    }

    private void buy(Player p, String type, String what, int amount, long price, int minutes) {
        if (!plugin.ledger().withdraw(p.getUniqueId(), Ledger.SHARDS, price, "shardshop " + type + ":" + what)) { msg().send(p, "shards.not-enough"); return; }
        switch (type) {
            case "spawner" -> plugin.spawners.give(p, plugin.spawners.type(what), amount, "shard shop");
            case "key" -> plugin.ledger().deposit(p.getUniqueId(), Ledger.key(what), amount, "shardshop");
            case "booster" -> giveItem(p, boosterItem(minutes), amount);
            case "tool" -> giveItem(p, plugin.tools.item(what), amount);
            default -> { }
        }
        msg().send(p, "shards.bought", "item", cap(what), "amount", amount, "price", Money.formatWhole(price));
        p.closeInventory();
    }

    private void giveItem(Player p, ItemStack it, int amount) {
        List<ItemStack> l = new ArrayList<>();
        for (int i = 0; i < amount; i++) l.add(it.clone());
        List<ItemStack> left = Items.give(p, l);
        if (!left.isEmpty()) plugin.mailbox.addAll(p.getUniqueId(), left, "shard shop");
    }

    static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT).replace('_', ' '); }
}
