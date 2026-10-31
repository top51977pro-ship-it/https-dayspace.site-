package net.donutclassic.spawner;

import net.donutclassic.core.SpawnerMath;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.EntityType;

import java.util.*;

/** One configured virtual spawner type (spawners.yml -> types.<ID>). */
public record SpawnerType(String id, String display, EntityType entity, Material icon, boolean enabled,
                          List<SpawnerMath.Drop> drops, double xpPerMinute, long shardPrice) {

    static SpawnerType load(String id, ConfigurationSection s) {
        EntityType et;
        try { et = EntityType.valueOf(s.getString("entity", id).toUpperCase(Locale.ROOT)); } catch (IllegalArgumentException e) { et = EntityType.PIG; }
        Material icon = Material.matchMaterial(s.getString("icon", "SPAWNER"));
        List<SpawnerMath.Drop> drops = new ArrayList<>();
        ConfigurationSection d = s.getConfigurationSection("drops");
        if (d != null) for (String k : d.getKeys(false)) {
            Material m = Material.matchMaterial(k);
            if (m != null) drops.add(new SpawnerMath.Drop(m.name(), Math.max(0, d.getDouble(k))));
        }
        return new SpawnerType(id.toUpperCase(Locale.ROOT), s.getString("display", "&e" + id + " Spawner"), et,
            icon == null ? Material.SPAWNER : icon, s.getBoolean("enabled", true), List.copyOf(drops),
            Math.max(0, s.getDouble("xp-per-minute", 0)), Math.max(0, s.getLong("shard-price", 1500)));
    }
}
