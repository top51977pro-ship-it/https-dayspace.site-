package net.donutclassic.team;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Database;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;

import java.sql.ResultSet;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** /team create|invite|join|leave|disband|kick|home|sethome|chat|info|transfer|promote|demote|ff. Max 50 (configurable). */
public final class TeamModule extends Module {
    public static final class Team {
        public String name; public UUID leader; public boolean friendlyFire; public String home;
        public final Map<UUID, String> members = new LinkedHashMap<>(); // uuid -> LEADER/OFFICER/MEMBER
    }

    private final Map<String, Team> teams = new HashMap<>();             // lower-case name
    private final Map<UUID, Team> byMember = new ConcurrentHashMap<>();   // read from async chat
    private final Map<UUID, Map<String, Long>> invites = new HashMap<>(); // invitee -> team -> expiry
    private final Set<UUID> chatToggle = ConcurrentHashMap.newKeySet();

    public TeamModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "teams"; }
    private YamlConfiguration y() { return cfg("teams.yml"); }

    @Override public void enable() {
        plugin.db().query(c -> {
            Map<String, Team> m = new HashMap<>();
            try (ResultSet rs = c.createStatement().executeQuery("SELECT name,leader,friendly_fire,home FROM teams")) {
                while (rs.next()) {
                    Team t = new Team();
                    t.name = rs.getString(1); t.leader = UUID.fromString(rs.getString(2)); t.friendlyFire = rs.getInt(3) == 1; t.home = rs.getString(4);
                    m.put(t.name.toLowerCase(Locale.ROOT), t);
                }
            }
            try (ResultSet rs = c.createStatement().executeQuery("SELECT uuid,team,role FROM team_members ORDER BY joined")) {
                while (rs.next()) { Team t = m.get(rs.getString(2).toLowerCase(Locale.ROOT)); if (t != null) t.members.put(UUID.fromString(rs.getString(1)), rs.getString(3)); }
            }
            return m;
        }).thenAccept(m -> plugin.runSync(() -> {
            teams.putAll(m);
            for (Team t : m.values()) for (UUID u : t.members.keySet()) byMember.put(u, t);
        }));
        command("team", this::cmd, (s, a) -> a.length == 1 ? List.of("create", "invite", "join", "leave", "disband", "kick", "home", "sethome",
            "chat", "info", "transfer", "promote", "demote", "ff") : null);
    }

    public Team teamOf(UUID id) { return byMember.get(id); }
    public boolean sameTeam(UUID a, UUID b) { Team t = byMember.get(a); return t != null && t == byMember.get(b); }
    public String teamName(UUID id) { Team t = byMember.get(id); return t == null ? null : t.name; }

    private boolean can(Team t, UUID id, String action) {
        String role = t.members.get(id);
        if (role == null) return false;
        if (role.equals("LEADER")) return true;
        return y().getStringList("permissions." + role.toLowerCase(Locale.ROOT)).contains(action);
    }

    private void cmd(CommandSender s, String[] a) {
        Player p = player(s); if (p == null) return;
        String sub = a.length == 0 ? "info" : a[0].toLowerCase(Locale.ROOT);
        Team t = teamOf(p.getUniqueId());
        switch (sub) {
            case "create" -> {
                if (a.length < 2) { msg().sendRaw(p, "&c/team create <name>"); return; }
                if (t != null) { msg().send(p, "team.already"); return; }
                String name = a[1];
                if (!name.matches(y().getString("name-regex", "[A-Za-z0-9_]{3,16}"))) { msg().send(p, "team.bad-name"); return; }
                if (teams.containsKey(name.toLowerCase(Locale.ROOT))) { msg().send(p, "team.exists"); return; }
                Team n = new Team(); n.name = name; n.leader = p.getUniqueId(); n.friendlyFire = y().getBoolean("friendly-fire-default", false);
                n.members.put(p.getUniqueId(), "LEADER");
                teams.put(name.toLowerCase(Locale.ROOT), n); byMember.put(p.getUniqueId(), n);
                long now = System.currentTimeMillis();
                plugin.db().tx(c -> {
                    Database.exec(c, "INSERT INTO teams(name,leader,created,friendly_fire) VALUES(?,?,?,?)", name, p.getUniqueId().toString(), now, n.friendlyFire ? 1 : 0);
                    Database.exec(c, "INSERT OR REPLACE INTO team_members(uuid,team,role,joined) VALUES(?,?,?,?)", p.getUniqueId().toString(), name, "LEADER", now);
                    return null;
                });
                msg().send(p, "team.created", "team", name);
            }
            case "invite" -> {
                if (t == null) { msg().send(p, "team.none"); return; }
                if (!can(t, p.getUniqueId(), "invite")) { msg().send(p, "team.no-perm"); return; }
                Player target = a.length > 1 ? Bukkit.getPlayerExact(a[1]) : null;
                if (target == null) { msg().send(p, "error.unknown-player"); return; }
                if (teamOf(target.getUniqueId()) != null) { msg().send(p, "team.target-has-team"); return; }
                if (t.members.size() >= y().getInt("max-members", 50)) { msg().send(p, "team.full", "max", y().getInt("max-members", 50)); return; }
                invites.computeIfAbsent(target.getUniqueId(), k -> new HashMap<>()).put(t.name.toLowerCase(Locale.ROOT), System.currentTimeMillis() + 300_000);
                msg().send(p, "team.invited", "player", target.getName());
                msg().send(target, "team.invite-received", "team", t.name, "player", p.getName());
            }
            case "join" -> {
                if (t != null) { msg().send(p, "team.already"); return; }
                if (a.length < 2) { msg().sendRaw(p, "&c/team join <inviter or team>"); return; }
                Team target = teams.get(a[1].toLowerCase(Locale.ROOT));
                Player inviter = Bukkit.getPlayerExact(a[1]);
                if (target == null && inviter != null) target = teamOf(inviter.getUniqueId());
                Map<String, Long> inv = invites.getOrDefault(p.getUniqueId(), Map.of());
                if (target == null || inv.getOrDefault(target.name.toLowerCase(Locale.ROOT), 0L) < System.currentTimeMillis()) { msg().send(p, "team.no-invite"); return; }
                if (target.members.size() >= y().getInt("max-members", 50)) { msg().send(p, "team.full", "max", y().getInt("max-members", 50)); return; }
                invites.remove(p.getUniqueId());
                target.members.put(p.getUniqueId(), "MEMBER"); byMember.put(p.getUniqueId(), target);
                final String tn = target.name;
                plugin.db().query(c -> { Database.exec(c, "INSERT OR REPLACE INTO team_members(uuid,team,role,joined) VALUES(?,?,?,?)", p.getUniqueId().toString(), tn, "MEMBER", System.currentTimeMillis()); return null; });
                broadcast(target, msg().get("team.joined", "player", p.getName()));
            }
            case "leave" -> {
                if (t == null) { msg().send(p, "team.none"); return; }
                if (t.leader.equals(p.getUniqueId())) { msg().send(p, "team.leader-cannot-leave"); return; }
                removeMember(t, p.getUniqueId());
                msg().send(p, "team.left", "team", t.name);
                broadcast(t, msg().get("team.member-left", "player", p.getName()));
            }
            case "kick" -> {
                if (t == null) { msg().send(p, "team.none"); return; }
                if (!can(t, p.getUniqueId(), "kick") || a.length < 2) { msg().send(p, "team.no-perm"); return; }
                UUID target = member(t, a[1]);
                if (target == null || target.equals(t.leader) || target.equals(p.getUniqueId())) { msg().send(p, "error.unknown-player"); return; }
                if ("OFFICER".equals(t.members.get(target)) && !t.leader.equals(p.getUniqueId())) { msg().send(p, "team.no-perm"); return; }
                removeMember(t, target);
                broadcast(t, msg().get("team.kicked", "player", a[1]));
                Player tp = Bukkit.getPlayer(target); if (tp != null) msg().send(tp, "team.you-were-kicked", "team", t.name);
            }
            case "disband" -> {
                if (t == null || !t.leader.equals(p.getUniqueId())) { msg().send(p, "team.no-perm"); return; }
                broadcast(t, msg().get("team.disbanded", "team", t.name));
                for (UUID u : t.members.keySet()) { byMember.remove(u); chatToggle.remove(u); }
                teams.remove(t.name.toLowerCase(Locale.ROOT));
                plugin.db().tx(c -> { Database.exec(c, "DELETE FROM team_members WHERE team=?", t.name); Database.exec(c, "DELETE FROM teams WHERE name=?", t.name); return null; });
            }
            case "sethome" -> {
                if (t == null || !can(t, p.getUniqueId(), "sethome")) { msg().send(p, "team.no-perm"); return; }
                if (plugin.region.inSpawn(p.getLocation())) { msg().send(p, "team.no-home-here"); return; }
                t.home = Locs.serialize(p.getLocation());
                plugin.db().query(c -> { Database.exec(c, "UPDATE teams SET home=? WHERE name=?", t.home, t.name); return null; });
                msg().send(p, "team.home-set");
            }
            case "home" -> {
                if (t == null || !can(t, p.getUniqueId(), "home")) { msg().send(p, "team.no-perm"); return; }
                Location l = Locs.deserialize(t.home);
                if (l == null) { msg().send(p, "team.no-home"); return; }
                plugin.teleport.warmup(p, l, "team home");
            }
            case "chat", "c" -> {
                if (t == null) { msg().send(p, "team.none"); return; }
                if (a.length > 1) { teamChat(p, t, String.join(" ", Arrays.copyOfRange(a, 1, a.length))); return; }
                if (!chatToggle.remove(p.getUniqueId())) { chatToggle.add(p.getUniqueId()); msg().send(p, "team.chat-on"); } else msg().send(p, "team.chat-off");
            }
            case "transfer" -> {
                if (t == null || !t.leader.equals(p.getUniqueId()) || a.length < 2) { msg().send(p, "team.no-perm"); return; }
                UUID target = member(t, a[1]);
                if (target == null || target.equals(p.getUniqueId())) { msg().send(p, "error.unknown-player"); return; }
                t.members.put(p.getUniqueId(), "OFFICER"); t.members.put(target, "LEADER"); t.leader = target;
                plugin.db().tx(c -> {
                    Database.exec(c, "UPDATE teams SET leader=? WHERE name=?", target.toString(), t.name);
                    Database.exec(c, "UPDATE team_members SET role='OFFICER' WHERE uuid=?", p.getUniqueId().toString());
                    Database.exec(c, "UPDATE team_members SET role='LEADER' WHERE uuid=?", target.toString());
                    return null;
                });
                broadcast(t, msg().get("team.transferred", "player", a[1]));
            }
            case "promote", "demote" -> {
                if (t == null || !t.leader.equals(p.getUniqueId()) || a.length < 2) { msg().send(p, "team.no-perm"); return; }
                UUID target = member(t, a[1]);
                if (target == null || target.equals(t.leader)) { msg().send(p, "error.unknown-player"); return; }
                String role = sub.equals("promote") ? "OFFICER" : "MEMBER";
                t.members.put(target, role);
                plugin.db().query(c -> { Database.exec(c, "UPDATE team_members SET role=? WHERE uuid=?", role, target.toString()); return null; });
                broadcast(t, msg().get("team.role", "player", a[1], "role", role));
            }
            case "ff", "friendlyfire" -> {
                if (t == null || !t.leader.equals(p.getUniqueId())) { msg().send(p, "team.no-perm"); return; }
                t.friendlyFire = !t.friendlyFire;
                plugin.db().query(c -> { Database.exec(c, "UPDATE teams SET friendly_fire=? WHERE name=?", t.friendlyFire ? 1 : 0, t.name); return null; });
                broadcast(t, msg().get("team.ff", "state", t.friendlyFire ? "ON" : "OFF"));
            }
            default -> info(p, a.length > 1 ? teams.get(a[1].toLowerCase(Locale.ROOT)) : t);
        }
    }

    private UUID member(Team t, String name) {
        for (UUID u : t.members.keySet()) { OfflinePlayer op = Bukkit.getOfflinePlayer(u); if (name.equalsIgnoreCase(op.getName())) return u; }
        return null;
    }

    private void removeMember(Team t, UUID id) {
        t.members.remove(id); byMember.remove(id); chatToggle.remove(id);
        plugin.db().query(c -> { Database.exec(c, "DELETE FROM team_members WHERE uuid=?", id.toString()); return null; });
    }

    private void info(Player p, Team t) {
        if (t == null) { msg().send(p, "team.none"); msg().sendRaw(p, "&7/team create <name> | /team join <inviter>"); return; }
        msg().sendRaw(p, "&6&lTeam " + t.name + " &7(" + t.members.size() + "/" + y().getInt("max-members", 50) + ") &7FF: " + (t.friendlyFire ? "&cON" : "&aOFF"));
        StringBuilder sb = new StringBuilder();
        for (var e : t.members.entrySet()) {
            OfflinePlayer op = Bukkit.getOfflinePlayer(e.getKey());
            sb.append(op.isOnline() ? "&a" : "&7").append(op.getName()).append(e.getValue().equals("LEADER") ? "&6*" : e.getValue().equals("OFFICER") ? "&e+" : "").append("&8, ");
        }
        msg().sendRaw(p, sb.toString());
    }

    private void broadcast(Team t, String text) {
        for (UUID u : t.members.keySet()) { Player m = Bukkit.getPlayer(u); if (m != null) m.sendMessage(Msg.color(msg().raw("prefix")) + text); }
    }

    private void teamChat(Player p, Team t, String message) {
        if (!can(t, p.getUniqueId(), "chat")) { msg().send(p, "team.no-perm"); return; }
        String line = Msg.color(Msg.fill(y().getString("chat-format", "&b[Team] &f{player}&7: &f{message}"), "player", p.getName())).replace("{message}", message);
        for (UUID u : t.members.keySet()) { Player m = Bukkit.getPlayer(u); if (m != null) m.sendMessage(line); }
    }

    @EventHandler(priority = EventPriority.LOW, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent e) {
        if (!chatToggle.contains(e.getPlayer().getUniqueId())) return;
        Team t = teamOf(e.getPlayer().getUniqueId());
        if (t == null) return;
        e.setCancelled(true);
        String m = e.getMessage();
        plugin.runSync(() -> teamChat(e.getPlayer(), t, m));
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onFriendlyFire(EntityDamageByEntityEvent e) {
        if (!(e.getEntity() instanceof Player victim)) return;
        Entity d = e.getDamager();
        if (d instanceof Projectile pr && pr.getShooter() instanceof Entity sh) d = sh;
        if (!(d instanceof Player attacker) || attacker.equals(victim)) return;
        if (plugin.duels.inDuel(victim.getUniqueId())) return;
        Team t = teamOf(attacker.getUniqueId());
        if (t != null && !t.friendlyFire && t == teamOf(victim.getUniqueId())) e.setCancelled(true);
    }
}
