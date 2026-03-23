import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function DashboardSection({ title, icon: Icon, children, defaultOpen = false }: DashboardSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 py-2.5 group cursor-pointer">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent ml-2" />
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-300",
          open && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden pt-3 space-y-5 animate-fade-in">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
