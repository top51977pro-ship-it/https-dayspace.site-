import { Shirt } from "lucide-react";
import { motion } from "framer-motion";

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6"
    >
      <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground mb-4">
        <Shirt className="w-9 h-9" strokeWidth={1.3} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
