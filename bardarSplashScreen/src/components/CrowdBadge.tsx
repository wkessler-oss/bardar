import { cn } from "@/lib/utils";

export const CROWD_LABELS = ["", "Empty", "Chill", "Busy", "Packed"] as const;

export function crowdMeta(level: number | null | undefined) {
  if (!level) return { label: "No reports", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", emoji: "·" };
  const rounded = Math.min(4, Math.max(1, Math.round(level)));
  switch (rounded) {
    case 1:
      return { label: "Empty", color: "bg-muted text-foreground", dot: "bg-muted-foreground", emoji: "·" };
    case 2:
      return { label: "Chill", color: "bg-success/15 text-success", dot: "bg-success", emoji: "🟢" };
    case 3:
      return { label: "Busy", color: "bg-warning/15 text-warning", dot: "bg-warning", emoji: "🟡" };
    case 4:
    default:
      return { label: "Packed", color: "bg-destructive/15 text-destructive", dot: "bg-destructive", emoji: "🔴" };
  }
}

export function CrowdBadge({
  level,
  source,
  className,
}: {
  level: number | null | undefined;
  source?: "live" | "estimate" | "none";
  className?: string;
}) {
  const meta = crowdMeta(level);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        meta.color,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot, source === "live" && level && "pulse-glow")} />
      {meta.label}
      {source === "live" ? <span className="ml-0.5 text-[10px] opacity-70">LIVE</span> : null}
      {source === "estimate" ? <span className="ml-0.5 text-[10px] opacity-70">EST</span> : null}
    </span>
  );
}