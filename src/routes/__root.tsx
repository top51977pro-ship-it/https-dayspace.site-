import "@fontsource/heebo/300.css";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/600.css";
import "@fontsource/heebo/700.css";
import "@fontsource/heebo/800.css";
import "@fontsource/assistant/400.css";
import "@fontsource/assistant/600.css";
import "@fontsource/assistant/700.css";
import "@fontsource/assistant/800.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "@/components/BottomNav";
import { ensureSeed } from "@/lib/store";
import { isBrowser } from "@/lib/db";
import { checkWashReminders } from "@/lib/notifications";
import { initNative } from "@/lib/native-init";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">הדף לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">הדף שחיפשת לא קיים או הוסר.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            חזרה לבית
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">משהו השתבש</h1>
        <p className="mt-2 text-sm text-muted-foreground">לא הצלחנו לטעון את הדף. נסה לרענן או חזור לבית.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            נסה שוב
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-input bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            חזרה לבית
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FAF7F2" },
      { title: "הארון שלי — מעקב בגדים" },
      { name: "description", content: "אפליקציה אישית לניהול ארון הבגדים ומעקב לבישות וכביסות" },
      { property: "og:title", content: "הארון שלי — מעקב בגדים" },
      { property: "og:description", content: "אפליקציה אישית לניהול ארון הבגדים ומעקב לבישות וכביסות" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "הארון שלי — מעקב בגדים" },
      { name: "twitter:description", content: "אפליקציה אישית לניהול ארון הבגדים ומעקב לבישות וכביסות" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/nj6tlQ5ZvuQNq2mGyrhhpeZG5AZ2/social-images/social-1781967662909-1000110555.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/nj6tlQ5ZvuQNq2mGyrhhpeZG5AZ2/social-images/social-1781967662909-1000110555.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isBrowser()) {
      ensureSeed().catch((e) => console.error("seed failed", e));
      // Native bootstrap: notification permission + Samsung battery exemption (no-op on web)
      initNative().catch((e) => console.error("native init failed", e));
      // Check for wash reminders on app open, and when tab becomes visible
      const run = () => checkWashReminders().catch(() => {});
      run();
      const onVis = () => { if (document.visibilityState === "visible") run(); };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }
  }, []);

  // Hide bottom nav on fullscreen flows (camera/edit)
  const hideNav =
    pathname.startsWith("/items/new") ||
    /\/items\/[^/]+\/edit$/.test(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen pb-28">
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
      <Toaster position="bottom-center" dir="rtl" toastOptions={{ className: "font-sans" }} />
    </QueryClientProvider>
  );
}
