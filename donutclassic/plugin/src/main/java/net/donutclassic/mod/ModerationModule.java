package net.donutclassic.mod;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.core.Rules;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Ban / tempban / IP-ban / mute / kick / warn with full history in SQLite.
 * Commands: /ban /tempban /ipban /unban /mute /unmute /kick /warn /history /banlist
 * (also as dcban, dcunban, ... so the mobile panel never hits vanilla commands).
 * Login checks run on Paper's async pre-login thread; nothing blocks the main thread.
 */
public final class ModerationModule extends Module {
    public record Punishment(long id, String uuid, String name, String ip, String type, String reason, String actor,
                             long created, long expires, boolean active, String removedBy, long removedAt) {
        public boolean expired() { return expires > 0 && expires <= System.currentTimeMillis(); }
        public Map<String, Object> json() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id); m.put("uuid", uuid); m.put("name", name); m.put("type", type); m.put("reason", reason);
            m.put("actor", actor); m.put("created", created); m.put("expires", expires);
            m.put("active", active && !expired()); m.put("removedBy", removedBy); m.put("removedAt", removedAt);
            return m;
        }
    }

    private final Map<UUID, Long> muted = new ConcurrentHashMap<>(); // uuid -> expires (0 = perm)

    public ModerationModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "moderation"; }

    @Override public void enable() {
        command("ban", (s, a) -> ban(s, a, "BAN", true));
        command("tempban", (s, a) -> ban(s, a, "BAN", true));
        command("ipban", (s, a) -> ban(s, a, "IPBAN", true));
        command("mute", (s, a) -> ban(s, a, "MUTE", true));
        command("warn", (s, a) -> ban(s, a, "WARN", false));
        command("kick", this::kick);
        command("unban", (s, a) -> pardon(s, a, "BAN", "IPBAN"));
        command("unmute", (s, a) -> pardon(s, a, "MUTE"));
        command("history", this::history);
        command("banlist", (s, a) -> {
            if (!perm(s, "dc.mod.ban")) return;
            activeList().thenAccept(l -> plugin.runSync(() -> {
                msg().sendRaw(s, "&c&lActive bans (" + l.stream().filter(p -> p.type().contains("BAN")).count() + ")");
                for (Punishment p : l) if (p.type().contains("BAN")) msg().sendRaw(s, "&f" + p.name() + " &7" + p.type() + " - " + p.reason()
                    + " &8(" + (p.expires() == 0 ? "permanent" : Rules.formatDuration(p.expires() - System.currentTimeMillis()) + " left") + ", by " + p.actor() + ")");
            }));
        });
    }

    // ------------------------------------------------------------------ commands
    /** /ban <player> [duration] [reason...]  (duration optional: 30m, 7d, perm) */
    private void ban(CommandSender s, String[] a, String type, boolean timed) {
        String node = switch (type) { case "MUTE" -> "dc.mod.mute"; case "WARN" -> "dc.mod.warn"; case "IPBAN" -> "dc.mod.ipban"; default -> "dc.mod.ban"; };
        if (!perm(s, node)) return;
        if (a.length < 1) { msg().sendRaw(s, "&c/" + type.toLowerCase(Locale.ROOT) + " <player> " + (timed ? "[30m|7d|perm] " : "") + "[reason]"); return; }
        long dur = 0; int reasonStart = 1;
        if (timed && a.length > 1) {
            long d = Rules.parseDuration(a[1]);
            if (d >= 0) { dur = d; reasonStart = 2; }
        }
        String reason = a.length > reasonStart ? String.join(" ", Arrays.copyOfRange(a, reasonStart, a.length)) : cfg("config.yml").getString("moderation.default-reason", "Breaking the rules");
        long expires = dur == 0 ? 0 : System.currentTimeMillis() + dur;
        String actor = s.getName();
        resolve(a[0], (uuid, name, ip) -> {
            if (uuid == null) { msg().send(s, "error.unknown-player"); return; }
            if (type.equals("IPBAN") && ip == null) { msg().sendRaw(s, "&cNo known IP for " + name + "."); return; }
            plugin.db().query(c -> Database.insert(c, "INSERT INTO punishments(uuid,name,ip,type,reason,actor,created,expires,active) VALUES(?,?,?,?,?,?,?,?,?)",
                uuid.toString(), name, ip, type, reason, actor, System.currentTimeMillis(), expires, type.equals("WARN") ? 0 : 1))
                .thenAccept(id -> plugin.runSync(() -> {
                    String until = expires == 0 ? "permanent" : Rules.formatDuration(expires - System.currentTimeMillis());
                    plugin.getLogger().info("[moderation] " + actor + " " + type + " " + name + " (" + until + "): " + reason);
                    staff("&c[Mod] &f" + actor + " &7" + type.toLowerCase(Locale.ROOT) + "ned &f" + name + " &7(" + until + "): " + reason);
                    Player online = Bukkit.getPlayer(uuid);
                    switch (type) {
                        case "BAN", "IPBAN" -> {
                            if (online != null) online.kickPlayer(screen(reason, expires, actor));
                            if (type.equals("IPBAN")) for (Player p : Bukkit.getOnlinePlayers())
                                if (p.getAddress() != null && ip.equals(p.getAddress().getAddress().getHostAddress())) p.kickPlayer(screen(reason, expires, actor));
                        }
                        case "MUTE" -> { muted.put(uuid, expires); if (online != null) msg().sendRaw(online, "&cYou were muted (" + until + "): " + reason); }
                        case "WARN" -> { if (online != null) msg().sendRaw(online, "&c&lWARNING &f" + reason); }
                        default -> { }
                    }
                    msg().sendRaw(s, "&a" + type + " applied to " + name + " (#" + id + ").");
                    if (plugin.panel != null) plugin.panel.dirty();
                }));
        });
    }

    private void kick(CommandSender s, String[] a) {
        if (!perm(s, "dc.mod.kick")) return;
        Player t = a.length > 0 ? Bukkit.getPlayerExact(a[0]) : null;
        if (t == null) { msg().send(s, "error.unknown-player"); return; }
        String reason = a.length > 1 ? String.join(" ", Arrays.copyOfRange(a, 1, a.length)) : "Kicked";
        String ip = t.getAddress() == null ? null : t.getAddress().getAddress().getHostAddress();
        plugin.db().query(c -> Database.insert(c, "INSERT INTO punishments(uuid,name,ip,type,reason,actor,created,expires,active) VALUES(?,?,?,?,?,?,?,0,0)",
            t.getUniqueId().toString(), t.getName(), ip, "KICK", reason, s.getName(), System.currentTimeMillis()));
        t.kickPlayer(Msg.color("&cKicked: &f" + reason));
        staff("&c[Mod] &f" + s.getName() + " &7kicked &f" + t.getName() + "&7: " + reason);
    }

    private void pardon(CommandSender s, String[] a, String... types) {
        if (!perm(s, types[0].equals("MUTE") ? "dc.mod.mute" : "dc.mod.ban")) return;
        if (a.length < 1) { msg().sendRaw(s, "&c/" + (types[0].equals("MUTE") ? "unmute" : "unban") + " <player>"); return; }
        resolve(a[0], (uuid, name, ip) -> {
            if (uuid == null) { msg().send(s, "error.unknown-player"); return; }
            String in = String.join(",", Collections.nCopies(types.length, "?"));
            List<Object> args = new ArrayList<>(List.of(s.getName(), System.currentTimeMillis(), uuid.toString()));
            args.addAll(Arrays.asList(types));
            plugin.db().query(c -> {
                try (PreparedStatement ps = c.prepareStatement("UPDATE punishments SET active=0, removed_by=?, removed_at=? WHERE uuid=? AND active=1 AND type IN (" + in + ")")) {
                    Database.bind(ps, args.toArray()); return ps.executeUpdate();
                }
            }).thenAccept(n -> plugin.runSync(() -> {
                if (types[0].equals("MUTE")) muted.remove(uuid);
                msg().sendRaw(s, n > 0 ? "&a" + name + " pardoned (" + n + " record(s))." : "&7" + name + " had nothing active.");
                if (n > 0) { staff("&a[Mod] &f" + s.getName() + " &7pardoned &f" + name); if (plugin.panel != null) plugin.panel.dirty(); }
            }));
        });
    }

    private void history(CommandSender s, String[] a) {
        if (!perm(s, "dc.mod.history") || a.length < 1) { if (a.length < 1) msg().sendRaw(s, "&c/history <player>"); return; }
        resolve(a[0], (uuid, name, ip) -> {
            if (uuid == null) { msg().send(s, "error.unknown-player"); return; }
            plugin.db().query(c -> list(c, "SELECT * FROM punishments WHERE uuid=? ORDER BY id DESC LIMIT 15", uuid.toString())).thenAccept(l -> plugin.runSync(() -> {
                msg().sendRaw(s, "&6&lHistory of " + name + " &7(" + l.size() + ")");
                for (Punishment p : l) msg().sendRaw(s, "&e#" + p.id() + " &f" + p.type() + (p.active() && !p.expired() ? " &c[ACTIVE]" : "") + " &7" + p.reason() + " &8by " + p.actor()
                    + " " + new java.text.SimpleDateFormat("yyyy-MM-dd").format(new Date(p.created())));
            }));
        });
    }

    private void staff(String text) {
        for (Player p : Bukkit.getOnlinePlayers()) if (p.hasPermission("dc.staff")) p.sendMessage(Msg.color(text));
    }

    private String screen(String reason, long expires, String actor) {
        return Msg.color("&c&lYou are banned\n\n&7Reason: &f" + reason + "\n&7" + (expires == 0 ? "Duration: &fpermanent" : "Expires in: &f" + Rules.formatDuration(expires - System.currentTimeMillis()))
            + "\n&7By: &f" + actor + "\n\n&8" + cfg("config.yml").getString("moderation.appeal-text", "Appeal on our Discord."));
    }

    // ------------------------------------------------------------------ data
    interface Resolved { void accept(UUID uuid, String name, String ip); }

    /** Online player first, else the accounts table (works for offline players who joined before). */
    private void resolve(String name, Resolved cb) {
        Player p = Bukkit.getPlayerExact(name);
        if (p != null) { cb.accept(p.getUniqueId(), p.getName(), p.getAddress() == null ? null : p.getAddress().getAddress().getHostAddress()); return; }
        plugin.db().query(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT uuid,name,last_ip FROM accounts WHERE name=? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1")) {
                ps.setString(1, name);
                try (ResultSet rs = ps.executeQuery()) { return rs.next() ? new String[]{rs.getString(1), rs.getString(2), rs.getString(3)} : null; }
            }
        }).thenAccept(r -> plugin.runSync(() -> cb.accept(r == null ? null : UUID.fromString(r[0]), r == null ? name : r[1], r == null ? null : r[2])));
    }

    static List<Punishment> list(java.sql.Connection c, String sql, Object... args) throws java.sql.SQLException {
        List<Punishment> out = new ArrayList<>();
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            Database.bind(ps, args);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) out.add(new Punishment(rs.getLong("id"), rs.getString("uuid"), rs.getString("name"), rs.getString("ip"), rs.getString("type"),
                    rs.getString("reason"), rs.getString("actor"), rs.getLong("created"), rs.getLong("expires"), rs.getInt("active") == 1,
                    rs.getString("removed_by"), rs.getLong("removed_at")));
            }
        }
        return out;
    }

    public java.util.concurrent.CompletableFuture<List<Punishment>> activeList() {
        long now = System.currentTimeMillis();
        return plugin.db().query(c -> list(c, "SELECT * FROM punishments WHERE active=1 AND (expires=0 OR expires>?) ORDER BY id DESC", now));
    }

    public java.util.concurrent.CompletableFuture<List<Punishment>> recent(int limit) {
        return plugin.db().query(c -> list(c, "SELECT * FROM punishments ORDER BY id DESC LIMIT ?", limit));
    }

    // ------------------------------------------------------------------ enforcement
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onPreLogin(AsyncPlayerPreLoginEvent e) {
        String ip = e.getAddress() == null ? null : e.getAddress().getHostAddress();
        long now = System.currentTimeMillis();
        try {
            List<Punishment> l = plugin.db().query(c -> list(c,
                "SELECT * FROM punishments WHERE active=1 AND (expires=0 OR expires>?) AND ((uuid=? AND type IN ('BAN','MUTE')) OR (ip=? AND type='IPBAN'))",
                now, e.getUniqueId().toString(), ip)).get(5, TimeUnit.SECONDS);
            for (Punishment p : l) {
                if (p.type().equals("MUTE")) { muted.put(e.getUniqueId(), p.expires()); continue; }
                e.disallow(AsyncPlayerPreLoginEvent.Result.KICK_BANNED, screen(p.reason(), p.expires(), p.actor()));
                return;
            }
        } catch (Exception ex) {
            plugin.getLogger().warning("Ban check failed for " + e.getName() + ": " + ex);
            if (cfg("config.yml").getBoolean("moderation.deny-login-on-error", false))
                e.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER, Msg.color("&cPlease try again in a moment."));
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent e) {
        Long until = muted.get(e.getPlayer().getUniqueId());
        if (until == null) return;
        if (until != 0 && until <= System.currentTimeMillis()) { muted.remove(e.getPlayer().getUniqueId()); return; }
        e.setCancelled(true);
        e.getPlayer().sendMessage(Msg.color("&cYou are muted" + (until == 0 ? "." : " for " + Rules.formatDuration(until - System.currentTimeMillis()) + ".")));
    }

    @EventHandler public void onQuit(PlayerQuitEvent e) { muted.remove(e.getPlayer().getUniqueId()); }

    /** Records an anticheat/x-ray alert (shown in the mobile panel). */
    public void alert(Player p, String check, double vl, String detail) {
        plugin.db().query(c -> { Database.exec(c, "INSERT INTO alerts(ts,uuid,name,check_name,vl,detail) VALUES(?,?,?,?,?,?)",
            System.currentTimeMillis(), p.getUniqueId().toString(), p.getName(), check, vl, detail); return null; });
        staff("&4[AC] &f" + p.getName() + " &7failed &c" + check + " &7(VL " + String.format(Locale.ROOT, "%.1f", vl) + ") &8" + detail);
        if (plugin.panel != null) plugin.panel.dirty();
    }
}
