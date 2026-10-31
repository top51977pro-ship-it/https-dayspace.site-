package net.donutclassic.spawner;

import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.core.SpawnerMath;
import net.donutclassic.core.SpawnerRecord;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Msg;
import net.donutclassic.util.Platform;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.*;

/** Spawner GUI: info, per-drop withdraw, collect all, sell all, collect XP, Add Stack (Bedrock-friendly). */
final class SpawnerMenu {
    private final SpawnerModule mod;
    private final SpawnerRecord r;
    private final Player p;
    private final Menu menu;

    SpawnerMenu(SpawnerModule mod, SpawnerRecord r, Player p) {
        this.mod = mod; this.r = r; this.p = p;
        SpawnerType t = mod.type(r.type);
        this.menu = new Menu(3, (t == null ? r.type : t.display()) + " &8x" + r.stack);
    }

    void open() { render(); menu.open(p); }

    private boolean valid() {
        if (r.removed || !p.isOnline() || !mod.canAccess(p, r)) { p.closeInventory(); return false; }
        return true;
    }

    private void render() {
        menu.clear();
        SpawnerType t = mod.type(r.type);
        long cap = mod.capacity(r), used = SpawnerMath.total(r.storage);
        double eff = mod.curve.effective(r.stack);
        boolean active = System.currentTimeMillis() - r.lastActive < mod.cycleSeconds * 2000L;
        List<String> info = new ArrayList<>();
        info.add("&7Owner: &f" + mod.ownerName(r));
        info.add("&7Stack: &f" + r.stack + " &8(effective x" + String.format(Locale.ROOT, "%.2f", eff) + ")");
        if (t != null) for (var d : t.drops())
            info.add("&7" + Items.pretty(Material.valueOf(d.material())) + ": &a" + String.format(Locale.ROOT, "%.1f", d.perMinute() * eff) + "/min");
        info.add("&7Storage: &f" + Money.formatWhole(used) + "&7/&f" + Money.formatWhole(cap));
        info.add("&7XP stored: &f" + r.xp);
        if (r.full) info.add("&c&lFULL &7- production paused until you collect or sell");
        else if (!active) info.add("&e&lPAUSED &7- runs only while a player is within " + (int) mod.activationDistance + " blocks");
        else info.add("&a&lACTIVE");
        menu.set(4, Items.make(Material.SPAWNER, 1, t == null ? r.type : t.display(), info));

        int slot = 9;
        for (var en : new TreeMap<>(r.storage).entrySet()) {
            Material m = Material.matchMaterial(en.getKey());
            if (m == null || slot > 17) continue;
            long price = mod.priceOf(en.getKey());
            final String key = en.getKey();
            menu.set(slot++, Items.make(m, (int) Math.max(1, Math.min(64, en.getValue())), "&f" + Items.pretty(m),
                List.of("&7Stored: &f" + Money.formatWhole(en.getValue()), "&7Sell value: &a" + Money.format(Money.mul(price, en.getValue())), "", "&eClick to withdraw")),
                e -> { if (valid()) { withdraw(key); render(); } });
        }
        menu.set(19, Items.make(Material.CHEST, "&a&lCollect All", "&7Move stored items into your inventory.", "&7Anything that does not fit stays stored."),
            e -> { if (valid()) { for (String k : new ArrayList<>(r.storage.keySet())) withdraw(k); render(); } });
        menu.set(21, Items.make(Material.GOLD_INGOT, "&6&lSell All", "&7Sell every stored item for Money", "&7(uses /sell prices and your multiplier)."),
            e -> { if (valid()) { sellAll(); render(); } });
        menu.set(23, Items.make(Material.EXPERIENCE_BOTTLE, "&b&lCollect XP", "&7Stored: &f" + r.xp),
            e -> { if (valid()) { collectXp(); render(); } });
        List<String> addLore = new ArrayList<>(List.of("&7Adds every matching " + r.type + " spawner", "&7from your inventory to this stack."));
        addLore.add(Platform.isBedrock(p) ? "&8(Bedrock: tap here)" : "&8Java: or sneak + right-click holding spawners");
        menu.set(25, Items.make(Material.SPAWNER, 1, "&e&lAdd Stack", addLore),
            e -> { if (valid()) { mod.mergeFromInventory(p, r); render(); } });
        menu.set(26, Items.make(Material.BARRIER, "&cClose"), e -> p.closeInventory());
    }

    private void withdraw(String key) {
        Material m = Material.matchMaterial(key);
        long have = r.storage.getOrDefault(key, 0L);
        if (m == null || have <= 0) return;
        r.storage.remove(key);                                        // take out first ...
        List<ItemStack> left = Items.give(p, Items.stacks(m, have));  // ... give ...
        long back = 0;
        for (ItemStack it : left) back += it.getAmount();
        if (back > 0) { r.storage.merge(key, back, Long::sum); msg("spawner.inventory-full"); } // ... return what did not fit
        r.full = SpawnerMath.total(r.storage) >= mod.capacity(r);
        mod.saveNow(r, p.getName(), "withdraw", key + " " + (have - back));
    }

    private void sellAll() {
        long total = 0, items = 0;
        Map<String, Long> sold = new HashMap<>();
        for (var en : r.storage.entrySet()) {
            long price = mod.priceOf(en.getKey());
            if (price <= 0) continue;
            long v = Money.mul(price, en.getValue());
            if (v < 0) continue;
            total = Math.addExact(total, v); items += en.getValue();
            sold.put(en.getKey(), en.getValue());
        }
        if (sold.isEmpty()) { msg("spawner.nothing-to-sell"); return; }
        double mult = mod.plugin().economy.multiplier(p);
        long pay = Money.applyMultiplier(total, mult);
        if (!mod.plugin().ledger().deposit(p.getUniqueId(), Ledger.MONEY, pay, "spawner sell #" + r.id)) { msg("error.balance-cap"); return; }
        for (String k : sold.keySet()) r.storage.remove(k);
        r.full = false;
        mod.saveNow(r, p.getName(), "sell", items + " items for " + pay);
        for (var en : sold.entrySet()) mod.plugin().economy.logSale(p.getUniqueId(), en.getKey(), en.getValue(), 0, "spawner");
        mod.plugin().economy.logSale(p.getUniqueId(), "SPAWNER_TOTAL", items, pay, "spawner");
        mod.plugin().msg().send(p, "spawner.sold", "items", Money.formatWhole(items), "money", Money.format(pay), "mult", mult);
    }

    private void collectXp() {
        if (r.xp <= 0) return;
        int give = (int) Math.min(Integer.MAX_VALUE, r.xp);
        r.xp -= give;
        p.giveExp(give);
        mod.saveNow(r, p.getName(), "xp", String.valueOf(give));
        mod.plugin().msg().send(p, "spawner.xp", "xp", give);
    }

    private void msg(String k) { mod.plugin().msg().send(p, k); }
}
