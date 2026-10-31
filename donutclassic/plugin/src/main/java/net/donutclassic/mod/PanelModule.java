package net.donutclassic.mod;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Json;
import net.donutclassic.core.Ledger;
import net.donutclassic.util.Module;
import net.donutclassic.util.Platform;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;

/**
 * Writes read-only JSON snapshots to plugins/DonutClassic/panel/ for the mobile admin app. The app reads
 * them through exaroton's file API and sends actions (dcban, dcunban, ...) through exaroton's console API,
 * so no extra network port is needed. Snapshots are built on the main thread and written asynchronously.
 */
public final class PanelModule extends Module {
    private BukkitTask task;
    private volatile boolean dirty = true;
    private long lastWrite;

    public PanelModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "panel"; }

    @Override public void enable() { reload(); }
    @Override public void reload() {
        if (task != null) task.cancel();
        if (!cfg("config.yml").getBoolean("panel.enabled", true)) return;
        task = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            long every = cfg("config.yml").getLong("panel.interval-seconds", 30) * 1000L;
            if (dirty || System.currentTimeMillis() - lastWrite >= every) export();
        }, 100L, 100L);
    }
    @Override public void disable() { if (task != null) task.cancel(); }

    public void dirty() { dirty = true; }

    public void export() {
        dirty = false; lastWrite = System.currentTimeMillis();
        File dir = new File(plugin.getDataFolder(), "panel");
        // Main-thread snapshot of live state
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("generated", System.currentTimeMillis());
        status.put("server", Bukkit.getName() + " " + Bukkit.getBukkitVersion());
        status.put("plugin", plugin.getDescription().getVersion());
        status.put("preset", plugin.preset());
        double[] tps = Bukkit.getTPS();
        status.put("tps", Math.round(Math.min(20, tps[0]) * 10) / 10.0);
        status.put("maxPlayers", Bukkit.getMaxPlayers());
        List<Map<String, Object>> online = new ArrayList<>();
        for (Player p : Bukkit.getOnlinePlayers()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.getName()); m.put("uuid", p.getUniqueId().toString());
            m.put("bedrock", Platform.isBedrock(p));
            m.put("money", plugin.ledger().get(p.getUniqueId(), Ledger.MONEY));
            m.put("shards", plugin.ledger().get(p.getUniqueId(), Ledger.SHARDS));
            m.put("world", p.getWorld().getName());
            m.put("team", plugin.teams.teamName(p.getUniqueId()));
            m.put("violations", plugin.anticheat.violations(p.getUniqueId()));
            online.add(m);
        }
        status.put("online", online);
        Map<String, Object> ah = new LinkedHashMap<>();
        ah.put("generated", System.currentTimeMillis());
        ah.put("listings", plugin.auction.snapshot());
        Map<String, Object> orders = new LinkedHashMap<>();
        orders.put("generated", System.currentTimeMillis());
        orders.put("orders", plugin.orders.snapshot());
        write(dir, "status.json", status);
        write(dir, "ah.json", ah);
        write(dir, "orders.json", orders);
        // DB-backed files
        plugin.moderation.recent(300).thenAccept(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("generated", System.currentTimeMillis());
            List<Object> list = new ArrayList<>(); for (var p : l) list.add(p.json());
            m.put("punishments", list);
            writeNow(dir, "bans.json", m);
        });
        plugin.db().query(c -> {
            List<Object> out = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement("SELECT ts,name,check_name,vl,detail FROM alerts ORDER BY id DESC LIMIT 300");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> a = new LinkedHashMap<>();
                    a.put("ts", rs.getLong(1)); a.put("name", rs.getString(2)); a.put("check", rs.getString(3)); a.put("vl", rs.getDouble(4)); a.put("detail", rs.getString(5));
                    out.add(a);
                }
            }
            return out;
        }).thenAccept(l -> writeNow(dir, "alerts.json", Map.of("generated", System.currentTimeMillis(), "alerts", l)));
    }

    private void write(File dir, String name, Object data) {
        String json = Json.stringify(data);
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> writeText(dir, name, json));
    }

    private void writeNow(File dir, String name, Object data) { writeText(dir, name, Json.stringify(data)); }

    private void writeText(File dir, String name, String json) {
        try {
            dir.mkdirs();
            File tmp = new File(dir, name + ".tmp");
            Files.writeString(tmp.toPath(), json, StandardCharsets.UTF_8);
            Files.move(tmp.toPath(), new File(dir, name).toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (Exception e) {
            try { Files.writeString(new File(dir, name).toPath(), json, StandardCharsets.UTF_8); } catch (Exception ignored) { }
        }
    }
}
