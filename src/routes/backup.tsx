import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, Loader2, ShieldCheck, Share2, FolderOpen, CheckCircle2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { exportBackup, importBackup } from "@/lib/store";
import {
  NOTIF_ENABLED_KEY,
  NOTIF_THRESHOLD_KEY,
  type NotifPermission,
  checkWashReminders,
  getNotificationPermission,
  getSetting,
  notificationsSupported,
  requestNotificationPermission,
  setSetting,
} from "@/lib/notifications";
import { isNative } from "@/lib/native";
import {
  type DocumentBackup,
  listDocumentBackups,
  readDocumentBackup,
  saveBackupToDocuments,
} from "@/lib/backup-native";

export const Route = createFileRoute("/backup")({
  head: () => ({ meta: [{ title: "גיבוי וייצוא" }] }),
  component: BackupPage,
});

interface SavedFileInfo {
  name: string;
  location: string;
  blob: Blob;
  url?: string;
}

function buildBackupFilename() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `closet-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

// Detect Median.co wrapped webview – it injects window.median or window.gonative
function getMedianBridge(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.median || w.gonative || null;
}

function isAndroidWebView() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

async function saveBlobToDevice(blob: Blob, filename: string): Promise<SavedFileInfo> {
  // 0) Native (Capacitor): write to the shared Documents directory via @capacitor/filesystem
  if (isNative()) {
    const json = await blob.text();
    const { name } = await saveBackupToDocuments(json, filename);
    return {
      name,
      location: "תיקיית המסמכים (Documents)",
      blob,
    };
  }

  // 1) Try the File System Access API (Chrome/Edge desktop, some Android browsers)
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "קובץ גיבוי JSON",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        name: handle.name || filename,
        location: "המיקום שבחרת במכשיר",
        blob,
      };
    } catch (err: any) {
      if (err?.name === "AbortError") throw err;
      // fall through to download
    }
  }

  // 2) Median.co native bridge for downloads
  const median = getMedianBridge();
  const url = URL.createObjectURL(blob);
  if (median?.share?.downloadFile) {
    try {
      median.share.downloadFile({ url, filename });
      return {
        name: filename,
        location: "תיקיית ההורדות של המכשיר",
        blob,
        url,
      };
    } catch {
      // fall through
    }
  }

  // 3) Standard anchor download – Android/Chrome routes this to Downloads/
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  const location = isAndroidWebView()
    ? "Downloads (תיקיית ההורדות)"
    : "תיקיית ההורדות של הדפדפן";

  return { name: filename, location, blob, url };
}

async function shareBackup(info: SavedFileInfo) {
  const file = new File([info.blob], info.name, { type: "application/json" });
  const nav = navigator as any;

  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "גיבוי בגדים",
        text: "גיבוי האפליקציה",
      });
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
  }

  // Median bridge fallback
  const median = getMedianBridge();
  if (median?.share?.sharePage) {
    try {
      median.share.sharePage({ url: info.url, text: info.name });
      return;
    } catch {
      // fall through
    }
  }

  toast.error("שיתוף לא נתמך במכשיר זה");
}

function openLocation() {
  const median = getMedianBridge();
  if (median?.run) {
    try {
      median.run({ statement: "open://downloads" });
      return;
    } catch {
      // fall through
    }
  }
  // Best-effort: try to open the Downloads URL scheme
  if (isAndroidWebView()) {
    try {
      window.location.href = "content://com.android.externalstorage.documents/root/primary";
      return;
    } catch {
      // ignore
    }
  }
  toast.info("פתח את אפליקציית הקבצים כדי לראות את הגיבוי בתיקיית ההורדות");
}

function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [saved, setSaved] = useState<SavedFileInfo | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifThreshold, setNotifThreshold] = useState(5);
  const [notifPerm, setNotifPerm] = useState<NotifPermission>(
    typeof window !== "undefined" && notificationsSupported() ? "prompt" : "unsupported",
  );
  const [docBackups, setDocBackups] = useState<DocumentBackup[]>([]);
  const native = typeof window !== "undefined" && isNative();

  async function refreshDocBackups() {
    if (native) setDocBackups(await listDocumentBackups());
  }

  useEffect(() => {
    (async () => {
      setNotifEnabled(await getSetting<boolean>(NOTIF_ENABLED_KEY, false));
      setNotifThreshold(await getSetting<number>(NOTIF_THRESHOLD_KEY, 5));
      setNotifPerm(await getNotificationPermission());
      await refreshDocBackups();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleNotifications() {
    if (!notificationsSupported()) {
      toast.error("המכשיר לא תומך בהתראות");
      return;
    }
    if (!notifEnabled) {
      const p = await requestNotificationPermission();
      setNotifPerm(p);
      if (p !== "granted") {
        toast.error("לא ניתנה הרשאה להתראות");
        return;
      }
      await setSetting(NOTIF_ENABLED_KEY, true);
      setNotifEnabled(true);
      toast.success("התראות הופעלו");
      checkWashReminders(true).catch(() => {});
    } else {
      await setSetting(NOTIF_ENABLED_KEY, false);
      setNotifEnabled(false);
      toast.success("התראות כובו");
    }
  }

  async function changeThreshold(v: number) {
    setNotifThreshold(v);
    await setSetting(NOTIF_THRESHOLD_KEY, v);
  }

  async function handleExport() {
    setBusy("export");
    try {
      const json = await exportBackup();
      if (!json || json.length < 2) {
        throw new Error("הגיבוי ריק");
      }
      // Validate JSON
      try {
        JSON.parse(json);
      } catch {
        throw new Error("הגיבוי שנוצר אינו תקין");
      }

      const blob = new Blob([json], { type: "application/json" });
      const filename = buildBackupFilename();
      const info = await saveBlobToDevice(blob, filename);
      setSaved(info);
      await refreshDocBackups();
      toast.success("הגיבוי נשמר בהצלחה");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // user cancelled – no toast
      } else {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "שגיאה בייצוא");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File | null | undefined) {
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      // Validate JSON before importing
      JSON.parse(text);
      await importBackup(text, { merge: mode === "merge" });
      toast.success("הגיבוי נטען בהצלחה");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "שגיאה בייבוא");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importFromDocuments(backup: DocumentBackup) {
    setBusy("import");
    try {
      const text = await readDocumentBackup(backup.name);
      JSON.parse(text);
      await importBackup(text, { merge: mode === "merge" });
      toast.success("הגיבוי נטען בהצלחה");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "שגיאה בייבוא");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8 safe-top">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold font-display">הגדרות וגיבוי</h1>
        <p className="text-xs text-muted-foreground mt-0.5">התראות, גיבוי והעברת נתונים</p>
      </header>

      <div className="bg-card border border-border rounded-3xl p-4 shadow-soft mb-4">
        <div className="flex items-start gap-3 mb-3">
          {notifEnabled ? (
            <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">תזכורת לכביסה</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              התראה כשבגד נלבש יותר מ־{notifThreshold} פעמים ללא כביסה
            </div>
          </div>
          <button
            onClick={toggleNotifications}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border ${
              notifEnabled
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-surface-elevated border-border"
            }`}
          >
            {notifEnabled ? "פעיל" : "הפעל"}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>סף לבישות לפני התראה</span>
            <span className="font-mono font-bold text-foreground">{notifThreshold}</span>
          </div>
          <input
            type="range"
            min={2}
            max={10}
            step={1}
            value={notifThreshold}
            onChange={(e) => changeThreshold(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {notifPerm === "denied" && (
          <p className="text-[11px] text-destructive mt-2">
            הרשאת ההתראות נחסמה. יש לאשר בהגדרות המכשיר.
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl p-4 shadow-soft mb-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          כל הנתונים שלך נשמרים מקומית במכשיר בלבד. הגיבוי הוא קובץ JSON אחד שמכיל את כל הפריטים,
          ההיסטוריה, הקטגוריות והתמונות.
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={busy !== null}
        className="w-full bg-primary text-primary-foreground rounded-2xl py-4 px-5 font-semibold flex items-center justify-center gap-2 shadow-card active:scale-[0.98] disabled:opacity-60 mb-4"
      >
        {busy === "export" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5" />
        )}
        ייצוא גיבוי
      </button>

      {saved && (
        <div className="bg-success/10 border border-success/30 rounded-3xl p-4 mb-4">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold mb-1">הגיבוי נשמר</div>
              <div className="text-xs text-muted-foreground break-all">
                <span className="font-semibold text-foreground">שם הקובץ: </span>
                {saved.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">מיקום: </span>
                {saved.location}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => shareBackup(saved)}
              className="rounded-2xl py-2.5 text-xs font-semibold bg-foreground text-background flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4" />
              שתף גיבוי
            </button>
            <button
              onClick={openLocation}
              className="rounded-2xl py-2.5 text-xs font-semibold bg-surface-elevated border border-border flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              <FolderOpen className="w-4 h-4" />
              פתח מיקום
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl p-4">
        <h3 className="font-bold text-sm mb-3">ייבוא גיבוי</h3>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setMode("merge")}
            className={`rounded-2xl py-2.5 text-xs font-semibold border ${
              mode === "merge"
                ? "bg-primary-soft border-primary text-primary"
                : "border-border bg-surface-elevated"
            }`}
          >
            מיזוג עם נתונים קיימים
          </button>
          <button
            onClick={() => setMode("replace")}
            className={`rounded-2xl py-2.5 text-xs font-semibold border ${
              mode === "replace"
                ? "bg-destructive/10 border-destructive text-destructive"
                : "border-border bg-surface-elevated"
            }`}
          >
            החלפה מלאה
          </button>
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="w-full bg-foreground text-background rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "import" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Upload className="w-5 h-5" />
          )}
          ייבוא גיבוי מקובץ
        </button>

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          בחר קובץ JSON מאחסון המכשיר
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleImport(e.target.files?.[0])}
        />

        {native && docBackups.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold">גיבויים בתיקיית המסמכים</h4>
              <button
                onClick={() => refreshDocBackups()}
                className="text-[11px] text-primary font-semibold"
              >
                רענן
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {docBackups.map((b) => (
                <li
                  key={b.uri}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated px-3 py-2"
                >
                  <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-[11px]">{b.name}</span>
                  <button
                    onClick={() => importFromDocuments(b)}
                    disabled={busy !== null}
                    className="shrink-0 rounded-full bg-primary text-primary-foreground px-3 py-1 text-[11px] font-bold disabled:opacity-60"
                  >
                    שחזר
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
