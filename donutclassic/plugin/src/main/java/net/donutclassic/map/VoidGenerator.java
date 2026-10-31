package net.donutclassic.map;

import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.generator.ChunkGenerator;

import java.util.Random;

/** Generates nothing: an empty (void) world for the pasted spawn/AFK builds. */
public final class VoidGenerator extends ChunkGenerator {
    @Override public Location getFixedSpawnLocation(World world, Random random) { return new Location(world, 0.5, 100, 0.5); }
}
