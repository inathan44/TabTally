import type { LucideIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface GroupBadgeProps {
  icon: LucideIcon;
  label: string;
  variant?: "secondary" | "outline";
  className?: string;
}

export function GroupBadge({
  icon: Icon,
  label,
  variant = "secondary",
  className,
}: GroupBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn("gap-1 text-xs font-normal", className)}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
