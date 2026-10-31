package net.donutclassic.auction;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.sql.ResultSet;
import java.util.*;

/**
 * Buy orders: the creator's money is escrowed at creation. Fillers deliver PLAIN items of the material
 * (no name/enchant/custom data) and are paid from escrow; delivered items go to the creator's mailbox.
 * Partial fills supported; cancel refunds the remaining escrow.
 */
public final class OrderModule extends Module {
    static final class Order { long id; UUID owner; String ownerName; Material material; long amount, filled, priceEach, escrow; boolean closed; }
    private final Map<Long, Order> open = new LinkedHashMap<>();
    private boolean loaded;

    public OrderModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "orders"; }

    @Override public void enable() {
        plugin.db().query(c -> {
            List<Order> l = new ArrayList<>();
            try (ResultSet rs = c.createStatement().executeQuery("SELECT id,owner,owner_name,material,amount,filled,price_each,escrow FROM orders WHERE status='OPEN'")) {
                while (rs.next()) {
                    Order o = new Order();
                    o.id = rs.getLong(1); o.owner = UUID.fromString(rs.getString(2)); o.ownerName = rs.getString(3);
                    o.material = Material.matchMaterial(rs.getString(4)); o.amount = rs.getLong(5); o.filled = rs.getLong(6);
                    o.priceEach = rs.getLong(7); o.escrow = rs.getLong(8);
                    if (o.material != null) l.add(o);
                }
            }
            return l;
        }).thenAccept(l -> plugin.runSync(() -> { for (Order o : l) open.put(o.id, o); loaded = true; }));
        command("orders", this::cmd, (s, a) -> a.length == 1 ? List.of("create", "my", "claim") :
            a.length == 2 && a[0].equalsIgnoreCase("create") ? Arrays.stream(Material.values()).filter(Material::isItem).map(m -> m.name().toLowerCase(Locale.ROOT)).toList() : List.of());
    }

    private void cmd(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (!loaded) { msg().send(p, "error.loading"); return; }
        if (a.length == 0) { browse(p, 0); return; }
        switch (a[0].toLowerCase(Locale.ROOT)) {
            case "create" -> create(p, a);
            case "my" -> mine(p);
            case "claim" -> plugin.mailbox.open(p);
            default -> browse(p, 0);
        }
    }

    private void create(Player p, String[] a) {
        if (a.length < 4) { msg().sendRaw(p, "&c/orders create <item> <amount> <price-each>"); return; }
        Material m = Items.material(a[1]);
        long amount = Money.parseWhole(a[2], cfg("economy.yml").getLong("orders.max-amount", 100_000));
        long each = Money.parse(a[3]);
        if (m == null || amount <= 0 || each <= 0) { msg().send(p, "error.bad-args"); return; }
        long total = Money.mul(each, amount);
        if (total < 0) { msg().send(p, "error.bad-args"); return; }
        long fee = Money.percent(total, cfg("economy.yml").getDouble("orders.creation-fee-percent", 0));
        long mine = open.values().stream().filter(o -> o.owner.equals(p.getUniqueId())).count();
        if (mine >= cfg("economy.yml").getInt("orders.max-per-player", 10)) { msg().send(p, "orders.too-many"); return; }
        if (!plugin.ledger().withdraw(p.getUniqueId(), Ledger.MONEY, total + fee, "order escrow")) { msg().send(p, "economy.not-enough"); return; }
        Order o = new Order();
        o.owner = p.getUniqueId(); o.ownerName = p.getName(); o.material = m; o.amount = amount; o.priceEach = each; o.escrow = total;
        plugin.db().query(c -> Database.insert(c, "INSERT INTO orders(owner,owner_name,material,amount,filled,price_each,escrow,created,status) VALUES(?,?,?,?,0,?,?,?,'OPEN')",
            o.owner.toString(), o.ownerName, m.name(), amount, each, total, System.currentTimeMillis()))
            .whenComplete((id, err) -> plugin.runSync(() -> {
                if (err != null) { plugin.ledger().deposit(o.owner, Ledger.MONEY, total + fee, "order refund (db error)"); return; }
                o.id = id; open.put(id, o);
                msg().send(p, "orders.created", "amount", amount, "item", Items.pretty(m), "price", Money.format(each), "total", Money.format(total));
            }));
    }

    void browse(Player p, int page) {
        List<Order> l = new ArrayList<>();
        for (Order o : open.values()) if (!o.closed) l.add(o);
        l.sort(Comparator.comparingLong((Order o) -> o.priceEach).reversed());
        int pages = Math.max(1, (l.size() + 44) / 45), pg = Math.max(0, Math.min(page, pages - 1));
        Menu m = new Menu(6, "&8Orders &7(" + (pg + 1) + "/" + pages + ")");
        for (int i = 0; i < 45 && pg * 45 + i < l.size(); i++) {
            Order o = l.get(pg * 45 + i);
            m.set(i, Items.make(o.material, 1, "&f" + Items.pretty(o.material), List.of("&7Paying: &a" + Money.format(o.priceEach) + " each",
                "&7Progress: &f" + o.filled + "/" + o.amount, "&7By: &f" + o.ownerName, "", "&eClick to deliver from your inventory")),
                e -> { fill(p, o); browse(p, pg); });
        }
        if (pg > 0) m.set(45, Items.make(Material.ARROW, "&ePrevious"), e -> browse(p, pg - 1));
        m.set(49, Items.make(Material.CHEST, "&aMy orders", "&7Create: &f/orders create <item> <amount> <price>"), e -> mine(p));
        m.set(50, Items.make(Material.ENDER_CHEST, "&aClaim delivered items"), e -> { p.closeInventory(); plugin.mailbox.open(p); });
        if (pg < pages - 1) m.set(53, Items.make(Material.ARROW, "&eNext"), e -> browse(p, pg + 1));
        m.open(p);
    }

    private void fill(Player p, Order o) {
        if (o.closed || !open.containsKey(o.id)) { msg().send(p, "orders.gone"); return; }
        if (o.owner.equals(p.getUniqueId())) { msg().send(p, "orders.own"); return; }
        long remaining = o.amount - o.filled;
        int have = Items.countPlain(p, o.material);
        int n = (int) Math.min(have, remaining);
        if (n <= 0) { msg().send(p, "orders.no-items", "item", Items.pretty(o.material)); return; }
        long pay = Money.mul(o.priceEach, n);
        if (pay < 0 || pay > o.escrow) return;
        int removed = Items.removePlain(p, o.material, n);
        if (removed != n) { // should never happen; give back whatever was taken
            Items.give(p, Items.stacks(o.material, removed)); return;
        }
        pay = Money.mul(o.priceEach, removed);
        o.filled += removed; o.escrow -= pay;
        if (o.filled >= o.amount) { o.closed = true; open.remove(o.id); }
        long fee = Money.percent(pay, cfg("economy.yml").getDouble("orders.fill-fee-percent", 0));
        plugin.ledger().deposit(p.getUniqueId(), Ledger.MONEY, pay - fee, "order fill #" + o.id);
        plugin.mailbox.addAll(o.owner, Items.stacks(o.material, removed), "order #" + o.id + " from " + p.getName());
        final long fFilled = o.filled, fEscrow = o.escrow; final String status = o.closed ? "FILLED" : "OPEN";
        plugin.db().query(c -> { Database.exec(c, "UPDATE orders SET filled=?, escrow=?, status=? WHERE id=?", fFilled, fEscrow, status, o.id); return null; });
        msg().send(p, "orders.filled", "amount", removed, "item", Items.pretty(o.material), "money", Money.format(pay - fee));
        Player owner = Bukkit.getPlayer(o.owner);
        if (owner != null) msg().send(owner, "orders.delivered", "amount", removed, "item", Items.pretty(o.material), "player", p.getName());
    }

    private void mine(Player p) {
        Menu m = new Menu(3, "&8My orders");
        int i = 0;
        for (Order o : open.values()) {
            if (!o.owner.equals(p.getUniqueId()) || o.closed || i >= 18) continue;
            m.set(i++, Items.make(o.material, 1, "&f" + Items.pretty(o.material), List.of("&7" + o.filled + "/" + o.amount + " @ " + Money.format(o.priceEach),
                "&7Escrow left: &a" + Money.format(o.escrow), "&cClick to cancel (refund escrow)")), e -> { cancel(p, o); mine(p); });
        }
        m.set(22, Items.make(Material.OAK_DOOR, "&cBack"), e -> browse(p, 0));
        m.open(p);
    }

    private void cancel(Player p, Order o) {
        if (o.closed || !o.owner.equals(p.getUniqueId())) return;
        o.closed = true; open.remove(o.id);
        long refund = o.escrow; o.escrow = 0;
        plugin.ledger().deposit(p.getUniqueId(), Ledger.MONEY, refund, "order cancel #" + o.id);
        plugin.db().query(c -> { Database.exec(c, "UPDATE orders SET escrow=0, status='CANCELLED' WHERE id=?", o.id); return null; });
        msg().send(p, "orders.cancelled", "money", Money.format(refund));
    }
}
