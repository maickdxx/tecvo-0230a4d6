import { Snowflake } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

export function TopPlatformSwitcher() {
  const { organization } = useOrganization();

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-11 bg-sidebar border-b border-sidebar-border/60 flex items-center px-4 gap-1 shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-4">
        {organization?.logo_url ? (
          <img
            src={organization.logo_url}
            alt="Logo"
            className="h-6 w-6 rounded-md object-contain"
          />
        ) : (
          <div className="h-6 w-6 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Snowflake className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
          </div>
        )}
        <span className="text-xs font-bold text-sidebar-foreground/80 tracking-widest uppercase hidden sm:block">
          Tecvo
        </span>
      </div>
    </div>
  );
}
