package net.donutclassic.util;

import net.donutclassic.DonutClassic;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.Listener;

import java.util.*;
import java.util.logging.Level;

/** Base class for every feature module: lifecycle, command registration and helpers. */
public abstract class Module implements Listener {
    protected final DonutClassic plugin;
    protected Module(DonutClassic plugin) { this.plugin = plugin; }

    public abstract String name();
    public void enable() { }
    public void disable() { }
    public void reload() { }
    /** Called on the main thread once the joining player's ledger is loaded. */
    public void onDataLoaded(Player p) { }

    @FunctionalInterface public interface Handler { void handle(CommandSender s, String[] a) throws Exception; }
    @FunctionalInterface public interface Completer { List<String> complete(CommandSender s, String[] a); }

    protected void command(String name, Handler h) { command(name, h, null); }

    protected void command(String name, Handler h, Completer c) {
        PluginCommand pc = plugin.getCommand(name);
        if (pc == null) { plugin.getLogger().warning("Command not in plugin.yml: " + name); return; }
        pc.setExecutor((sender, cmd, label, args) -> {
            try { h.handle(sender, args); }
            catch (Exception ex) {
                plugin.getLogger().log(Level.SEVERE, "Error in /" + name, ex);
                msg().send(sender, "error.internal");
            }
            return true;
        });
        pc.setTabCompleter((sender, cmd, label, args) -> {
            List<String> out = c != null ? c.complete(sender, args) : null;
            if (out == null) out = players();
            String last = args.length == 0 ? "" : args[args.length - 1].toLowerCase(Locale.ROOT);
            List<String> filtered = new ArrayList<>();
            for (String s : out) if (s.toLowerCase(Locale.ROOT).startsWith(last)) filtered.add(s);
            return filtered;
        });
    }

    protected static List<String> players() {
        List<String> l = new ArrayList<>();
        for (Player p : Bukkit.getOnlinePlayers()) l.add(p.getName());
        return l;
    }

    protected Msg msg() { return plugin.msg(); }
    protected YamlConfiguration cfg(String file) { return plugin.cfg(file); }

    /** Returns the player or sends "player only" and returns null. */
    protected Player player(CommandSender s) {
        if (s instanceof Player p) return p;
        msg().send(s, "error.player-only");
        return null;
    }

    protected boolean perm(CommandSender s, String node) {
        if (s.hasPermission(node)) return true;
        msg().send(s, "error.no-permission");
        return false;
    }
}
