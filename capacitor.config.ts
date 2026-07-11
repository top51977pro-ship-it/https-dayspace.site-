import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "site.dayspace.closetbuddy",
  appName: "הארון שלי",
  // Static web assets served inside the Android WebView. `bun run build:mobile`
  // assembles the SPA client bundle here from the TanStack Start build output.
  webDir: "www",
  android: {
    // Keep IndexedDB / Dexie data stable across updates.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2B2B2B",
    },
  },
};

export default config;
