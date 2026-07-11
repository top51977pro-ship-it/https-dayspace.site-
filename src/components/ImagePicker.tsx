import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image as ImageIcon, X, RotateCw, Crop, Check, Minus, Plus } from "lucide-react";

export type ImagePickerValue = { blob: Blob; previewUrl: string } | null;

export function ImagePicker({
  value,
  onChange,
}: {
  value: ImagePickerValue;
  onChange: (v: ImagePickerValue) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  // Holds the original (uncropped, only resized) blob so user can re-crop.
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      // Resize down but DO NOT crop - keep original aspect for editor.
      const resized = await resizeImage(file, 1600, 0.9);
      setSourceBlob(resized);
      setEditorOpen(true);
    },
    [],
  );

  function applyCrop(cropped: Blob) {
    const url = URL.createObjectURL(cropped);
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    onChange({ blob: cropped, previewUrl: url });
    setEditorOpen(false);
  }

  return (
    <div>
      <div className="relative aspect-square rounded-3xl overflow-hidden bg-secondary border border-border">
        {value?.previewUrl ? (
          <>
            <img src={value.previewUrl} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (!sourceBlob && value.blob) setSourceBlob(value.blob);
                setEditorOpen(true);
              }}
              className="absolute top-3 start-3 bg-surface-elevated/90 backdrop-blur-md p-2 rounded-full shadow-soft border border-border"
              aria-label="התאם תמונה"
            >
              <Crop className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(value.previewUrl);
                setSourceBlob(null);
                onChange(null);
              }}
              className="absolute top-3 end-3 bg-surface-elevated/90 backdrop-blur-md p-2 rounded-full shadow-soft border border-border"
              aria-label="הסר תמונה"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 gap-2 p-3">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex flex-col items-center justify-center gap-2 bg-surface-elevated rounded-2xl border border-border hover:bg-accent transition-colors active:scale-95"
            >
              <Camera className="w-7 h-7 text-primary" strokeWidth={1.6} />
              <span className="text-sm font-medium">מצלמה</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 bg-surface-elevated rounded-2xl border border-border hover:bg-accent transition-colors active:scale-95"
            >
              <ImageIcon className="w-7 h-7 text-primary" strokeWidth={1.6} />
              <span className="text-sm font-medium">גלריה</span>
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          setShowCamera(false);
          e.target.value = "";
        }}
      />

      <AnimatePresence>
        {showCamera && (
          <CameraSheet
            onCapture={() => cameraRef.current?.click()}
            onClose={() => setShowCamera(false)}
          />
        )}
        {editorOpen && sourceBlob && (
          <CropEditor
            sourceBlob={sourceBlob}
            onCancel={() => setEditorOpen(false)}
            onSave={applyCrop}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CameraSheet({ onCapture, onClose }: { onCapture: () => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 safe-top">
        <button onClick={onClose} className="text-white p-2" aria-label="סגור">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/80 text-sm">צילום פריט</span>
        <button className="text-white p-2 opacity-50" aria-label="החלף מצלמה" disabled>
          <RotateCw className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="text-white/80">
          <Camera className="w-16 h-16 mx-auto mb-4 opacity-60" strokeWidth={1.2} />
          <p className="text-sm">לחץ על כפתור הצילום כדי לפתוח את המצלמה במכשיר</p>
        </div>
      </div>

      <div className="safe-bottom flex items-center justify-center pb-8">
        <button
          onClick={onCapture}
          className="w-20 h-20 rounded-full bg-white border-4 border-white/30 active:scale-95 transition-transform"
          aria-label="צלם"
        />
      </div>
    </motion.div>
  );
}

function CropEditor({
  sourceBlob,
  onCancel,
  onSave,
}: {
  sourceBlob: Blob;
  onCancel: () => void;
  onSave: (b: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1); // 1 = "cover" baseline
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [containMode, setContainMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(sourceBlob);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [sourceBlob]);

  // Compute base "cover" or "contain" scale relative to a 1x1 frame.
  function baseScale(mode: "cover" | "contain") {
    if (!img) return 1;
    const ratio = img.width / img.height;
    if (mode === "cover") return ratio > 1 ? 1 / 1 : 1; // we use height-based normalization below
    return 1;
  }

  // Clamp translation so image edges stay sensible while in cover mode.
  function clamp(nx: number, ny: number, s: number, frameSize: number) {
    if (!img || containMode) return { nx, ny };
    const ratio = img.width / img.height;
    const displayedW = ratio >= 1 ? frameSize * ratio * s : frameSize * s;
    const displayedH = ratio >= 1 ? frameSize * s : (frameSize / ratio) * s;
    const maxX = Math.max(0, (displayedW - frameSize) / 2);
    const maxY = Math.max(0, (displayedH - frameSize) / 2);
    return {
      nx: Math.max(-maxX, Math.min(maxX, nx)),
      ny: Math.max(-maxY, Math.min(maxY, ny)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !frameRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const { nx, ny } = clamp(
      dragRef.current.tx + dx,
      dragRef.current.ty + dy,
      scale,
      frameRef.current.clientWidth,
    );
    setTx(nx);
    setTy(ny);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { dist: d, scale };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current && frameRef.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const next = Math.max(0.5, Math.min(4, pinchRef.current.scale * (d / pinchRef.current.dist)));
      setScale(next);
      const { nx, ny } = clamp(tx, ty, next, frameRef.current.clientWidth);
      setTx(nx);
      setTy(ny);
    }
  }

  useEffect(() => {
    if (frameRef.current) {
      const { nx, ny } = clamp(tx, ty, scale, frameRef.current.clientWidth);
      if (nx !== tx) setTx(nx);
      if (ny !== ty) setTy(ny);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, containMode]);

  async function handleSave() {
    if (!img || !frameRef.current) return;
    setSaving(true);
    const frameSize = frameRef.current.clientWidth;
    const out = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill bg for contain mode
    ctx.fillStyle = "#f3efe7";
    ctx.fillRect(0, 0, out, out);

    const ratio = img.width / img.height;
    let dispW: number;
    let dispH: number;
    if (containMode) {
      // base: fit inside frame
      if (ratio >= 1) {
        dispW = frameSize * scale;
        dispH = (frameSize / ratio) * scale;
      } else {
        dispH = frameSize * scale;
        dispW = frameSize * ratio * scale;
      }
    } else {
      // cover base
      if (ratio >= 1) {
        dispH = frameSize * scale;
        dispW = frameSize * ratio * scale;
      } else {
        dispW = frameSize * scale;
        dispH = (frameSize / ratio) * scale;
      }
    }
    const cx = frameSize / 2 + tx;
    const cy = frameSize / 2 + ty;
    const left = cx - dispW / 2;
    const top = cy - dispH / 2;
    const k = out / frameSize;
    ctx.drawImage(img, left * k, top * k, dispW * k, dispH * k);

    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.88),
    );
    onSave(blob);
  }

  if (!img) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center text-white"
      >
        טוען תמונה...
      </motion.div>
    );
  }

  const ratio = img.width / img.height;
  let imgStyle: React.CSSProperties;
  if (containMode) {
    if (ratio >= 1) {
      imgStyle = { width: `${100 * scale}%`, height: `${(100 / ratio) * scale}%` };
    } else {
      imgStyle = { height: `${100 * scale}%`, width: `${ratio * 100 * scale}%` };
    }
  } else {
    if (ratio >= 1) {
      imgStyle = { height: `${100 * scale}%`, width: `${ratio * 100 * scale}%` };
    } else {
      imgStyle = { width: `${100 * scale}%`, height: `${(100 / ratio) * scale}%` };
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col safe-top safe-bottom"
    >
      <div className="flex items-center justify-between p-4">
        <button onClick={onCancel} className="text-white p-2" aria-label="ביטול">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white/90 text-sm font-semibold">התאמת תמונה</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-white p-2 disabled:opacity-50"
          aria-label="שמור"
        >
          <Check className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div
          ref={frameRef}
          className="relative aspect-square w-full max-w-md bg-black overflow-hidden rounded-2xl touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
        >
          <img
            src={img.src}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
              ...imgStyle,
              maxWidth: "none",
              objectFit: "fill",
              pointerEvents: "none",
            }}
          />
          <div className="absolute inset-0 pointer-events-none ring-2 ring-white/30 rounded-2xl" />
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="text-white/80 p-2 bg-white/10 rounded-full"
            aria-label="הקטן"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-white"
          />
          <button
            onClick={() => setScale((s) => Math.min(4, s + 0.1))}
            className="text-white/80 p-2 bg-white/10 rounded-full"
            aria-label="הגדל"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              setContainMode(false);
              setScale(1);
              setTx(0);
              setTy(0);
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border ${
              !containMode ? "bg-white text-black border-white" : "text-white/80 border-white/30"
            }`}
          >
            מילוי
          </button>
          <button
            onClick={() => {
              setContainMode(true);
              setScale(1);
              setTx(0);
              setTy(0);
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border ${
              containMode ? "bg-white text-black border-white" : "text-white/80 border-white/30"
            }`}
          >
            תמונה מלאה
          </button>
        </div>
        <p className="text-white/50 text-[11px] text-center">
          גרור להזזה • צבוט להגדלה • או השתמש במחוון
        </p>
      </div>
    </motion.div>
  );
}

async function resizeImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image load"));
    i.src = dataUrl;
  });
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((res) => {
    canvas.toBlob((b) => res(b || file), "image/jpeg", quality);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
