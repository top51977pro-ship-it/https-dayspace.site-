import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Plus, Loader2, Trash2, Edit3, X, GripVertical, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { db, type Category, type ClothingItem } from "@/lib/db";
import { useLive } from "@/hooks/useLive";
import {
  createCategory,
  renameCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/store";
import { guessCategoryIcon } from "@/lib/recognize";
import { ConfirmSheet } from "./items.$itemId.index";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "קטגוריות" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = useLive<Category[]>(
    () => db().categories.orderBy("order").toArray(),
    [],
    [],
  );
  const items = useLive<ClothingItem[]>(() => db().items.toArray(), [], []);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const countByCat = new Map<string, number>();
  (items ?? []).forEach((i) => {
    if (i.categoryId) countByCat.set(i.categoryId, (countByCat.get(i.categoryId) ?? 0) + 1);
  });

  return (
    <div className="max-w-md mx-auto px-4 pt-4 safe-top">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold font-display">קטגוריות</h1>
          <p className="text-xs text-muted-foreground mt-0.5">גרור כדי לסדר מחדש</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="bg-primary text-primary-foreground rounded-2xl p-3 shadow-card active:scale-95"
          aria-label="הוסף קטגוריה"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {(categories ?? []).length === 0 ? (
        <p className="text-center text-muted-foreground py-10">אין קטגוריות עדיין</p>
      ) : (
        <Reorder.Group
          axis="y"
          values={categories ?? []}
          onReorder={(list) => {
            reorderCategories(list.map((c) => c.id));
          }}
          className="space-y-2"
        >
          {(categories ?? []).map((cat) => (
            <Reorder.Item
              key={cat.id}
              value={cat}
              className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 shadow-soft"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <div className="text-2xl">{cat.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{cat.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="num">{countByCat.get(cat.id) ?? 0}</span> פריטים
                </p>
              </div>
              <button
                onClick={() => setEditing(cat)}
                className="p-2 hover:bg-accent rounded-xl"
                aria-label="ערוך"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleting(cat)}
                className="p-2 hover:bg-destructive/10 text-destructive rounded-xl"
                aria-label="מחק"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <AnimatePresence>
        {addOpen && (
          <CategorySheet
            onClose={() => setAddOpen(false)}
            onSubmit={async (name, icon) => {
              await createCategory(name, icon);
              toast.success("קטגוריה נוספה");
            }}
          />
        )}
        {editing && (
          <CategorySheet
            initial={editing}
            onClose={() => setEditing(null)}
            onSubmit={async (name, icon) => {
              await renameCategory(editing.id, name, icon);
              toast.success("הקטגוריה עודכנה");
            }}
          />
        )}
        {deleting && (
          <DeleteCategorySheet
            cat={deleting}
            itemCount={countByCat.get(deleting.id) ?? 0}
            otherCats={(categories ?? []).filter((c) => c.id !== deleting.id)}
            onClose={() => setDeleting(null)}
            onConfirm={async (moveToId) => {
              await deleteCategory(deleting.id, { moveToId });
              toast.success("הקטגוריה נמחקה");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategorySheet({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Category;
  onClose: () => void;
  onSubmit: (name: string, icon: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🏷️");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("שם הקטגוריה חובה");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(name, icon);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה");
      setSaving(false);
    }
  }

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
          <h3 className="font-bold text-lg">
            {initial ? "עריכת קטגוריה" : "קטגוריה חדשה"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={3}
              className="w-16 h-16 text-3xl text-center bg-secondary border border-border rounded-2xl"
            />
            <div className="flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם הקטגוריה"
                className="w-full bg-secondary border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    toast("הזן שם תחילה");
                    return;
                  }
                  setIcon(guessCategoryIcon(name));
                }}
                className="mt-2 text-xs font-semibold text-primary flex items-center gap-1.5"
              >
                <Wand2 className="w-3 h-3" />
                הצע אייקון אוטומטי
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-3 font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? "שמור שינויים" : "צור קטגוריה"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeleteCategorySheet({
  cat,
  itemCount,
  otherCats,
  onClose,
  onConfirm,
}: {
  cat: Category;
  itemCount: number;
  otherCats: Category[];
  onClose: () => void;
  onConfirm: (moveToId: string | null) => Promise<void>;
}) {
  const [moveTo, setMoveTo] = useState<string>("");

  if (itemCount === 0) {
    return (
      <ConfirmSheet
        title={`למחוק את "${cat.name}"?`}
        confirmLabel="מחק"
        danger
        onConfirm={() => onConfirm(null)}
        onClose={onClose}
      />
    );
  }

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
        className="w-full max-w-md bg-surface-elevated rounded-t-3xl p-5 safe-bottom"
      >
        <h3 className="font-bold text-lg">מחיקת "{cat.name}"</h3>
        <p className="text-sm text-muted-foreground mt-1">
          קיימים <span className="num font-bold">{itemCount}</span> פריטים בקטגוריה זו. לאן להעביר אותם?
        </p>

        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          <button
            onClick={() => setMoveTo("__none__")}
            className={`w-full text-start px-4 py-3 rounded-2xl border text-sm font-medium ${
              moveTo === "__none__" ? "bg-primary-soft border-primary text-primary" : "border-border"
            }`}
          >
            ללא קטגוריה
          </button>
          {otherCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setMoveTo(c.id)}
              className={`w-full text-start px-4 py-3 rounded-2xl border text-sm font-medium flex items-center gap-2 ${
                moveTo === c.id ? "bg-primary-soft border-primary text-primary" : "border-border"
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="bg-secondary rounded-2xl py-3 font-semibold text-sm"
          >
            ביטול
          </button>
          <button
            onClick={async () => {
              if (!moveTo) {
                toast("בחר יעד");
                return;
              }
              await onConfirm(moveTo === "__none__" ? null : moveTo);
              onClose();
            }}
            className="bg-destructive text-destructive-foreground rounded-2xl py-3 font-semibold text-sm"
          >
            מחק והעבר
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
