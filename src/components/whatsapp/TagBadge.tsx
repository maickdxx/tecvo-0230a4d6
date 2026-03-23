import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTagColorStyle } from "@/hooks/useWhatsAppTags";

interface TagBadgeProps {
  tag: string;
  color?: string;
  onRemove?: () => void;
  size?: "sm" | "xs";
}

export function TagBadge({ tag, color = "gray", onRemove, size = "sm" }: TagBadgeProps) {
  const style = getTagColorStyle(color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border font-medium",
        style.bg, style.text, style.border,
        size === "xs" ? "text-[9px] px-1 py-0 h-4" : "text-[10px] px-1.5 py-0.5"
      )}
    >
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-70 ml-0.5">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
