package net.donutclassic;

import net.donutclassic.admin.AdminModule;
import net.donutclassic.auction.AuctionModule;
import net.donutclassic.auction.OrderModule;
import net.donutclassic.board.BoardModule;
import net.donutclassic.core.Database;
import net.donutclassic.core.Ledger;
import net.donutclassic.crates.CrateModule;
import net.donutclassic.duel.DuelModule;
import net.donutclassic.economy.EconomyModule;
import net.donutclassic.economy.Mailbox;
import net.donutclassic.map.MapModule;
import net.donutclassic.mod.AntiCheatModule;
import net.donutclassic.mod.ModerationModule;
import net.donutclassic.mod.PanelModule;
import net.donutclassic.menu.MenuListener;
import net.donutclassic.misc.MiscModule;
import net.donutclassic.region.RegionModule;
import net.donutclassic.shards.ShardModule;
import net.donutclassic.spawner.SpawnerModule;
import net.donutclassic.team.TeamModule;
import net.donutclassic.teleport.TeleportModule;
import net.donutclassic.tools.ToolModule;
import net.donutclassic.util.Locs;
import net.donutclassic.util.Module;
import net.donutclassic.util.Msg;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.*;
import java.util.logging.Level;

public final class DonutClassic extends JavaPlugin implements Listener {
    public static final String[] CONFIG_FILES = {"config.yml", "spawners.yml", "crate-rewards.yml", "shards.yml", "economy.yml",
        "shop.yml", "prices.yml", "warps.yml", "duels.yml", "teams.yml", "messages_en.yml", "permissions.yml",
        "presets/classic-early.yml", "presets/feb-2026.yml", "presets/post-2026.yml"};

    private final Map<String, YamlConfiguration> configs = new HashMap<>();
    private final List<Module> modules = new ArrayList<>();
    private Database db;
    private Ledger ledger;
    private Msg msg;
    private Locs locs;

    public SpawnerModule spawners; public ShardModule shards; public CrateModule crates; public EconomyModule economy;
    public Mailbox mailbox; public AuctionModule auction; public OrderModule orders; public TeamModule teams;
    public TeleportModule teleport; public DuelModule duels; public ToolModule tools; public BoardModule board;
    public MiscModule misc; public RegionModule region; public MapModule maps;
    public ModerationModule moderation; public AntiCheatModule anticheat; public PanelModule panel;

    @Override public void onEnable() {
        for (String f : CONFIG_FILES) if (!new File(getDataFolder(), f).exists()) saveResource(f, false);
        loadConfigs();
        db = new Database(new File(getDataFolder(), "data.db"), getLogger());
        ledger = new Ledger(db, this::runSync);
        net.donutclassic.util.Items.init(this);
        msg = new Msg(this);
        locs = new Locs(this);
        getServer().getPluginManager().registerEvents(this, this);
        getServer().getPluginManager().registerEvents(new MenuListener(this), this);

        modules.add(maps = new MapModule(this)); // first: loads the void spawn world
        modules.add(moderation = new ModerationModule(this));
        modules.add(region = new RegionModule(this));
        modules.add(mailbox = new Mailbox(this));
        modules.add(economy = new EconomyModule(this));
        modules.add(spawners = new SpawnerModule(this));
        modules.add(shards = new ShardModule(this));
        modules.add(crates = new CrateModule(this));
        modules.add(auction = new AuctionModule(this));
        modules.add(orders = new OrderModule(this));
        modules.add(teams = new TeamModule(this));
        modules.add(teleport = new TeleportModule(this));
        modules.add(duels = new DuelModule(this));
        modules.add(tools = new ToolModule(this));
        modules.add(misc = new MiscModule(this));
        modules.add(board = new BoardModule(this));
        modules.add(anticheat = new AntiCheatModule(this));
        modules.add(panel = new PanelModule(this));
        modules.add(new AdminModule(this));
        for (Module m : modules) {
            try { m.enable(); getServer().getPluginManager().registerEvents(m, this); }
            catch (Exception e) { getLogger().log(Level.SEVERE, "Module " + m.name() + " failed to enable", e); }
        }
        for (Player p : Bukkit.getOnlinePlayers()) handleJoin(p); // /reload safety
        getLogger().info("DonutClassic enabled (preset " + preset() + ", " + modules.size() + " modules).");
    }

    @Override public void onDisable() {
        for (Player p : Bukkit.getOnlinePlayers()) p.closeInventory(); // resolve open menus (crate refunds, sell menus)
        List<Module> rev = new ArrayList<>(modules);
        Collections.reverse(rev);
        for (Module m : rev) {
            try { m.disable(); } catch (Exception e) { getLogger().log(Level.SEVERE, "Module " + m.name() + " failed to disable", e); }
        }
        if (db != null) db.close();
    }

    public void loadConfigs() {
        configs.clear();
        for (String f : CONFIG_FILES) {
            File file = new File(getDataFolder(), f);
            YamlConfiguration y = YamlConfiguration.loadConfiguration(file);
            var res = getResource(f);
            if (res != null) y.setDefaults(YamlConfiguration.loadConfiguration(new java.io.InputStreamReader(res, java.nio.charset.StandardCharsets.UTF_8)));
            configs.put(f, y);
        }
    }

    /** Reloads YAML and every (or one) module. */
    public String reload(String only) {
        loadConfigs();
        msg.reload();
        locs.reload();
        List<String> done = new ArrayList<>();
        for (Module m : modules) if (only == null || m.name().equalsIgnoreCase(only)) {
            try { m.reload(); done.add(m.name()); } catch (Exception e) { getLogger().log(Level.SEVERE, "Reload failed: " + m.name(), e); }
        }
        return String.join(", ", done);
    }

    public YamlConfiguration cfg(String file) { return configs.get(file); }
    public YamlConfiguration cfg() { return configs.get("config.yml"); }

    /** Preset values (presets/<preset>.yml) override the base file for the given path. */
    public String preset() { return cfg().getString("preset", "classic-early"); }
    public YamlConfiguration presetCfg() {
        YamlConfiguration y = configs.get("presets/" + preset() + ".yml");
        return y != null ? y : configs.get("presets/classic-early.yml");
    }

    public void saveCfg(String file) {
        try { configs.get(file).save(new File(getDataFolder(), file)); }
        catch (Exception e) { getLogger().log(Level.SEVERE, "Could not save " + file, e); }
    }

    public File getPluginFile() { return getFile(); }
    public Database db() { return db; }
    public Ledger ledger() { return ledger; }
    public Msg msg() { return msg; }
    public Locs locs() { return locs; }
    public List<Module> modules() { return modules; }

    /** Runs on the main thread (immediately if already there). Safe after disable (drops the task). */
    public void runSync(Runnable r) {
        if (Bukkit.isPrimaryThread()) r.run();
        else if (isEnabled()) Bukkit.getScheduler().runTask(this, r);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent e) { handleJoin(e.getPlayer()); }

    private void handleJoin(Player p) {
        String ip = p.getAddress() == null ? null : p.getAddress().getAddress().getHostAddress();
        UUID id = p.getUniqueId();
        ledger.load(id, p.getName(), ip).thenRun(() -> {
            Player now = Bukkit.getPlayer(id);
            if (now == null) return;
            for (Module m : modules) {
                try { m.onDataLoaded(now); } catch (Exception ex) { getLogger().log(Level.SEVERE, "onDataLoaded " + m.name(), ex); }
            }
        });
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        // Unload one tick later so inventory-close handlers that run during disconnect still see the account.
        Bukkit.getScheduler().runTaskLater(this, () -> { if (Bukkit.getPlayer(id) == null) ledger.unload(id); }, 2L);
    }
}
