import { useLiveQuery } from "dexie-react-hooks";
import { isBrowser } from "@/lib/db";

/**
 * Typed wrapper around useLiveQuery that:
 *  - Skips execution during SSR (returns def)
 *  - Catches errors so dev/preview doesn't crash before db init
 */
export function useLive<T>(querier: () => Promise<T> | T, deps: unknown[], def: T): T {
  const result = useLiveQuery<T, T>(
    async () => {
      if (!isBrowser()) return def;
      try {
        return await querier();
      } catch (e) {
        console.error("useLive query failed", e);
        return def;
      }
    },
    deps,
    def,
  );
  return result;
}
