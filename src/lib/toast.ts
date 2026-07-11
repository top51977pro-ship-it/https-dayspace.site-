import { toast } from "sonner";
import { undoLast } from "@/lib/store";

export function showActionToast(message: string) {
  toast(message, {
    duration: 4000,
    action: {
      label: "בטל",
      onClick: async () => {
        const undone = await undoLast();
        if (undone) {
          toast("הפעולה בוטלה", { duration: 1500 });
        }
      },
    },
  });
}
