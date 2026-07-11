import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shirt, Sparkles, TrendingUp, Clock, Droplets } from "lucide-react";
import { db, type ClothingItem } from "@/lib/db";
import { useLive } from "@/hooks/useLive";
import { useImageUrl } from "@/hooks/useImageUrl";
import { relativeFromNow, daysSince } from "@/lib/hebrew";

export const Route = createFileRoute("/stats")({
  head: () => ({ meta: [{ title: "סטטיסטיקה" }] }),
  component: StatsPage,
});

function StatsPage() {
  const items = useLive<ClothingItem[]>(() => db().items.toArray(), [], []);

  const totalWears = (items ?? []).reduce((s, i) => s + i.totalWears, 0);
  const totalWashes = (items ?? []).reduce((s, i) => s + i.totalWashes, 0);
  const totalItems = items?.length ?? 0;

  const mostWorn = [...(items ?? [])].sort((a, b) => b.totalWears - a.totalWears).slice(0, 3);
  const stale = [...(items ?? [])]
    .filter((i) => i.lastWornAt && daysSince(i.lastWornAt)! > 14)
    .sort((a, b) => (a.lastWornAt ?? 0) - (b.lastWornAt ?? 0))
    .slice(0, 3);
  const needsWash = [...(items ?? [])].filter((i) => i.wearCount >= 3);

  return (
    <div className="max-w-md mx-auto px-4 pt-4 safe-top">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold font-display">סטטיסטיקה</h1>
        <p className="text-xs text-muted-foreground mt-0.5">סקירה כללית של הארון שלך</p>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <BigStat icon={Shirt} value={totalItems} label="פריטים" />
        <BigStat icon={TrendingUp} value={totalWears} label="לבישות" />
        <BigStat icon={Droplets} value={totalWashes} label="כביסות" />
      </div>

      <Section icon={Sparkles} title="צריכים כביסה" badge={needsWash.length}>
        {needsWash.length === 0 ? (
          <Empty>הכל נקי 🎉</Empty>
        ) : (
          <div className="space-y-2">
            {needsWash.map((it) => (
              <MiniRow key={it.id} item={it} subtitle={`${it.wearCount} לבישות מאז כביסה`} />
            ))}
          </div>
        )}
      </Section>

      <Section icon={TrendingUp} title="הכי נלבשים">
        {mostWorn.length === 0 ? (
          <Empty>אין מספיק נתונים</Empty>
        ) : (
          <div className="space-y-2">
            {mostWorn.map((it) => (
              <MiniRow key={it.id} item={it} subtitle={`${it.totalWears} פעמים`} />
            ))}
          </div>
        )}
      </Section>

      <Section icon={Clock} title="לא נלבשו מזמן">
        {stale.length === 0 ? (
          <Empty>הכל נלבש לאחרונה</Empty>
        ) : (
          <div className="space-y-2">
            {stale.map((it) => (
              <MiniRow key={it.id} item={it} subtitle={relativeFromNow(it.lastWornAt)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function BigStat({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-3xl p-4 text-center shadow-soft"
    >
      <Icon className="w-5 h-5 mx-auto text-primary mb-2" strokeWidth={1.8} />
      <p className="text-2xl font-extrabold num">{value}</p>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-0.5">
        {label}
      </p>
    </motion.div>
  );
}

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: any;
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold mb-2.5 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {title}
        {badge !== undefined && badge > 0 && (
          <span className="num text-xs bg-primary-soft text-primary px-2 py-0.5 rounded-full font-bold">
            {badge}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-6 bg-card rounded-2xl border border-border">
      {children}
    </div>
  );
}

function MiniRow({ item, subtitle }: { item: any; subtitle: string }) {
  const url = useImageUrl(item.imageId);
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="flex items-center gap-3 bg-card border border-border rounded-2xl p-2.5 hover:shadow-soft transition-shadow active:scale-[0.99]"
    >
      <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden shrink-0">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Shirt className="w-5 h-5" strokeWidth={1.4} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </Link>
  );
}
