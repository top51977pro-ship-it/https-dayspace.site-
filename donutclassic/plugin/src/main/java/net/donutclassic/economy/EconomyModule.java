package net.donutclassic.economy;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/** /bal /baltop /pay /shop /sell /sellall /sellhistory, prices, sell multipliers. */
public final class EconomyModule extends Module {
    private final Map<Material, Long> sell = new EnumMap<>(Material.class);
    private final Map<UUID, Long> payCooldown = new HashMap<>();

    public EconomyModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "economy"; }

    @Override public void enable() {
        reload();
        command("balance", this::bal);
        command("baltop", (s, a) -> top(s, Ledger.MONEY, "Money"));
        command("pay", this::pay);
        command("shop", (s, a) -> { Player p = player(s); if (p != null) openShop(p); }, (s, a) -> List.of());
        command("sell", (s, a) -> { Player p = player(s); if (p != null) openSell(p); }, (s, a) -> List.of());
        command("sellall", (s, a) -> { Player p = player(s); if (p != null) sellAll(p); }, (s, a) -> List.of());
        command("sellhistory", (s, a) -> { Player p = player(s); if (p != null) history(p); }, (s, a) -> List.of());
        command("worth", (s, a) -> {
            Player p = player(s); if (p == null) return;
            ItemStack h = p.getInventory().getItemInMainHand();
            long price = Items.isPlain(h) ? sellPrice(h.getType()) : 0;
            msg().send(p, "economy.worth", "item", Items.pretty(h.getType()), "price", Money.format(price),
                "total", Money.format(Money.applyMultiplier(Money.mul(price, h.getAmount()), multiplier(p))));
        }, (s, a) -> List.of());
    }

    @Override public void reload() {
        sell.clear();
        ConfigurationSection s = cfg("prices.yml").getConfigurationSection("sell");
        if (s != null) for (String k : s.getKeys(false)) {
            Material m = Material.matchMaterial(k);
            long v = Money.parse(s.getString(k));
            if (m != null && v > 0) sell.put(m, v);
        }
    }

    public long sellPrice(Material m) { return m == null ? 0 : sell.getOrDefault(m, 0L); }

    /** Highest configured multiplier tier the player has permission for (economy.yml). */
    public double multiplier(Player p) {
        ConfigurationSection t = cfg("economy.yml").getConfigurationSection("sell-multipliers.tiers");
        double best = cfg("economy.yml").getDouble("sell-multipliers.default", 1.0);
        if (t != null) for (String k : t.getKeys(false)) if (p.hasPermission("dc.sellmulti." + k)) best = Math.max(best, t.getDouble(k));
        double global = cfg("economy.yml").getDouble("sell-multipliers.global", 1.0);
        return Math.max(0, Math.min(100, best * global));
    }

    public void logSale(UUID id, String material, long amount, long total, String source) {
        plugin.db().query(c -> { Database.exec(c, "INSERT INTO sell_log(ts,uuid,material,amount,total,source) VALUES(?,?,?,?,?,?)",
            System.currentTimeMillis(), id.toString(), material, amount, total, source); return null; });
    }

    // ---------------------------------------------------------------- balance / pay / top
    private void bal(CommandSender s, String[] a) {
        if (a.length == 0) {
            Player p = player(s); if (p == null) return;
            msg().send(p, "economy.balance", "money", Money.format(plugin.ledger().get(p.getUniqueId(), Ledger.MONEY)),
                "shards", Money.formatWhole(plugin.ledger().get(p.getUniqueId(), Ledger.SHARDS)));
            return;
        }
        plugin.ledger().findByName(a[0]).thenAccept(id -> plugin.runSync(() -> {
            if (id == null) { msg().send(s, "error.unknown-player"); return; }
            plugin.ledger().getAny(id, Ledger.MONEY).thenAccept(v -> plugin.runSync(() ->
                msg().send(s, "economy.balance-other", "player", a[0], "money", Money.format(v))));
        }));
    }

    public void top(CommandSender s, String currency, String label) {
        plugin.ledger().top(currency, 10).thenAccept(list -> plugin.runSync(() -> {
            msg().sendRaw(s, "&6&l" + label + " Top");
            int i = 1;
            for (var e : list) msg().sendRaw(s, "&e" + (i++) + ". &f" + e.name() + " &7- &a" +
                (currency.equals(Ledger.MONEY) ? Money.format(e.amount()) : Money.formatWhole(e.amount())));
        }));
    }

    private void pay(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (a.length < 2) { msg().sendRaw(p, "&c/pay <player> <amount>"); return; }
        long amount = Money.parse(a[1]);
        long min = Money.parse(cfg("economy.yml").getString("pay.minimum", "1"));
        if (amount <= 0 || amount < min) { msg().send(p, "economy.invalid-amount"); return; }
        long now = System.currentTimeMillis();
        Long last = payCooldown.get(p.getUniqueId());
        if (last != null && now - last < 1000) return;
        payCooldown.put(p.getUniqueId(), now);
        plugin.ledger().findByName(a[0]).thenAccept(id -> plugin.runSync(() -> {
            if (id == null) { msg().send(p, "error.unknown-player"); return; }
            if (id.equals(p.getUniqueId())) { msg().send(p, "economy.pay-self"); return; }
            if (plugin.misc != null && !plugin.misc.setting(id, "pay", true)) { msg().send(p, "economy.pay-disabled"); return; }
            if (!plugin.ledger().transfer(p.getUniqueId(), id, Ledger.MONEY, amount, "pay " + p.getName() + "->" + a[0])) {
                msg().send(p, "economy.not-enough"); return;
            }
            msg().send(p, "economy.paid", "player", a[0], "money", Money.format(amount));
            Player t = Bukkit.getPlayer(id);
            if (t != null) msg().send(t, "economy.received", "player", p.getName(), "money", Money.format(amount));
        }));
    }

    // ---------------------------------------------------------------- shop
    public void openShop(Player p) {
        ConfigurationSection cats = cfg("shop.yml").getConfigurationSection("categories");
        Menu m = new Menu(3, cfg("shop.yml").getString("title", "&8Shop"));
        if (cats != null) {
            int slot = 10;
            for (String key : cats.getKeys(false)) {
                ConfigurationSection c = cats.getConfigurationSection(key);
                Material icon = Material.matchMaterial(c.getString("icon", "CHEST"));
                int sl = c.getInt("slot", slot++);
                m.set(sl, Items.make(icon == null ? Material.CHEST : icon, c.getString("name", key), "&7Click to browse"),
                    e -> openCategory(p, key, 0));
            }
        }
        m.open(p);
    }

    private void openCategory(Player p, String key, int page) {
        ConfigurationSection c = cfg("shop.yml").getConfigurationSection("categories." + key);
        if (c == null) return;
        List<Map<?, ?>> items = c.getMapList("items");
        Menu m = new Menu(6, c.getString("name", key));
        int per = 45, start = page * per;
        for (int i = start; i < Math.min(items.size(), start + per); i++) {
            Map<?, ?> it = items.get(i);
            Material mat = Items.material(String.valueOf(it.get("material")));
            long buy = Money.parse(String.valueOf(it.get("buy")));
            if (mat == null || buy <= 0) continue;
            long sellP = sellPrice(mat);
            m.set(i - start, Items.make(mat, 1, "&f" + Items.pretty(mat), List.of("&7Buy: &a" + Money.format(buy) + " each",
                sellP > 0 ? "&7Sell: &6" + Money.format(sellP) + " each" : "&8Not sellable", "", "&eClick for options")),
                e -> openItem(p, key, page, mat, buy));
        }
        if (page > 0) m.set(45, Items.make(Material.ARROW, "&ePrevious"), e -> openCategory(p, key, page - 1));
        m.set(49, Items.make(Material.OAK_DOOR, "&cBack"), e -> openShop(p));
        if (items.size() > start + per) m.set(53, Items.make(Material.ARROW, "&eNext"), e -> openCategory(p, key, page + 1));
        m.open(p);
    }

    /** Buttons instead of shift/right-click so the same flow works with Bedrock touch controls. */
    private void openItem(Player p, String cat, int page, Material mat, long price) {
        Menu m = new Menu(3, "&8" + Items.pretty(mat));
        int[] amounts = {1, 8, 16, 32, 64};
        for (int i = 0; i < amounts.length; i++) {
            int n = Math.min(amounts[i], mat.getMaxStackSize() * 36);
            long cost = Money.mul(price, n);
            m.set(i + 2, Items.make(Material.LIME_STAINED_GLASS_PANE, n, "&aBuy " + n, List.of("&7Cost: &f" + Money.format(cost))),
                e -> buy(p, mat, price, n));
        }
        long sp = sellPrice(mat);
        if (sp > 0) {
            m.set(20, Items.make(Material.ORANGE_STAINED_GLASS_PANE, "&6Sell 1"), e -> sellMaterial(p, mat, 1));
            m.set(21, Items.make(Material.ORANGE_STAINED_GLASS_PANE, 64, "&6Sell 64", List.of()), e -> sellMaterial(p, mat, 64));
            m.set(22, Items.make(Material.GOLD_BLOCK, "&6Sell all " + Items.pretty(mat)), e -> sellMaterial(p, mat, Integer.MAX_VALUE));
        }
        m.set(13, Items.make(mat, "&f" + Items.pretty(mat), "&7Buy: &a" + Money.format(price), "&7Sell: &6" + Money.format(sp)));
        m.set(26, Items.make(Material.OAK_DOOR, "&cBack"), e -> openCategory(p, cat, page));
        m.open(p);
    }

    private void buy(Player p, Material mat, long price, int n) {
        long cost = Money.mul(price, n);
        if (cost < 0) return;
        if (!hasRoom(p, mat, n)) { msg().send(p, "economy.inventory-full"); return; }
        if (!plugin.ledger().withdraw(p.getUniqueId(), Ledger.MONEY, cost, "shop buy " + n + " " + mat)) { msg().send(p, "economy.not-enough"); return; }
        List<ItemStack> left = Items.give(p, Items.stacks(mat, n));
        if (!left.isEmpty()) plugin.mailbox.addAll(p.getUniqueId(), left, "shop overflow");
        msg().send(p, "economy.bought", "amount", n, "item", Items.pretty(mat), "money", Money.format(cost));
    }

    private static boolean hasRoom(Player p, Material m, int n) {
        int room = 0;
        for (ItemStack it : p.getInventory().getStorageContents()) {
            if (it == null || it.getType().isAir()) room += m.getMaxStackSize();
            else if (it.getType() == m && Items.isPlain(it)) room += m.getMaxStackSize() - it.getAmount();
            if (room >= n) return true;
        }
        return false;
    }

    private void sellMaterial(Player p, Material mat, int max) {
        long price = sellPrice(mat);
        if (price <= 0) return;
        int have = Items.countPlain(p, mat);
        int n = Math.min(have, max);
        if (n <= 0) { msg().send(p, "economy.nothing-to-sell"); return; }
        int removed = Items.removePlain(p, mat, n);
        payout(p, Map.of(mat, (long) removed), "shop");
    }

    /** Pays for already-removed items. Returns paid cents. */
    private long payout(Player p, Map<Material, Long> sold, String source) {
        long total = 0, count = 0;
        for (var e : sold.entrySet()) {
            long v = Money.mul(sellPrice(e.getKey()), e.getValue());
            if (v < 0) continue;
            total = Math.min(Ledger.MAX_BALANCE, total + v); count += e.getValue();
        }
        double mult = multiplier(p);
        long pay = Money.applyMultiplier(total, mult);
        plugin.ledger().deposit(p.getUniqueId(), Ledger.MONEY, pay, "sell (" + source + ")");
        for (var e : sold.entrySet()) logSale(p.getUniqueId(), e.getKey().name(), e.getValue(), Money.applyMultiplier(Money.mul(sellPrice(e.getKey()), e.getValue()), mult), source);
        msg().send(p, "economy.sold", "amount", Money.formatWhole(count), "money", Money.format(pay), "mult", mult);
        return pay;
    }

    // ---------------------------------------------------------------- /sell container
    /** Real (editable) inventory; on close every sellable plain item is sold and the rest returned. */
    public static final class SellHolder implements InventoryHolder {
        Inventory inv;
        boolean done;
        @Override public Inventory getInventory() { return inv; }
    }

    public void openSell(Player p) {
        SellHolder h = new SellHolder();
        h.inv = Bukkit.createInventory(h, 54, Msg.color(msg().raw("economy.sell-title")));
        p.openInventory(h.inv);
    }

    @EventHandler
    public void onSellClick(InventoryClickEvent e) {
        if (!(e.getView().getTopInventory().getHolder() instanceof SellHolder)) return;
        ItemStack cur = e.getCurrentItem();
        // Spawners & custom tools are never sold here (prevents selling tagged items by accident).
        if (cur != null && Items.tag(cur, Items.SPAWNER) != null && e.getClickedInventory() != e.getView().getTopInventory()) e.setCancelled(true);
    }

    @EventHandler
    public void onSellClose(InventoryCloseEvent e) {
        if (!(e.getInventory().getHolder() instanceof SellHolder h) || h.done) return;
        h.done = true;
        Player p = (Player) e.getPlayer();
        Map<Material, Long> sold = new EnumMap<>(Material.class);
        List<ItemStack> back = new ArrayList<>();
        for (ItemStack it : h.inv.getContents()) {
            if (it == null || it.getType().isAir()) continue;
            if (Items.isPlain(it) && sellPrice(it.getType()) > 0) sold.merge(it.getType(), (long) it.getAmount(), Long::sum);
            else back.add(it);
        }
        h.inv.clear();
        if (!sold.isEmpty()) payout(p, sold, "sell menu");
        if (!back.isEmpty()) {
            boolean disconnect = e.getReason() == InventoryCloseEvent.Reason.DISCONNECT || !p.isOnline();
            List<ItemStack> left = disconnect ? back : Items.give(p, back);
            if (!left.isEmpty()) { plugin.mailbox.addAll(p.getUniqueId(), left, "unsold items"); }
            msg().send(p, "economy.returned", "count", back.size());
        }
    }

    public void sellAll(Player p) {
        if (!cfg("economy.yml").getBoolean("sellall.enabled", true)) { msg().send(p, "error.disabled"); return; }
        Map<Material, Long> sold = new EnumMap<>(Material.class);
        ItemStack[] c = p.getInventory().getStorageContents();
        for (int i = 0; i < c.length; i++) {
            ItemStack it = c[i];
            if (it != null && Items.isPlain(it) && sellPrice(it.getType()) > 0) { sold.merge(it.getType(), (long) it.getAmount(), Long::sum); c[i] = null; }
        }
        if (sold.isEmpty()) { msg().send(p, "economy.nothing-to-sell"); return; }
        p.getInventory().setStorageContents(c);
        payout(p, sold, "sellall");
    }

    private void history(Player p) {
        plugin.db().query(c -> {
            List<String> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT ts,material,amount,total,source FROM sell_log WHERE uuid=? AND total>0 ORDER BY id DESC LIMIT 10")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) out.add("&7" + new java.text.SimpleDateFormat("MM-dd HH:mm").format(new Date(rs.getLong(1))) + " &f" + rs.getLong(3) + "x "
                        + rs.getString(2) + " &a" + Money.format(rs.getLong(4)) + " &8(" + rs.getString(5) + ")");
                }
            }
            return out;
        }).thenAccept(l -> plugin.runSync(() -> {
            msg().sendRaw(p, "&6&lSell history");
            if (l.isEmpty()) msg().sendRaw(p, "&7No sales yet.");
            l.forEach(x -> msg().sendRaw(p, x));
        }));
    }
}
