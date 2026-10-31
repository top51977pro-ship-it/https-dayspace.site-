package net.donutclassic.economy;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.menu.Menu;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/**
 * Persistent per-player item mailbox (/claim). Used whenever items cannot be handed over directly:
 * full inventory, AH expiry/cancel, filled buy orders, offline recipients. Claiming deletes the DB row
 * BEFORE giving, and anything that does not fit is re-inserted, so items are never duplicated or lost.
 */
public final class Mailbox extends Module {
    private final Set<UUID> claiming = new HashSet<>();
    public Mailbox(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "mailbox"; }

    @Override public void enable() {
        command("claim", (s, a) -> { Player p = player(s); if (p != null) open(p); });
    }

    public void add(UUID owner, ItemStack item, String source) { addAll(owner, List.of(item), source); }

    public void addAll(UUID owner, Collection<ItemStack> items, String source) {
        List<byte[]> blobs = new ArrayList<>();
        for (ItemStack it : items) if (it != null && !it.getType().isAir()) blobs.add(Items.toBytes(it));
        if (blobs.isEmpty()) return;
        long now = System.currentTimeMillis();
        plugin.db().tx(c -> {
            for (byte[] b : blobs) Database.exec(c, "INSERT INTO mailbox(uuid,item,source,ts) VALUES(?,?,?,?)", owner.toString(), b, source, now);
            return null;
        });
    }

    public void count(UUID id, java.util.function.Consumer<Integer> cb) {
        plugin.db().query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM mailbox WHERE uuid=?")) {
                ps.setString(1, id.toString());
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getInt(1) : 0; }
            }
        }).thenAccept(n -> plugin.runSync(() -> cb.accept(n)));
    }

    @Override public void onDataLoaded(Player p) {
        count(p.getUniqueId(), n -> { if (n > 0 && p.isOnline()) msg().send(p, "mailbox.waiting", "count", n); });
    }

    record Mail(long id, ItemStack item, String source) { }

    public void open(Player p) {
        plugin.db().query(c -> {
            List<Object[]> rows = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT id,item,source FROM mailbox WHERE uuid=? ORDER BY id LIMIT 45")) {
                ps.setString(1, p.getUniqueId().toString());
                try (ResultSet rs = ps.executeQuery()) { while (rs.next()) rows.add(new Object[]{rs.getLong(1), rs.getBytes(2), rs.getString(3)}); }
            }
            return rows;
        }).thenAccept(rows -> plugin.runSync(() -> {
            if (!p.isOnline()) return;
            List<Mail> mails = new ArrayList<>();
            for (Object[] r : rows) {
                try { mails.add(new Mail((long) r[0], Items.fromBytes((byte[]) r[1]), (String) r[2])); }
                catch (Exception ex) { plugin.getLogger().warning("Unreadable mailbox item #" + r[0] + ": " + ex.getMessage()); }
            }
            Menu m = new Menu(6, msg().raw("mailbox.title"));
            int slot = 0;
            for (Mail mail : mails) {
                ItemStack icon = mail.item().clone();
                var meta = icon.getItemMeta();
                if (meta != null) {
                    List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
                    lore.add(net.donutclassic.util.Msg.color("&8From: " + mail.source()));
                    lore.add(net.donutclassic.util.Msg.color("&eClick to claim"));
                    meta.setLore(lore); icon.setItemMeta(meta);
                }
                m.set(slot++, icon, e -> claim(p, mail));
            }
            if (mails.isEmpty()) m.set(22, Items.make(org.bukkit.Material.BARRIER, msg().raw("mailbox.empty")));
            m.set(49, Items.make(org.bukkit.Material.HOPPER, "&a&lClaim All"), e -> { p.closeInventory(); claimAll(p, mails); });
            m.open(p);
        }));
    }

    private void claim(Player p, Mail mail) { claimAll(p, List.of(mail)); p.closeInventory(); }

    private void claimAll(Player p, List<Mail> mails) {
        if (mails.isEmpty() || !claiming.add(p.getUniqueId())) return;
        List<Long> ids = new ArrayList<>();
        for (Mail m : mails) ids.add(m.id());
        plugin.db().tx(c -> {
            List<Long> deleted = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("DELETE FROM mailbox WHERE id=? AND uuid=?")) {
                for (long id : ids) { ps.setLong(1, id); ps.setString(2, p.getUniqueId().toString()); if (ps.executeUpdate() == 1) deleted.add(id); }
            }
            return deleted;
        }).whenComplete((deleted, err) -> plugin.runSync(() -> {
            claiming.remove(p.getUniqueId());
            if (err != null || deleted == null) return;
            List<ItemStack> give = new ArrayList<>();
            for (Mail m : mails) if (deleted.contains(m.id())) give.add(m.item());
            if (!p.isOnline()) { addAll(p.getUniqueId(), give, "returned"); return; }
            List<ItemStack> left = Items.give(p, give);
            if (!left.isEmpty()) { addAll(p.getUniqueId(), left, "returned (inventory full)"); msg().send(p, "mailbox.partial"); }
            else msg().send(p, "mailbox.claimed", "count", give.size());
        }));
    }
}
