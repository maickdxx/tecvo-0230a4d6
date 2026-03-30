import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Clock, Package, AlertTriangle, RotateCcw, Wrench } from "lucide-react";
import type { OperationalStatus } from "@/hooks/useServiceExecution";

const menuItems: {
  status: OperationalStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { status: "in_attendance", label: "Retomar Atendimento", icon: Wrench },
  { status: "waiting_client", label: "Aguardando Cliente", icon: Clock },
  { status: "waiting_part", label: "Aguardando Peça", icon: Package },
  { status: "warranty_return", label: "Retorno / Garantia", icon: RotateCcw },
  { status: "problem", label: "Problema", icon: AlertTriangle },
];

interface Props {
  onSelect: (status: OperationalStatus) => void;
}

export function StatusActionMenu({ onSelect }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.status}
              onClick={() => onSelect(item.status)}
            >
              <Icon className="h-4 w-4 mr-2" />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
