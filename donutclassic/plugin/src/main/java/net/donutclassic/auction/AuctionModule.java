package net.donutclassic.auction;

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
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.scheduler.BukkitTask;

import java.sql.ResultSet;
import java.util.*;

/**
 * Auction House. Items are held in escrow in SQLite from listing until sale/cancel/expiry. All state
 * changes happen on the main thread against an in-memory cache first (so two simultaneous buyers can
 * never both win) and are then persisted; unsold/cancelled items go back via the mailbox.
 */
public final class AuctionModule extends Module {
    static final class Listing {
        long id; UUID seller; String sellerName; ItemStack item; long price; long created, expires; boolean gone;
    }

    private final Map<Long, Listing> active = new LinkedHashMap<>();
    private BukkitTask expiryTask;
    private boolean loaded;

    public AuctionModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "auction"; }
    private YamlConfiguration y() { return cfg("economy.yml"); }

    @Override public void enable() {
        plugin.db().query(c -> {
            List<Listing> l = new ArrayList<>();
            try (ResultSet rs = c.createStatement().executeQuery("SELECT id,seller,seller_name,item,price,created,expires FROM ah_listings WHERE status='ACTIVE' ORDER BY id")) {
                while (rs.next()) {
                    Listing x = new Listing();
                    x.id = rs.getLong(1); x.seller = UUID.fromString(rs.getString(2)); x.sellerName = rs.getString(3);
                    try { x.item = Items.fromBytes(rs.getBytes(4)); } catch (Exception ex) { plugin.getLogger().warning("Bad AH item #" + x.id); continue; }
                    x.price = rs.getLong(5); x.created = rs.getLong(6); x.expires = rs.getLong(7);
                    l.add(x);
                }
            }
            return l;
        }).thenAccept(l -> plugin.runSync(() -> { for (Listing x : l) active.put(x.id, x); loaded = true; }));
        command("ah", this::cmd, (s, a) -> a.length == 1 ? List.of("sell", "search", "my", "claim", "sort") : List.of());
        expiryTask = Bukkit.getScheduler().runTaskTimer(plugin, this::expire, 20L * 60, 20L * 60);
    }

    @Override public void disable() { if (expiryTask != null) expiryTask.cancel(); }

    private void cmd(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        if (!loaded) { msg().send(p, "error.loading"); return; }
        if (a.length == 0) { browse(p, 0, "newest", null); return; }
        switch (a[0].toLowerCase(Locale.ROOT)) {
            case "sell" -> { if (a.length < 2) msg().sendRaw(p, "&c/ah sell <price>"); else sell(p, a[1]); }
            case "search" -> browse(p, 0, "newest", a.length > 1 ? String.join(" ", Arrays.copyOfRange(a, 1, a.length)).toLowerCase(Locale.ROOT) : null);
            case "my" -> mine(p);
            case "claim" -> plugin.mailbox.open(p);
            default -> browse(p, 0, "newest", null);
        }
    }

    int maxListings(Player p) {
        int max = plugin.presetCfg().getInt("auction.max-listings", y().getInt("auction.max-listings", 25));
        for (int i = 100; i > max; i--) if (p.hasPermission("dc.ah.listings." + i)) return i;
        return max;
    }

    private void sell(Player p, String priceArg) {
        long price = Money.parse(priceArg);
        long min = Money.parse(y().getString("auction.min-price", "1")), max = Money.parse(y().getString("auction.max-price", "1000000000000"));
        if (price <= 0 || price < min || price > max) { msg().send(p, "auction.bad-price", "min", Money.format(min), "max", Money.format(max)); return; }
        ItemStack hand = p.getInventory().getItemInMainHand();
        if (hand.getType().isAir()) { msg().send(p, "auction.hold-item"); return; }
        if (Items.tag(hand, Items.SPAWNER) != null && !y().getBoolean("auction.allow-spawners", false)) { msg().send(p, "auction.no-spawners"); return; }
        if (containsSpawner(hand) && !y().getBoolean("auction.allow-spawners", false)) { msg().send(p, "auction.no-spawners"); return; }
        long mine = active.values().stream().filter(l -> l.seller.equals(p.getUniqueId())).count();
        if (mine >= maxListings(p)) { msg().send(p, "auction.too-many", "max", maxListings(p)); return; }
        ItemStack item = hand.clone();
        p.getInventory().setItemInMainHand(null); // item now in escrow
        Listing l = new Listing();
        l.seller = p.getUniqueId(); l.sellerName = p.getName(); l.item = item; l.price = price;
        l.created = System.currentTimeMillis(); l.expires = l.created + y().getLong("auction.duration-hours", 48) * 3_600_000L;
        byte[] blob = Items.toBytes(item);
        String search = (item.getType().name() + " " + Msg.strip(Items.displayName(item))).toLowerCase(Locale.ROOT);
        plugin.db().query(c -> Database.insert(c, "INSERT INTO ah_listings(seller,seller_name,item,material,search,price,created,expires,status) VALUES(?,?,?,?,?,?,?,?,'ACTIVE')",
                l.seller.toString(), l.sellerName, blob, item.getType().name(), search, price, l.created, l.expires))
            .whenComplete((id, err) -> plugin.runSync(() -> {
                if (err != null) { plugin.mailbox.add(l.seller, item, "AH listing failed"); msg().send(p, "error.internal"); return; }
                l.id = id; active.put(id, l);
                msg().send(p, "auction.listed", "item", Items.displayName(item), "price", Money.format(price));
            }));
    }

    private static boolean containsSpawner(ItemStack it) {
        if (it.getItemMeta() instanceof BlockStateMeta bsm && bsm.hasBlockState() && bsm.getBlockState() instanceof org.bukkit.inventory.InventoryHolder h) {
            for (ItemStack in : h.getInventory().getContents()) if (in != null && Items.tag(in, Items.SPAWNER) != null) return true;
        }
        return false;
    }

    private List<Listing> filtered(String sort, String search) {
        long now = System.currentTimeMillis();
        List<Listing> l = new ArrayList<>();
        for (Listing x : active.values()) {
            if (x.gone || x.expires <= now) continue;
            if (search != null && !(x.item.getType().name() + " " + Msg.strip(Items.displayName(x.item))).toLowerCase(Locale.ROOT).replace('_', ' ').contains(search.replace('_', ' '))) continue;
            l.add(x);
        }
        switch (sort) {
            case "cheapest" -> l.sort(Comparator.comparingLong(x -> x.price));
            case "expensive" -> l.sort(Comparator.comparingLong((Listing x) -> x.price).reversed());
            case "ending" -> l.sort(Comparator.comparingLong(x -> x.expires));
            default -> l.sort(Comparator.comparingLong((Listing x) -> x.created).reversed());
        }
        return l;
    }

    private static final List<String> SORTS = List.of("newest", "cheapest", "expensive", "ending");

    void browse(Player p, int page, String sort, String search) {
        List<Listing> l = filtered(sort, search);
        int pages = Math.max(1, (l.size() + 44) / 45);
        int pg = Math.max(0, Math.min(page, pages - 1));
        Menu m = new Menu(6, "&8Auction House &7(" + (pg + 1) + "/" + pages + ")");
        for (int i = 0; i < 45 && pg * 45 + i < l.size(); i++) {
            Listing x = l.get(pg * 45 + i);
            m.set(i, display(x, "&eClick to buy"), e -> confirm(p, x, () -> browse(p, pg, sort, search)));
        }
        if (pg > 0) m.set(45, Items.make(Material.ARROW, "&ePrevious page"), e -> browse(p, pg - 1, sort, search));
        m.set(47, Items.make(Material.HOPPER, "&bSort: &f" + sort, "&7Click to change"), e -> browse(p, 0, SORTS.get((SORTS.indexOf(sort) + 1) % SORTS.size()), search));
        m.set(48, Items.make(Material.OAK_SIGN, "&bSearch" + (search == null ? "" : ": &f" + search), "&7Use &f/ah search <text>", search == null ? "" : "&7Click to clear"),
            e -> browse(p, 0, sort, null));
        m.set(49, Items.make(Material.CHEST, "&aMy listings"), e -> mine(p));
        m.set(50, Items.make(Material.ENDER_CHEST, "&aClaim items"), e -> { p.closeInventory(); plugin.mailbox.open(p); });
        m.set(51, Items.make(Material.EMERALD, "&7Sell: &f/ah sell <price>", "&7Hold the item in your hand."));
        if (pg < pages - 1) m.set(53, Items.make(Material.ARROW, "&eNext page"), e -> browse(p, pg + 1, sort, search));
        m.open(p);
    }

    private ItemStack display(Listing x, String action) {
        ItemStack it = x.item.clone();
        ItemMeta meta = it.getItemMeta();
        if (meta != null) {
            List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
            lore.add(Msg.color("&8----------"));
            lore.add(Msg.color("&7Price: &a" + Money.format(x.price)));
            lore.add(Msg.color("&7Seller: &f" + x.sellerName));
            lore.add(Msg.color("&7Expires in: &f" + Math.max(0, (x.expires - System.currentTimeMillis()) / 3_600_000L) + "h"));
            lore.add(Msg.color(action));
            meta.setLore(lore); it.setItemMeta(meta);
        }
        return it;
    }

    private void confirm(Player p, Listing x, Runnable back) {
        Menu m = new Menu(3, "&8Confirm purchase");
        m.set(13, display(x, ""));
        boolean own = x.seller.equals(p.getUniqueId());
        m.set(11, Items.make(Material.LIME_CONCRETE, own ? "&cCancel listing" : "&a&lBuy for " + Money.format(x.price)), e -> {
            if (own) cancel(p, x); else buy(p, x);
            p.closeInventory();
        });
        m.set(15, Items.make(Material.RED_CONCRETE, "&cBack"), e -> back.run());
        m.open(p);
    }

    private void buy(Player p, Listing x) {
        if (x.gone || !active.containsKey(x.id) || x.expires <= System.currentTimeMillis()) { msg().send(p, "auction.gone"); return; }
        if (x.seller.equals(p.getUniqueId())) return;
        if (!plugin.ledger().withdraw(p.getUniqueId(), Ledger.MONEY, x.price, "ah buy #" + x.id)) { msg().send(p, "economy.not-enough"); return; }
        x.gone = true; active.remove(x.id);                               // atomically claimed on main thread
        long tax = Money.percent(x.price, y().getDouble("auction.sales-tax-percent", 0));
        plugin.ledger().deposit(x.seller, Ledger.MONEY, x.price - tax, "ah sale #" + x.id);
        plugin.db().query(c -> { Database.exec(c, "UPDATE ah_listings SET status='SOLD', buyer=? WHERE id=? AND status='ACTIVE'", p.getUniqueId().toString(), x.id); return null; });
        List<ItemStack> left = Items.give(p, List.of(x.item));
        if (!left.isEmpty()) { plugin.mailbox.addAll(p.getUniqueId(), left, "AH purchase"); msg().send(p, "mailbox.overflow"); }
        msg().send(p, "auction.bought", "item", Items.displayName(x.item), "price", Money.format(x.price));
        Player seller = Bukkit.getPlayer(x.seller);
        if (seller != null) msg().send(seller, "auction.sold", "item", Items.displayName(x.item), "price", Money.format(x.price - tax), "buyer", p.getName());
    }

    private void cancel(Player p, Listing x) {
        if (x.gone || !active.containsKey(x.id) || !x.seller.equals(p.getUniqueId())) return;
        x.gone = true; active.remove(x.id);
        plugin.db().query(c -> { Database.exec(c, "UPDATE ah_listings SET status='CANCELLED' WHERE id=? AND status='ACTIVE'", x.id); return null; });
        List<ItemStack> left = Items.give(p, List.of(x.item));
        if (!left.isEmpty()) plugin.mailbox.addAll(p.getUniqueId(), left, "AH cancelled");
        msg().send(p, "auction.cancelled");
    }

    private void mine(Player p) {
        Menu m = new Menu(4, "&8My listings &7(max " + maxListings(p) + ")");
        int i = 0;
        for (Listing x : active.values()) {
            if (!x.seller.equals(p.getUniqueId()) || x.gone) continue;
            if (i >= 27) break;
            m.set(i++, display(x, "&cClick to cancel"), e -> { cancel(p, x); mine(p); });
        }
        m.set(31, Items.make(Material.OAK_DOOR, "&cBack"), e -> browse(p, 0, "newest", null));
        m.open(p);
    }

    private void expire() {
        long now = System.currentTimeMillis();
        List<Listing> exp = new ArrayList<>();
        for (Listing x : active.values()) if (!x.gone && x.expires <= now) exp.add(x);
        for (Listing x : exp) {
            x.gone = true; active.remove(x.id);
            plugin.db().query(c -> { Database.exec(c, "UPDATE ah_listings SET status='EXPIRED' WHERE id=? AND status='ACTIVE'", x.id); return null; });
            plugin.mailbox.add(x.seller, x.item, "AH expired");
            Player s = Bukkit.getPlayer(x.seller);
            if (s != null) msg().send(s, "auction.expired", "item", Items.displayName(x.item));
        }
    }

    public int activeCount() { return active.size(); }
}
