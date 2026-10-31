package net.donutclassic.menu;

import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Read-only chest menu. Every click/drag/shift-click touching the menu is cancelled by MenuListener;
 * actions only fire for clicks inside the top inventory, debounced per player. Works the same on Java
 * and Bedrock (Geyser translates touch taps into clicks).
 */
public class Menu implements InventoryHolder {
    private final Inventory inv;
    private final Map<Integer, Consumer<InventoryClickEvent>> actions = new HashMap<>();
    private Runnable onClose;

    public Menu(int rows, String title) {
        this.inv = Bukkit.createInventory(this, Math.max(1, Math.min(6, rows)) * 9, Msg.color(title));
    }

    public Menu set(int slot, ItemStack item, Consumer<InventoryClickEvent> action) {
        if (slot < 0 || slot >= inv.getSize()) return this;
        inv.setItem(slot, item);
        if (action == null) actions.remove(slot); else actions.put(slot, action);
        return this;
    }

    public Menu set(int slot, ItemStack item) { return set(slot, item, null); }

    public void clear() { inv.clear(); actions.clear(); }
    public Menu onClose(Runnable r) { this.onClose = r; return this; }
    Runnable onClose() { return onClose; }
    Consumer<InventoryClickEvent> action(int slot) { return actions.get(slot); }
    public int size() { return inv.getSize(); }

    public void open(Player p) { p.openInventory(inv); }

    /** Opens next tick (required when switching menus from inside a click handler). */
    public void openLater(Plugin plugin, Player p) { Bukkit.getScheduler().runTask(plugin, () -> { if (p.isOnline()) open(p); }); }

    @Override public Inventory getInventory() { return inv; }
}
