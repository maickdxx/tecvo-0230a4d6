import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  customChange?: ReactNode;
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "destructive";
  href?: string;
  accentBorder?: boolean;
}

const iconColorClasses = {
  primary: "bg-primary/8 text-primary",
  success: "bg-success/8 text-success",
  warning: "bg-warning/8 text-warning",
  destructive: "bg-destructive/8 text-destructive",
};

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  customChange,
  icon: Icon,
  iconColor = "primary",
  href,
  accentBorder = false,
}: StatCardProps) {
  const cardContent = (
    <div className={cn(
      "rounded-[2rem] border border-border/40 bg-card p-8 shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1",
      href && "cursor-pointer",
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold text-card-foreground tracking-tight">{value}</p>
          {customChange ? (
            <div>{customChange}</div>
          ) : change ? (
            <p
              className={cn(
                "text-[11px] mt-0.5",
                changeType === "positive" && "text-success",
                changeType === "negative" && "text-destructive",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          ) : null}
        </div>
        <div className={cn("rounded-xl p-3", iconColorClasses[iconColor])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{cardContent}</Link>;
  }

  return cardContent;
}
