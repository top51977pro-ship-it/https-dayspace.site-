package net.donutclassic.menu;

import net.donutclassic.DonutClassic;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.Inventory;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.logging.Level;

public final class MenuListener implements Listener {
    private final DonutClassic plugin;
    private final Map<UUID, Long> lastClick = new HashMap<>();

    public MenuListener(DonutClassic plugin) { this.plugin = plugin; }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onClick(InventoryClickEvent e) {
        Inventory top = e.getView().getTopInventory();
        if (!(top.getHolder() instanceof Menu menu)) return;
        e.setCancelled(true); // covers shift-click, number keys, double-click collect, offhand swap
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (e.getClickedInventory() == null || e.getClickedInventory() != top) return;
        Consumer<InventoryClickEvent> action = menu.action(e.getRawSlot());
        if (action == null) return;
        long now = System.currentTimeMillis();
        long debounce = plugin.cfg().getLong("menus.click-debounce-ms", 250);
        Long prev = lastClick.get(p.getUniqueId());
        if (prev != null && now - prev < debounce) return; // double-click / Bedrock double-tap guard
        lastClick.put(p.getUniqueId(), now);
        try { action.accept(e); }
        catch (Exception ex) { plugin.getLogger().log(Level.SEVERE, "Menu action failed", ex); p.closeInventory(); }
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onDrag(InventoryDragEvent e) {
        if (e.getView().getTopInventory().getHolder() instanceof Menu) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onClose(InventoryCloseEvent e) {
        if (e.getInventory().getHolder() instanceof Menu menu && menu.onClose() != null) {
            try { menu.onClose().run(); } catch (Exception ex) { plugin.getLogger().log(Level.SEVERE, "Menu close failed", ex); }
        }
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) { lastClick.remove(e.getPlayer().getUniqueId()); }
}
