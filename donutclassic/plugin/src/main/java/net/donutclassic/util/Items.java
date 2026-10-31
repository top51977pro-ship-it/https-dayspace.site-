package net.donutclassic.util;

import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;

import java.io.*;
import java.util.*;

/** Item builders, PersistentDataContainer tags and binary (de)serialization. */
public final class Items {
    private Items() { }
    public static NamespacedKey SPAWNER, TOOL, BOOSTER, MENU, NPC, HOLO, CRATE_REWARD;

    public static void init(Plugin p) {
        SPAWNER = new NamespacedKey(p, "spawner_type");
        TOOL = new NamespacedKey(p, "tool");
        BOOSTER = new NamespacedKey(p, "booster_minutes");
        MENU = new NamespacedKey(p, "menu_icon");
        NPC = new NamespacedKey(p, "npc");
        HOLO = new NamespacedKey(p, "holo");
        CRATE_REWARD = new NamespacedKey(p, "crate_reward");
    }

    public static ItemStack make(Material m, int amount, String name, List<String> lore) {
        ItemStack it = new ItemStack(m == null ? Material.STONE : m, Math.max(1, Math.min(amount, (m == null ? Material.STONE : m).getMaxStackSize())));
        ItemMeta meta = it.getItemMeta();
        if (meta != null) {
            if (name != null) meta.setDisplayName(Msg.color(name));
            if (lore != null) { List<String> l = new ArrayList<>(); for (String s : lore) l.add(Msg.color(s)); meta.setLore(l); }
            it.setItemMeta(meta);
        }
        return it;
    }

    public static ItemStack make(Material m, String name, String... lore) { return make(m, 1, name, Arrays.asList(lore)); }

    public static ItemStack glow(ItemStack it) {
        ItemMeta meta = it.getItemMeta();
        if (meta == null) return it;
        try { // 1.20.5+
            ItemMeta.class.getMethod("setEnchantmentGlintOverride", Boolean.class).invoke(meta, Boolean.TRUE);
        } catch (ReflectiveOperationException e) { // older servers: hidden enchant
            Enchantment luck = enchant("luck_of_the_sea");
            if (luck != null) meta.addEnchant(luck, 1, true);
            meta.addItemFlags(org.bukkit.inventory.ItemFlag.HIDE_ENCHANTS);
        }
        it.setItemMeta(meta);
        return it;
    }

    public static String tag(ItemStack it, NamespacedKey key) {
        if (it == null || !it.hasItemMeta()) return null;
        return it.getItemMeta().getPersistentDataContainer().get(key, PersistentDataType.STRING);
    }

    public static ItemStack setTag(ItemStack it, NamespacedKey key, String value) {
        ItemMeta meta = it.getItemMeta();
        meta.getPersistentDataContainer().set(key, PersistentDataType.STRING, value);
        it.setItemMeta(meta);
        return it;
    }

    public static Material material(String name) {
        if (name == null) return null;
        Material m = Material.matchMaterial(name.trim());
        return m == null || m.isAir() || !m.isItem() ? null : m;
    }

    @SuppressWarnings("deprecation")
    public static Enchantment enchant(String name) {
        Enchantment e = Enchantment.getByKey(NamespacedKey.minecraft(name.toLowerCase(Locale.ROOT)));
        return e;
    }

    /**
     * "Plain" = what a vanilla drop of this material looks like (no name, lore, enchants, custom data, damage,
     * container contents). Only plain items may be sold to the server shop or delivered to buy orders.
     */
    public static boolean isPlain(ItemStack it) {
        if (it == null || it.getType().isAir()) return false;
        ItemStack fresh = new ItemStack(it.getType(), it.getAmount());
        return it.isSimilar(fresh);
    }

    public static String pretty(Material m) {
        String[] parts = m.name().toLowerCase(Locale.ROOT).split("_");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) { if (sb.length() > 0) sb.append(' '); sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1)); }
        return sb.toString();
    }

    public static String displayName(ItemStack it) {
        if (it.hasItemMeta() && it.getItemMeta().hasDisplayName()) return it.getItemMeta().getDisplayName();
        return pretty(it.getType());
    }

    /** Splits a total count into max-stack ItemStacks. */
    public static List<ItemStack> stacks(Material m, long amount) {
        List<ItemStack> out = new ArrayList<>();
        int max = m.getMaxStackSize();
        while (amount > 0) { int n = (int) Math.min(max, amount); out.add(new ItemStack(m, n)); amount -= n; }
        return out;
    }

    public static List<ItemStack> stacks(ItemStack proto, long amount) {
        List<ItemStack> out = new ArrayList<>();
        int max = proto.getMaxStackSize();
        while (amount > 0) { int n = (int) Math.min(max, amount); ItemStack c = proto.clone(); c.setAmount(n); out.add(c); amount -= n; }
        return out;
    }

    /** Adds items; returns what did NOT fit (never loses items silently). */
    public static List<ItemStack> give(Player p, Collection<ItemStack> items) {
        List<ItemStack> left = new ArrayList<>();
        for (ItemStack it : items) if (it != null && !it.getType().isAir()) left.addAll(p.getInventory().addItem(it.clone()).values());
        return left;
    }

    /** Counts plain items of a material in the main inventory (storage contents). */
    public static int countPlain(Player p, Material m) {
        int n = 0;
        for (ItemStack it : p.getInventory().getStorageContents()) if (it != null && it.getType() == m && isPlain(it)) n += it.getAmount();
        return n;
    }

    /** Removes up to {@code amount} plain items of material; returns how many were removed. */
    public static int removePlain(Player p, Material m, int amount) {
        int removed = 0;
        ItemStack[] c = p.getInventory().getStorageContents();
        for (int i = 0; i < c.length && removed < amount; i++) {
            ItemStack it = c[i];
            if (it == null || it.getType() != m || !isPlain(it)) continue;
            int take = Math.min(it.getAmount(), amount - removed);
            removed += take;
            if (take == it.getAmount()) c[i] = null; else it.setAmount(it.getAmount() - take);
        }
        p.getInventory().setStorageContents(c);
        return removed;
    }

    public static byte[] toBytes(ItemStack it) { return it.serializeAsBytes(); }
    public static ItemStack fromBytes(byte[] b) { return ItemStack.deserializeBytes(b); }

    public static byte[] toBytes(ItemStack[] items) {
        try (ByteArrayOutputStream bo = new ByteArrayOutputStream(); DataOutputStream out = new DataOutputStream(bo)) {
            out.writeInt(items.length);
            for (ItemStack it : items) {
                if (it == null || it.getType().isAir()) { out.writeInt(0); continue; }
                byte[] b = it.serializeAsBytes(); out.writeInt(b.length); out.write(b);
            }
            out.flush();
            return bo.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    public static ItemStack[] arrayFromBytes(byte[] data) {
        try (DataInputStream in = new DataInputStream(new ByteArrayInputStream(data))) {
            ItemStack[] out = new ItemStack[in.readInt()];
            for (int i = 0; i < out.length; i++) {
                int len = in.readInt();
                if (len == 0) continue;
                byte[] b = new byte[len]; in.readFully(b);
                out[i] = ItemStack.deserializeBytes(b);
            }
            return out;
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }
}
