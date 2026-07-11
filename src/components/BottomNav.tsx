import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, BarChart3, Database } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { to: "/", label: "בית", icon: Home },
  { to: "/categories", label: "קטגוריות", icon: LayoutGrid },
  { to: "/stats", label: "סטטיסטיקה", icon: BarChart3 },
  { to: "/backup", label: "גיבוי", icon: Database },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-3 pb-2">
        <div className="bg-surface-elevated/95 backdrop-blur-xl border border-border rounded-3xl shadow-elevated grid grid-cols-4 px-2 py-2">
          {tabs.map((t) => {
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex flex-col items-center justify-center gap-1 py-2 rounded-2xl text-[11px] font-medium transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary-soft rounded-2xl"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative flex flex-col items-center gap-1">
                  <Icon
                    className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className={active ? "text-primary" : "text-muted-foreground"}>{t.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
