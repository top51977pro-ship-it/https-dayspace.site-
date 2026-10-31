# Automated tests

Everything runs in GitHub Actions (`.github/workflows/donutclassic.yml`) on every push:

1. **Unit tests** (`./gradlew :core:test`, JUnit 5 + real SQLite). They cover:
   - Money parsing and formatting, rejecting negative/NaN/overflow values, multiplier maths.
   - Stack curve: diminishing marginal output, never above the stack size, capped; table interpolation.
   - Spawner production: fractional carry, storage cap, stack-merge overflow, encode/decode round trip.
   - Ledger: deposit/withdraw/transfer, no overdraft, no negatives, balance cap, offline credit, values
     persisting across a simulated **restart**, and a deposit made while the account is still loading
     isn't lost (keyall during join).
   - Spawner repository: insert/update/delete round trip, **one record per block** (UNIQUE),
     audit log entries.
   - Migrations are idempotent; transactions roll back as a whole.
   - Crate candidates (7 distinct), AFK complete-minute counting (partial minute discarded),
     kill-reward cooldown / same-IP block, keyall clock, duel matchmaking.
2. **Compile** the plugin against the real `io.papermc.paper:paper-api` and build `dist/DonutClassic.jar`.
3. **Paper smoke test** (`scripts/smoke-test.sh`) on Paper **1.21.4** and on the **latest** Paper:
   starts a real server with the jar, runs `/dc version`, `status`, `spawner list`, `spawner benchmark`,
   `setupwizard`, `keyall`, switches presets, `reload`, `backup`, restarts, then checks:
   the plugin enabled, no DonutClassic errors or stack traces in either run, the benchmark printed,
   the SQLite schema is present, and a backup file was written.
4. When all of the above pass, the verified jar and its SHA-256 are committed to `dist/`.

Run locally: `./gradlew :core:test :plugin:dist`, then `scripts/smoke-test.sh paper.jar dist/DonutClassic.jar`
(needs access to repo.papermc.io and a Paper server jar).

**Not automated:** real player clients. Java/Bedrock interaction, GUI clicks, placing and stacking spawners,
and duels need people (MANUAL_TEST_CHECKLIST.md).
