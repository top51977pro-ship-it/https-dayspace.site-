import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, isBrowser } from "@/lib/db";

export function useImageUrl(imageId: string | null | undefined): string | null {
  const blob = useLiveQuery(
    async () => {
      if (!imageId || !isBrowser()) return null;
      const img = await db().images.get(imageId);
      return img?.blob ?? null;
    },
    [imageId],
  );

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  return url;
}
