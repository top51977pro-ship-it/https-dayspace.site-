package net.donutclassic.board;

import net.donutclassic.DonutClassic;
import net.donutclassic.core.Ledger;
import net.donutclassic.core.Money;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.scoreboard.*;

import java.util.*;

/** Vanilla sidebar (no ProtocolLib) so Geyser renders it for Bedrock. Lines are team prefixes -> no flicker. */
public final class BoardModule extends Module {
    private final Map<UUID, Scoreboard> boards = new HashMap<>();
    private BukkitTask task;
    private static final ChatColor[] KEYS = ChatColor.values();

    public BoardModule(DonutClassic plugin) { super(plugin); }
    @Override public String name() { return "scoreboard"; }

    @Override public void enable() { reload(); }
    @Override public void reload() {
        if (task != null) task.cancel();
        long every = Math.max(10, cfg("config.yml").getLong("scoreboard.refresh-ticks", 40));
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::refreshAll, every, every);
    }
    @Override public void disable() { if (task != null) task.cancel(); }

    @EventHandler public void onQuit(PlayerQuitEvent e) { boards.remove(e.getPlayer().getUniqueId()); }

    private void refreshAll() {
        if (!cfg("config.yml").getBoolean("scoreboard.enabled", true)) return;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (!plugin.ledger().isLoaded(p.getUniqueId())) continue;
            if (!plugin.misc.setting(p.getUniqueId(), "scoreboard", true)) {
                if (boards.remove(p.getUniqueId()) != null) p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
                continue;
            }
            update(p);
        }
    }

    @SuppressWarnings("deprecation")
    private void update(Player p) {
        Scoreboard sb = boards.get(p.getUniqueId());
        if (sb == null || p.getScoreboard() != sb) {
            sb = Bukkit.getScoreboardManager().getNewScoreboard();
            Objective o = sb.registerNewObjective("dc", Criteria.DUMMY, Msg.color(cfg("config.yml").getString("scoreboard.title", "&b&lDonutClassic")));
            o.setDisplaySlot(DisplaySlot.SIDEBAR);
            boards.put(p.getUniqueId(), sb);
            p.setScoreboard(sb);
        }
        Objective o = sb.getObjective("dc");
        List<String> lines = cfg("config.yml").getStringList("scoreboard.lines");
        int n = Math.min(lines.size(), 15);
        for (int i = 0; i < 15; i++) {
            String entry = KEYS[i].toString() + ChatColor.RESET;
            Team t = sb.getTeam("l" + i);
            if (i >= n) { if (t != null) { sb.resetScores(entry); t.unregister(); } continue; }
            if (t == null) { t = sb.registerNewTeam("l" + i); t.addEntry(entry); }
            String text = Msg.color(fill(p, lines.get(i)));
            if (text.length() > 64) text = text.substring(0, 64);
            t.setPrefix(text);
            o.getScore(entry).setScore(n - i);
        }
    }

    private String fill(Player p, String s) {
        UUID id = p.getUniqueId();
        long[] st = plugin.misc.stats(id);
        String team = plugin.teams.teamName(id);
        long keyMs = plugin.crates.keyAllRemainingMs();
        long tag = plugin.duels.tagRemaining(id);
        return s.replace("{money}", Money.format(plugin.ledger().get(id, Ledger.MONEY)))
            .replace("{shards}", Money.formatWhole(plugin.ledger().get(id, Ledger.SHARDS)))
            .replace("{kills}", String.valueOf(st[0])).replace("{deaths}", String.valueOf(st[1]))
            .replace("{playtime}", plugin.misc.formatTime(st[2]))
            .replace("{team}", team == null ? "-" : team)
            .replace("{keyall}", plugin.crates.keyAllEnabled() ? String.format(Locale.ROOT, "%02d:%02d", keyMs / 60000, keyMs / 1000 % 60) : "-")
            .replace("{combat}", tag > 0 ? (tag / 1000 + "s") : "-")
            .replace("{player}", p.getName())
            .replace("{online}", String.valueOf(Bukkit.getOnlinePlayers().size()));
    }
}
