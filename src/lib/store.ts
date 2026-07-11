import { db, uid, type ClothingItem, type Category, type HistoryEvent } from "./db";

const DEFAULT_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: "חולצות", icon: "👕" },
  { name: "מכנסיים", icon: "👖" },
  { name: "נעליים", icon: "👟" },
  { name: "מעילים", icon: "🧥" },
  { name: "תחתונים", icon: "🩲" },
];

export async function ensureSeed() {
  const d = db();
  const count = await d.categories.count();
  if (count === 0) {
    const now = Date.now();
    await d.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((c, i) => ({
        id: uid(),
        name: c.name,
        icon: c.icon,
        order: i,
        createdAt: now,
      })),
    );
  }
}

// --- Categories ---

export async function createCategory(name: string, icon: string) {
  const d = db();
  const max = await d.categories.orderBy("order").last();
  const cat: Category = {
    id: uid(),
    name: name.trim(),
    icon: icon || "🏷️",
    order: (max?.order ?? -1) + 1,
    createdAt: Date.now(),
  };
  await d.categories.add(cat);
  return cat;
}

export async function renameCategory(id: string, name: string, icon?: string) {
  const d = db();
  await d.categories.update(id, { name: name.trim(), ...(icon ? { icon } : {}) });
}

export async function reorderCategories(ids: string[]) {
  const d = db();
  await d.transaction("rw", d.categories, async () => {
    for (let i = 0; i < ids.length; i++) {
      await d.categories.update(ids[i], { order: i });
    }
  });
}

export async function deleteCategory(id: string, opts: { moveToId?: string | null } = {}) {
  const d = db();
  await d.transaction("rw", d.categories, d.items, async () => {
    const items = await d.items.where("categoryId").equals(id).toArray();
    for (const it of items) {
      await d.items.update(it.id, { categoryId: opts.moveToId ?? null });
    }
    await d.categories.delete(id);
  });
}

// --- Items ---

export async function createItem(input: {
  name: string;
  categoryId: string | null;
  imageBlob?: Blob | null;
  notes?: string;
  aiType?: string;
  aiPriceILS?: number;
}) {
  const d = db();
  const now = Date.now();
  let imageId: string | null = null;
  if (input.imageBlob) {
    imageId = uid();
    await d.images.add({ id: imageId, blob: input.imageBlob, createdAt: now });
  }
  const max = await d.items.orderBy("order").last();
  const item: ClothingItem = {
    id: uid(),
    name: input.name.trim(),
    categoryId: input.categoryId,
    imageId,
    notes: input.notes?.trim() || undefined,
    wearCount: 0,
    totalWears: 0,
    totalWashes: 0,
    lastWornAt: null,
    lastWashedAt: null,
    order: (max?.order ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
    aiType: input.aiType,
    aiPriceILS: input.aiPriceILS,
  };
  await d.items.add(item);
  await d.history.add({
    id: uid(),
    itemId: item.id,
    type: "create",
    at: now,
  });
  return item;
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<ClothingItem, "name" | "categoryId" | "notes">> & {
    imageBlob?: Blob | null;
  },
) {
  const d = db();
  const now = Date.now();
  const updates: Partial<ClothingItem> = { updatedAt: now };
  if (patch.name !== undefined) updates.name = patch.name.trim();
  if (patch.categoryId !== undefined) updates.categoryId = patch.categoryId;
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || undefined;
  if (patch.imageBlob) {
    const item = await d.items.get(id);
    if (item?.imageId) await d.images.delete(item.imageId).catch(() => {});
    const imageId = uid();
    await d.images.add({ id: imageId, blob: patch.imageBlob, createdAt: now });
    updates.imageId = imageId;
  }
  await d.items.update(id, updates);
  await d.history.add({ id: uid(), itemId: id, type: "edit", at: now });
}

export async function deleteItem(id: string) {
  const d = db();
  await d.transaction("rw", d.items, d.history, d.images, async () => {
    const item = await d.items.get(id);
    if (item?.imageId) await d.images.delete(item.imageId).catch(() => {});
    await d.history.where("itemId").equals(id).delete();
    await d.items.delete(id);
  });
}

export async function reorderItems(ids: string[]) {
  const d = db();
  await d.transaction("rw", d.items, async () => {
    for (let i = 0; i < ids.length; i++) {
      await d.items.update(ids[i], { order: i });
    }
  });
}

// --- Wear / Wash with snapshot-based undo ---

export interface ActionSnapshot {
  itemId: string;
  type: "wear" | "wash";
  prev: {
    wearCount: number;
    totalWears: number;
    totalWashes: number;
    lastWornAt: number | null;
    lastWashedAt: number | null;
  };
  historyEventId: string;
}

let undoStack: ActionSnapshot[] = [];
const UNDO_LIMIT = 20;

export function getUndoSnapshot(): ActionSnapshot | null {
  return undoStack.length ? undoStack[undoStack.length - 1] : null;
}

export function clearUndo() {
  undoStack = [];
}

export async function markWorn(itemId: string) {
  const d = db();
  const now = Date.now();
  const snapshot = await d.transaction("rw", d.items, d.history, async () => {
    const it = await d.items.get(itemId);
    if (!it) throw new Error("item not found");
    const prev = {
      wearCount: it.wearCount,
      totalWears: it.totalWears,
      totalWashes: it.totalWashes,
      lastWornAt: it.lastWornAt,
      lastWashedAt: it.lastWashedAt,
    };
    await d.items.update(itemId, {
      wearCount: it.wearCount + 1,
      totalWears: it.totalWears + 1,
      lastWornAt: now,
      updatedAt: now,
    });
    const histId = uid();
    await d.history.add({ id: histId, itemId, type: "wear", at: now });
    return { itemId, type: "wear" as const, prev, historyEventId: histId };
  });
  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  return snapshot;
}

export async function markWashed(itemId: string) {
  const d = db();
  const now = Date.now();
  const snapshot = await d.transaction("rw", d.items, d.history, async () => {
    const it = await d.items.get(itemId);
    if (!it) throw new Error("item not found");
    const prev = {
      wearCount: it.wearCount,
      totalWears: it.totalWears,
      totalWashes: it.totalWashes,
      lastWornAt: it.lastWornAt,
      lastWashedAt: it.lastWashedAt,
    };
    await d.items.update(itemId, {
      wearCount: 0,
      totalWashes: it.totalWashes + 1,
      lastWashedAt: now,
      updatedAt: now,
    });
    const histId = uid();
    await d.history.add({ id: histId, itemId, type: "wash", at: now });
    return { itemId, type: "wash" as const, prev, historyEventId: histId };
  });
  undoStack.push(snapshot);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  return snapshot;
}

export async function undoLast(): Promise<ActionSnapshot | null> {
  const snap = undoStack.pop();
  if (!snap) return null;
  const d = db();
  await d.transaction("rw", d.items, d.history, async () => {
    await d.items.update(snap.itemId, {
      ...snap.prev,
      updatedAt: Date.now(),
    });
    await d.history.delete(snap.historyEventId);
  });
  return snap;
}

// --- Backup ---

export async function exportBackup(): Promise<string> {
  const d = db();
  const [items, categories, history, images] = await Promise.all([
    d.items.toArray(),
    d.categories.toArray(),
    d.history.toArray(),
    d.images.toArray(),
  ]);
  const imagesEncoded = await Promise.all(
    images.map(async (img) => ({
      id: img.id,
      createdAt: img.createdAt,
      type: img.blob.type,
      data: await blobToBase64(img.blob),
    })),
  );
  return JSON.stringify({
    version: 1,
    exportedAt: Date.now(),
    items,
    categories,
    history,
    images: imagesEncoded,
  });
}

export async function importBackup(json: string, opts: { merge?: boolean } = {}) {
  const data = JSON.parse(json);
  if (!data || data.version !== 1) throw new Error("גרסת גיבוי לא נתמכת");
  const d = db();
  await d.transaction("rw", d.items, d.categories, d.history, d.images, async () => {
    if (!opts.merge) {
      await Promise.all([d.items.clear(), d.categories.clear(), d.history.clear(), d.images.clear()]);
    }
    if (Array.isArray(data.categories)) await d.categories.bulkPut(data.categories);
    if (Array.isArray(data.items)) await d.items.bulkPut(data.items);
    if (Array.isArray(data.history)) await d.history.bulkPut(data.history);
    if (Array.isArray(data.images)) {
      for (const img of data.images) {
        const blob = base64ToBlob(img.data, img.type || "image/jpeg");
        await d.images.put({ id: img.id, blob, createdAt: img.createdAt });
      }
    }
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}
