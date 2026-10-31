package net.donutclassic.tools;

import net.donutclassic.DonutClassic;
import net.donutclassic.util.Items;
import net.donutclassic.util.Module;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.block.TileState;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.Damageable;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.*;

/**
 * Shard tools: 3x3 pickaxe, 3x3 shovel, tree-felling axe and the Amethyst Bucket (drains a small water
 * area). Every extra block fires its own BlockBreakEvent first, so spawn protection and any other
 * protection plugin is respected; all changes run on the main thread.
 */
public final class ToolModule extends Module {
    private final Map<UUID, BlockFace> lastFace = new HashMap<>();
    private final Map<UUID, Long> bucketCooldown = new HashMap<>();
    private boolean busy; // re-entrancy guard for our synthetic break events

    public ToolModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "tools"; }

    private ConfigurationSection def(String id) { return cfg("config.yml").getConfigurationSection("tools." + id); }

    public Set<String> ids() { ConfigurationSection s = cfg("config.yml").getConfigurationSection("tools"); return s == null ? Set.of() : s.getKeys(false); }

    public ItemStack item(String id) {
        ConfigurationSection d = def(id);
        if (d == null || !d.getBoolean("enabled", true)) return null;
        Material m = Material.matchMaterial(d.getString("material", "DIAMOND_PICKAXE"));
        if (m == null) return null;
        ItemStack it = Items.make(m, 1, d.getString("name", id), d.getStringList("lore"));
        ItemMeta meta = it.getItemMeta();
        ConfigurationSection en = d.getConfigurationSection("enchants");
        if (en != null) for (String k : en.getKeys(false)) { Enchantment e = Items.enchant(k); if (e != null) meta.addEnchant(e, en.getInt(k), true); }
        it.setItemMeta(meta);
        return Items.setTag(it, Items.TOOL, id);
    }

    private String kind(String id) { ConfigurationSection d = def(id); return d == null ? null : d.getString("kind"); }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onLeft(PlayerInteractEvent e) {
        if (e.getAction() == Action.LEFT_CLICK_BLOCK) lastFace.put(e.getPlayer().getUniqueId(), e.getBlockFace());
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) { lastFace.remove(e.getPlayer().getUniqueId()); bucketCooldown.remove(e.getPlayer().getUniqueId()); }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        if (busy) return;
        Player p = e.getPlayer();
        ItemStack tool = p.getInventory().getItemInMainHand();
        String id = Items.tag(tool, Items.TOOL);
        if (id == null || p.isSneaking()) return; // sneak = mine a single block
        String kind = kind(id);
        if (kind == null) return;
        List<Block> extra = switch (kind) {
            case "area3x3" -> area(e.getBlock(), lastFace.getOrDefault(p.getUniqueId(), BlockFace.UP));
            case "treefeller" -> Tag.LOGS.isTagged(e.getBlock().getType()) ? tree(e.getBlock(), def(id).getInt("max-logs", 128)) : List.of();
            default -> List.of();
        };
        busy = true;
        try {
            for (Block b : extra) {
                if (tool.getType().isAir() || !p.isOnline()) break;
                if (!breakable(b, tool, kind)) continue;
                BlockBreakEvent ev = new BlockBreakEvent(b, p);
                Bukkit.getPluginManager().callEvent(ev);
                if (ev.isCancelled()) continue;
                b.breakNaturally(tool);
                if (damage(p, tool)) break;
            }
        } finally { busy = false; }
    }

    private boolean breakable(Block b, ItemStack tool, String kind) {
        Material t = b.getType();
        if (t.isAir() || b.isLiquid() || t.getHardness() < 0 || t == Material.SPAWNER || b.getState() instanceof TileState) return false;
        if (plugin.crates.crateAt(b) != null) return false;
        if (kind.equals("treefeller")) return Tag.LOGS.isTagged(t);
        return b.isPreferredTool(tool);
    }

    private static List<Block> area(Block c, BlockFace face) {
        List<Block> out = new ArrayList<>();
        for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) {
            if (a == 0 && b == 0) continue;
            switch (face) {
                case UP, DOWN -> out.add(c.getRelative(a, 0, b));
                case NORTH, SOUTH -> out.add(c.getRelative(a, b, 0));
                default -> out.add(c.getRelative(0, a, b));
            }
        }
        return out;
    }

    private static List<Block> tree(Block start, int max) {
        List<Block> out = new ArrayList<>();
        Deque<Block> q = new ArrayDeque<>(List.of(start));
        Set<Block> seen = new HashSet<>(List.of(start));
        while (!q.isEmpty() && out.size() < max) {
            Block b = q.poll();
            for (int dx = -1; dx <= 1; dx++) for (int dy = 0; dy <= 1; dy++) for (int dz = -1; dz <= 1; dz++) {
                Block n = b.getRelative(dx, dy, dz);
                if (seen.add(n) && Tag.LOGS.isTagged(n.getType())) { out.add(n); q.add(n); }
            }
        }
        return out;
    }

    /** Applies 1 durability (respecting Unbreaking). Returns true if the tool broke. */
    private boolean damage(Player p, ItemStack tool) {
        if (p.getGameMode() == GameMode.CREATIVE) return false;
        ItemMeta meta = tool.getItemMeta();
        if (!(meta instanceof Damageable d) || meta.isUnbreakable()) return false;
        int unb = tool.getEnchantmentLevel(Enchantment.UNBREAKING);
        if (unb > 0 && new Random().nextInt(unb + 1) != 0) return false;
        d.setDamage(d.getDamage() + 1);
        tool.setItemMeta(meta);
        if (d.getDamage() >= tool.getType().getMaxDurability()) {
            p.getInventory().setItemInMainHand(null);
            p.playSound(p.getLocation(), org.bukkit.Sound.ENTITY_ITEM_BREAK, 1, 1);
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ amethyst bucket
    @EventHandler(priority = EventPriority.HIGH)
    public void onBucket(PlayerInteractEvent e) {
        if (e.getHand() != EquipmentSlot.HAND || e.getAction() != Action.RIGHT_CLICK_BLOCK || e.getClickedBlock() == null) return;
        String id = Items.tag(e.getItem(), Items.TOOL);
        if (id == null || !"drain".equals(kind(id))) return;
        e.setCancelled(true);
        Player p = e.getPlayer();
        long now = System.currentTimeMillis(), cd = def(id).getLong("cooldown-seconds", 5) * 1000;
        if (now - bucketCooldown.getOrDefault(p.getUniqueId(), 0L) < cd) { msg().send(p, "tools.cooldown"); return; }
        bucketCooldown.put(p.getUniqueId(), now);
        int r = Math.max(1, Math.min(5, def(id).getInt("radius", 2)));
        Block c = e.getClickedBlock().getRelative(e.getBlockFace());
        int drained = 0;
        busy = true;
        try {
            for (int x = -r; x <= r; x++) for (int y = -r; y <= r; y++) for (int z = -r; z <= r; z++) {
                Block b = c.getRelative(x, y, z);
                if (b.getType() != Material.WATER || plugin.region.isProtected(b.getLocation())) continue;
                BlockBreakEvent ev = new BlockBreakEvent(b, p); // lets protection plugins veto
                Bukkit.getPluginManager().callEvent(ev);
                if (ev.isCancelled()) continue;
                b.setType(Material.AIR, false);
                drained++;
            }
        } finally { busy = false; }
        msg().send(p, "tools.drained", "count", drained);
    }

    public void adminGive(org.bukkit.command.CommandSender s, String[] a) {
        if (a.length < 4) { msg().sendRaw(s, "&c/dc tool give <player> <" + String.join("|", ids()) + ">"); return; }
        Player t = Bukkit.getPlayerExact(a[2]);
        ItemStack it = item(a[3]);
        if (t == null || it == null) { msg().send(s, "error.bad-args"); return; }
        List<ItemStack> left = Items.give(t, List.of(it));
        if (!left.isEmpty()) plugin.mailbox.addAll(t.getUniqueId(), left, "admin");
        msg().send(s, "admin.done");
    }
}
