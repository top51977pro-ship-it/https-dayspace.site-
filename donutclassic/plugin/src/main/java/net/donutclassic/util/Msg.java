package net.donutclassic.util;

import net.donutclassic.DonutClassic;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.ChatColor;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Locale messages (messages_<lang>.yml) with English fallback; & colour codes, {placeholder} pairs. */
public final class Msg {
    private final DonutClassic plugin;
    private YamlConfiguration lang, en, enJar;

    public Msg(DonutClassic plugin) { this.plugin = plugin; reload(); }

    public void reload() {
        String l = plugin.cfg().getString("locale", "en");
        lang = plugin.cfg("messages_" + l + ".yml");
        java.io.File custom = new java.io.File(plugin.getDataFolder(), "messages_" + l + ".yml");
        if (lang == null && custom.exists()) lang = YamlConfiguration.loadConfiguration(custom);
        en = plugin.cfg("messages_en.yml");
        var res = plugin.getResource("messages_en.yml");
        enJar = res == null ? new YamlConfiguration() : YamlConfiguration.loadConfiguration(new InputStreamReader(res, StandardCharsets.UTF_8));
        if (lang == null) lang = en;
    }

    public String raw(String key) {
        String s = lang.getString(key);
        if (s == null) s = en.getString(key);
        if (s == null) s = enJar.getString(key);
        return s == null ? key : s;
    }

    public String get(String key, Object... kv) { return color(fill(raw(key), kv)); }

    public List<String> list(String key, Object... kv) {
        List<String> l = lang.getStringList(key);
        if (l.isEmpty()) l = en.getStringList(key);
        if (l.isEmpty()) l = enJar.getStringList(key);
        List<String> out = new ArrayList<>();
        for (String s : l) out.add(color(fill(s, kv)));
        return out;
    }

    public void send(CommandSender s, String key, Object... kv) {
        String m = raw(key);
        if (m.isEmpty()) return;
        s.sendMessage(color(raw("prefix") + fill(m, kv)));
    }

    public void sendRaw(CommandSender s, String text) { s.sendMessage(color(text)); }

    public void actionBar(Player p, String text) {
        p.sendActionBar(LegacyComponentSerializer.legacySection().deserialize(color(text)));
    }

    public static String fill(String s, Object... kv) {
        for (int i = 0; i + 1 < kv.length; i += 2) s = s.replace("{" + kv[i] + "}", String.valueOf(kv[i + 1]));
        return s;
    }

    public static String color(String s) { return s == null ? "" : ChatColor.translateAlternateColorCodes('&', s); }
    public static String strip(String s) { return ChatColor.stripColor(color(s)); }
}
