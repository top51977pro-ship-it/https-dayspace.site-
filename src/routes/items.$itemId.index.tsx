import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLive } from "@/hooks/useLive";
import { motion } from "framer-motion";
import { ArrowRight, Shirt, Edit3, Trash2, Undo2, History } from "lucide-react";
import { db, type ClothingItem, type Category, type HistoryEvent } from "@/lib/db";
import { useImageUrl } from "@/hooks/useImageUrl";
import { formatDateTime, relativeFromNow, daysSince } from "@/lib/hebrew";
import { markWorn, markWashed, deleteItem, undoLast, getUndoSnapshot } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/items/$itemId/")({
  head: () => ({ meta: [{ title: "פרטי פריט" }] }),
  component: ItemDetail,
  notFoundComponent: () => <div className="p-8 text-center">הפריט לא נמצא</div>,
  errorComponent: ({ reset }) => (
    <div className="p-8 text-center">
      <p>שגיאה בטעינת הפריט</p>
      <button onClick={reset} className="mt-3 text-primary">נסה שוב</button>
    </div>
  ),
});

function ItemDetail() {
  const { itemId } = Route.useParams();
  const nav = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, force] = useState(0);

  const item = useLive<ClothingItem | undefined>(
    () => db().items.get(itemId),
    [itemId],
    undefined,
  );
  const category = useLive<Category | undefined>(
    () => (item?.categoryId ? db().categories.get(item.categoryId) : Promise.resolve(undefined)),
    [item?.categoryId],
    undefined,
  );
  const history = useLive<HistoryEvent[]>(
    () => db().history.where("itemId").equals(itemId).reverse().sortBy("at"),
    [itemId],
    [],
  );
  const url = useImageUrl(item?.imageId);

  if (!item) {
    return <div className="p-8 text-center text-muted-foreground">טוען...</div>;
  }

  const stale = daysSince(item.lastWornAt);

  async function handleWear() {
    await markWorn(itemId);
    force((n) => n + 1);
    toast("סומן כנלבש", {
      action: { label: "בטל", onClick: async () => { await undoLast(); force((n) => n + 1); } },
    });
  }

  async function handleWash() {
    await markWashed(itemId);
    force((n) => n + 1);
    toast("סומן ככובס", {
      action: { label: "בטל", onClick: async () => { await undoLast(); force((n) => n + 1); } },
    });
  }

  async function handleDelete() {
    await deleteItem(itemId);
    toast.success("הפריט נמחק");
    nav({ to: "/" });
  }

  const canUndo = !!getUndoSnapshot();

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* Image header */}
      <div className="relative aspect-square bg-secondary overflow-hidden">
        {url ? (
          <img src={url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Shirt className="w-20 h-20" strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/30 to-transparent" />
        <Link
          to="/"
          className="absolute top-4 end-4 bg-surface-elevated/95 backdrop-blur-md rounded-full p-2.5 shadow-soft border border-border safe-top"
          aria-label="חזור"
        >
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      <div className="px-4 -mt-6 relative z-10">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-3xl border border-border shadow-card p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold font-display truncate">{item.name}</h1>
              {category && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </p>
              )}
            </div>
            <Link
              to="/items/$itemId/edit"
              params={{ itemId }}
              className="shrink-0 bg-primary text-primary-foreground rounded-2xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-soft active:scale-95 transition-transform"
              aria-label="ערוך פריט"
            >
              <Edit3 className="w-4 h-4" />
              ערוך
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="לבישות" value={item.wearCount} highlight={item.wearCount >= 3} />
            <Stat label="סה״כ לבישות" value={item.totalWears} />
            <Stat label="כביסות" value={item.totalWashes} />
          </div>

          {stale !== null && stale > 30 && (
            <p className="mt-3 text-xs text-warning bg-warning/10 rounded-xl py-2 px-3 text-center">
              לא נלבש כבר {stale} ימים
            </p>
          )}

          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>נלבש לאחרונה</span>
              <span className="text-foreground">{formatDateTime(item.lastWornAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>כובס לאחרונה</span>
              <span className="text-foreground">{formatDateTime(item.lastWashedAt)}</span>
            </div>
          </div>

          {item.notes && (
            <p className="mt-4 text-sm bg-secondary rounded-2xl p-3 leading-relaxed">{item.notes}</p>
          )}
        </motion.div>

        {/* Action buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={handleWear}
            className="bg-primary text-primary-foreground rounded-2xl py-3.5 font-bold text-sm shadow-card active:scale-[0.97] transition-transform"
          >
            לבשתי
          </button>
          <button
            onClick={handleWash}
            className="bg-foreground text-background rounded-2xl py-3.5 font-bold text-sm shadow-card active:scale-[0.97] transition-transform"
          >
            כבסתי
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={async () => {
              const undone = await undoLast();
              if (undone) {
                toast("הפעולה האחרונה בוטלה");
                force((n) => n + 1);
              } else {
                toast("אין פעולה לביטול");
              }
            }}
            disabled={!canUndo}
            className="bg-surface-elevated border border-border rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.97] transition-transform"
          >
            <Undo2 className="w-4 h-4" />
            בטל פעולה
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="bg-surface-elevated border border-border text-destructive rounded-2xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Trash2 className="w-4 h-4" />
            מחק
          </button>
        </div>

        {/* History */}
        <div className="mt-6">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            היסטוריה
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">עוד אין פעולות</p>
          ) : (
            <ol className="relative ps-4 border-s border-border space-y-3">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span
                    className={`absolute -start-[21px] top-1 w-3 h-3 rounded-full border-2 border-background ${
                      h.type === "wear"
                        ? "bg-primary"
                        : h.type === "wash"
                          ? "bg-foreground"
                          : "bg-muted"
                    }`}
                  />
                  <div className="bg-surface-elevated rounded-2xl border border-border p-3">
                    <p className="text-sm font-semibold">
                      {h.type === "wear"
                        ? "לבישה"
                        : h.type === "wash"
                          ? "כביסה"
                          : h.type === "create"
                            ? "נוצר"
                            : "עודכן"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(h.at)} · {relativeFromNow(h.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmSheet
          title="למחוק את הפריט?"
          subtitle="פעולה זו לא ניתנת לביטול. כל ההיסטוריה תימחק."
          confirmLabel="מחק"
          danger
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${highlight ? "bg-warning/15" : "bg-secondary"}`}
    >
      <p className={`text-2xl font-extrabold num ${highlight ? "text-warning" : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">
        {label}
      </p>
    </div>
  );
}

export function ConfirmSheet({
  title,
  subtitle,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
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
        <h3 className="font-bold text-lg">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="bg-secondary text-secondary-foreground rounded-2xl py-3 font-semibold text-sm active:scale-[0.97] transition-transform"
          >
            ביטול
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={`rounded-2xl py-3 font-semibold text-sm active:scale-[0.97] transition-transform ${
              danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
