import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { db, type Category } from "@/lib/db";
import { useLive } from "@/hooks/useLive";
import { createItem } from "@/lib/store";
import { ImagePicker, type ImagePickerValue } from "@/components/ImagePicker";
import { guessClothing } from "@/lib/recognize";

export const Route = createFileRoute("/items/new")({
  head: () => ({ meta: [{ title: "הוסף פריט" }] }),
  component: NewItem,
});

function NewItem() {
  const nav = useNavigate();
  const categories = useLive<Category[]>(
    () => db().categories.orderBy("order").toArray(),
    [],
    [],
  );

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<ImagePickerValue>(null);
  const [saving, setSaving] = useState(false);

  const guess = useMemo(() => guessClothing(name), [name]);
  const suggestedCategory = useMemo(() => {
    if (!guess || !categories) return null;
    return categories.find((c) => c.name === guess.categoryHint) ?? null;
  }, [guess, categories]);

  function applySuggestion() {
    if (suggestedCategory) setCategoryId(suggestedCategory.id);
  }


  async function handleSave() {
    if (!name.trim()) {
      toast.error("יש להזין שם לפריט");
      return;
    }
    setSaving(true);
    try {
      await createItem({
        name,
        categoryId: categoryId || null,
        imageBlob: image?.blob ?? null,
        notes,
      });
      toast.success("הפריט נוסף לארון");
      nav({ to: "/" });
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירה");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8 safe-top">
      <header className="flex items-center justify-between mb-5">
        <Link to="/" className="p-2 -m-2" aria-label="חזור">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold">הוספת פריט</h1>
        <div className="w-8" />
      </header>

      <ImagePicker value={image} onChange={setImage} />

      <div className="mt-5 space-y-4">
        <Field label="שם הפריט">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: חולצת טי שחורה"
            className="w-full bg-surface-elevated border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          {guess && (
            <button
              type="button"
              onClick={applySuggestion}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-soft/50 border border-primary/20 px-3 py-1.5 rounded-full active:scale-95"
            >
              <Wand2 className="w-3 h-3" />
              <span>{guess.icon}</span>
              <span>זוהה: {guess.type}</span>
              {suggestedCategory && suggestedCategory.id !== categoryId && (
                <span className="text-muted-foreground">· שייך ל"{suggestedCategory.name}"</span>
              )}
            </button>
          )}
        </Field>


        <Field label="קטגוריה">
          <div className="flex gap-2 flex-wrap">
            <CatChip selected={!categoryId} onClick={() => setCategoryId("")} label="ללא" />
            {(categories ?? []).map((c) => (
              <CatChip
                key={c.id}
                selected={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                label={
                  <>
                    <span>{c.icon}</span>
                    <span>{c.name}</span>
                  </>
                }
              />
            ))}
          </div>
        </Field>

        <Field label="הערות (לא חובה)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-surface-elevated border border-border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          to="/"
          className="flex-1 text-center bg-surface-elevated border border-border rounded-2xl py-3 font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          ביטול
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-[2] bg-primary text-primary-foreground rounded-2xl py-3 font-semibold text-sm shadow-card active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          שמור פריט
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function CatChip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
        selected
          ? "bg-foreground text-background border-foreground"
          : "bg-surface-elevated text-foreground border-border"
      }`}
    >
      {label}
    </button>
  );
}
