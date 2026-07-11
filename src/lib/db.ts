import Dexie, { type Table } from "dexie";

export type CategoryIcon = string; // emoji

export interface Category {
  id: string;
  name: string;
  icon: CategoryIcon;
  order: number;
  createdAt: number;
}

export type HistoryEventType = "wear" | "wash" | "create" | "edit";

export interface HistoryEvent {
  id: string;
  itemId: string;
  type: HistoryEventType;
  at: number;
  note?: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  categoryId: string | null;
  imageId: string | null;
  notes?: string;
  wearCount: number;        // since last wash
  totalWears: number;
  totalWashes: number;
  lastWornAt: number | null;
  lastWashedAt: number | null;
  order: number;
  createdAt: number;
  updatedAt: number;
  // AI metadata
  aiType?: string;
  aiPriceILS?: number;
}

export interface ImageBlob {
  id: string;
  blob: Blob;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

class ClothingDB extends Dexie {
  items!: Table<ClothingItem, string>;
  categories!: Table<Category, string>;
  history!: Table<HistoryEvent, string>;
  images!: Table<ImageBlob, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("closet_db_v1");
    this.version(1).stores({
      items: "id, categoryId, order, lastWornAt, lastWashedAt, wearCount, totalWears, updatedAt",
      categories: "id, order",
      history: "id, itemId, at, type",
      images: "id",
      settings: "key",
    });
  }
}

let _db: ClothingDB | null = null;
export function db(): ClothingDB {
  if (typeof window === "undefined") {
    // Avoid touching indexedDB during SSR
    throw new Error("db() called on server");
  }
  if (!_db) _db = new ClothingDB();
  return _db;
}

export function uid(): string {
  // RFC4122-ish; sufficient for local app
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

export function isBrowser() {
  return typeof window !== "undefined";
}
