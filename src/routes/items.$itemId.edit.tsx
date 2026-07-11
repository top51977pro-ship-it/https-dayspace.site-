import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db, type ClothingItem, type Category } from "@/lib/db";
import { useLive } from "@/hooks/useLive";
import { updateItem } from "@/lib/store";
import { ImagePicker, type ImagePickerValue } from "@/components/ImagePicker";

export const Route = createFileRoute("/items/$itemId/edit")({
  head: () => ({ meta: [{ title: "עריכת פריט" }] }),
  component: EditItem,
});

function EditItem() {
  const { itemId } = Route.useParams();
  const nav = useNavigate();
  const item = useLive<ClothingItem | undefined>(
    () => db().items.get(itemId),
    [itemId],
    undefined,
  );
  const categories = useLive<Category[]>(
    () => db().categories.orderBy("order").toArray(),
    [],
    [],
  );

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<ImagePickerValue>(null);
  const [existingImageId, setExistingImageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategoryId(item.categoryId ?? "");
      setNotes(item.notes ?? "");
      setExistingImageId(item.imageId);
    }
  }, [item]);

  // Load existing image into picker preview
  useEffect(() => {
    let cancelled = false;
    if (existingImageId && !image) {
      db()
        .images.get(existingImageId)
        .then((img) => {
          if (!cancelled && img) {
            const url = URL.createObjectURL(img.blob);
            setImage({ blob: img.blob, previewUrl: url });
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [existingImageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    setSaving(true);
    try {
      const newImageBlob =
        image?.blob && image.blob !== (await db().images.get(existingImageId ?? "").then((i) => i?.blob))
          ? image.blob
          : null;
      await updateItem(itemId, {
        name,
        categoryId: categoryId || null,
        notes,
        ...(newImageBlob ? { imageBlob: newImageBlob } : {}),
      });
      toast.success("השינויים נשמרו");
      nav({ to: "/items/$itemId", params: { itemId } });
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירה");
      setSaving(false);
    }
  }

  if (!item) return <div className="p-8 text-center">טוען...</div>;

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8 safe-top">
      <header className="flex items-center justify-between mb-5">
        <Link to="/items/$itemId" params={{ itemId }} className="p-2 -m-2" aria-label="חזור">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold">עריכת פריט</h1>
        <div className="w-8" />
      </header>

      <ImagePicker value={image} onChange={setImage} />

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            שם הפריט
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            קטגוריה
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold border ${
                !categoryId ? "bg-foreground text-background border-foreground" : "bg-surface-elevated border-border"
              }`}
            >
              ללא
            </button>
            {(categories ?? []).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border ${
                  categoryId === c.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface-elevated border-border"
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            הערות
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-surface-elevated border border-border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          to="/items/$itemId"
          params={{ itemId }}
          className="flex-1 text-center bg-surface-elevated border border-border rounded-2xl py-3 font-semibold text-sm"
        >
          ביטול
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-[2] bg-primary text-primary-foreground rounded-2xl py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          שמור שינויים
        </button>
      </div>
    </div>
  );
}
