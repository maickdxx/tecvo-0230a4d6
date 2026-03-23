import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface TechOption {
  userId: string;
  fullName: string;
}

interface Props {
  technicians: TechOption[];
  selectedTechId: string;
  onSelect: (techId: string) => void;
}

export function ManagerTechFilter({ technicians, selectedTechId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedTechId} onValueChange={onSelect}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Todos os Técnicos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Técnicos</SelectItem>
          {technicians.map((t) => (
            <SelectItem key={t.userId} value={t.userId}>
              {t.fullName || "Sem nome"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
