import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shirt, Sparkles } from "lucide-react";
import type { ClothingItem, Category } from "@/lib/db";
import { useImageUrl } from "@/hooks/useImageUrl";
import { relativeFromNow } from "@/lib/hebrew";

export function ItemCard({
  item,
  category,
  index = 0,
  washThreshold = 3,
}: {
  item: ClothingItem;
  category?: Category;
  index?: number;
  washThreshold?: number;
}) {
  const url = useImageUrl(item.imageId);
  const needsWash = item.wearCount >= washThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to="/items/$itemId"
        params={{ itemId: item.id }}
        className="group block bg-card rounded-3xl overflow-hidden border border-border shadow-soft hover:shadow-card active:scale-[0.98] transition-all duration-200"
      >
        <div className="relative aspect-square bg-secondary overflow-hidden">
          {url ? (
            <img
              src={url}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Shirt className="w-12 h-12" strokeWidth={1.3} />
            </div>
          )}
          {needsWash && (
            <div className="absolute top-2 start-2 bg-warning/95 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-soft flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              לכביסה
            </div>
          )}
          {category && (
            <div className="absolute top-2 end-2 bg-surface-elevated/90 backdrop-blur-md text-[11px] font-medium px-2 py-1 rounded-full border border-border">
              <span>{category.icon}</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm leading-tight truncate">{item.name}</h3>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{relativeFromNow(item.lastWornAt)}</span>
            <span className="font-mono num bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-md font-bold">
              {item.wearCount}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
