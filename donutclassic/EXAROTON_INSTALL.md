# Installing on exaroton (Java + Bedrock on one server)

1. **Software**: in the exaroton panel, go to *Software* and choose **Paper**. Pick a Paper version that
   Geyser currently supports (check https://geysermc.org/download first). DonutClassic is built against the Paper
   1.21.4 API (`api-version: 1.21`). CI starts it on Paper 1.21.4 and on the newest Paper release.
2. **Geyser + Floodgate**: under *Plugins*, install **Geyser**. exaroton installs **Floodgate** with it, so
   Bedrock players don't need a Java account. Bedrock players connect to your server address on port
   **19132** (check the exact port shown in the panel's Geyser settings).
3. **Upload the plugin**: under *Files*, open `plugins/` and upload `DonutClassic.jar` (from `dist/`). Uploading
   custom files may be limited on exaroton's free trial. If the upload is blocked, check your plan.
4. **Start once** so it creates `plugins/DonutClassic/` (all `.yml` files plus `data.db`). Check the console for
   `DonutClassic enabled`. Then stop the server.
5. **World**: if you built the spawn offline (MAP_SETUP.md option B), upload the ZIP under *Worlds*. It must
   contain `level.dat` and `region/`. Or install FastAsyncWorldEdit and paste the schematics (option A).
6. **Bind positions** as OP: `/dc setspawn`, `/dc setspawncorner1/2`, `/dc setafk`, `/dc setafkcorner1/2`,
   `/dc setcrate <type>` (×5), `/dc setnpc ...`, `/dc duel setarena arena1 1|2`. Check with `/dc setupwizard`.
7. **Choose a preset**: `/dc preset classic-early` (the default) or `/dc preset feb-2026`.
8. **Restart**, then test with one Java client and one Bedrock client at the same time
   (see MANUAL_TEST_CHECKLIST.md).

Back up the database with `/dc backup` (writes to `plugins/DonutClassic/backups/`), as well as exaroton's own backups.
No other plugins are required. WorldEdit/FAWE, WorldGuard and Floodgate are optional soft dependencies.
