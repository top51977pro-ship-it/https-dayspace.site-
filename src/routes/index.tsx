import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, ArrowDownUp, X } from "lucide-react";
import { db, type ClothingItem, type Category } from "@/lib/db";
import { useLive } from "@/hooks/useLive";
import { ItemCard } from "@/components/ItemCard";
import { EmptyState } from "@/components/EmptyState";

type SortKey = "manual" | "recent_worn" | "most_worn" | "needs_wash" | "stale";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "הארון שלי" }],
  }),
  component: Home,
});

function Home() {
  const items = useLive<ClothingItem[]>(() => db().items.orderBy("order").toArray(), [], []);
  const categories = useLive<Category[]>(
    () => db().categories.orderBy("order").toArray(),
    [],
    [],
  );

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("manual");
  const [showSort, setShowSort] = useState(false);

  const catMap = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const filtered = useMemo(() => {
    let list = [...(items ?? [])];
    if (activeCat !== "all") list = list.filter((i) => i.categoryId === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    switch (sortKey) {
      case "recent_worn":
        list.sort((a, b) => (b.lastWornAt ?? 0) - (a.lastWornAt ?? 0));
        break;
      case "most_worn":
        list.sort((a, b) => b.totalWears - a.totalWears);
        break;
      case "needs_wash":
        list.sort((a, b) => b.wearCount - a.wearCount);
        break;
      case "stale":
        list.sort((a, b) => (a.lastWornAt ?? 0) - (b.lastWornAt ?? 0));
        break;
      default:
        list.sort((a, b) => a.order - b.order);
    }
    return list;
  }, [items, activeCat, search, sortKey]);

  const isEmpty = (items?.length ?? 0) === 0;

  return (
    <div className="max-w-md mx-auto px-4 pt-4 safe-top">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-display">הארון שלי</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items?.length ?? 0} פריטים בארון
          </p>
        </div>
        <Link
          to="/items/new"
          className="bg-primary text-primary-foreground rounded-2xl p-3 shadow-card active:scale-95 transition-transform"
          aria-label="הוסף פריט"
        >
          <Plus className="w-5 h-5" strokeWidth={2.4} />
        </Link>
      </header>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש פריט..."
            className="w-full bg-surface-elevated border border-border rounded-2xl py-2.5 ps-3 pe-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-shadow"
          />
        </div>
        <button
          onClick={() => setShowSort(true)}
          className="bg-surface-elevated border border-border rounded-2xl p-2.5 active:scale-95 transition-transform"
          aria-label="מיון"
        >
          <ArrowDownUp className="w-4 h-4" />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3 scrollbar-none">
        <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")} label="הכל" />
        {(categories ?? []).map((c) => (
          <Chip
            key={c.id}
            active={activeCat === c.id}
            onClick={() => setActiveCat(c.id)}
            label={
              <span className="flex items-center gap-1.5">
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </span>
            }
          />
        ))}
      </div>

      {isEmpty ? (
        <EmptyState
          title="הארון עוד ריק"
          subtitle="הוסף את הפריט הראשון שלך כדי להתחיל לעקוב אחרי לבישות וכביסות"
          action={
            <Link
              to="/items/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-card active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
              הוסף פריט
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="לא נמצאו פריטים" subtitle="נסה לשנות את החיפוש או הסינון" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((it, idx) => (
            <ItemCard
              key={it.id}
              item={it}
              category={it.categoryId ? catMap.get(it.categoryId) : undefined}
              index={idx}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showSort && (
          <SortSheet current={sortKey} onSelect={(k) => { setSortKey(k); setShowSort(false); }} onClose={() => setShowSort(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
        active
          ? "bg-foreground text-background border-foreground shadow-soft"
          : "bg-surface-elevated text-foreground border-border"
      }`}
    >
      {label}
    </button>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "manual", label: "סדר ידני" },
  { key: "recent_worn", label: "נלבשו לאחרונה" },
  { key: "most_worn", label: "הכי נלבשים" },
  { key: "needs_wash", label: "צריכים כביסה" },
  { key: "stale", label: "לא נלבשו מזמן" },
];

function SortSheet({
  current,
  onSelect,
  onClose,
}: {
  current: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-elevated rounded-t-3xl p-5 safe-bottom shadow-elevated"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">מיון</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-accent">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => onSelect(o.key)}
              className={`w-full text-start px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                current === o.key ? "bg-primary-soft text-primary" : "hover:bg-accent"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
