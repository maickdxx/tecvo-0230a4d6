import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Building2, Users, Settings } from "lucide-react";
import { AdminOrgDialog } from "./AdminOrgDialog";
import { type AdminOrganization, type UsageData } from "@/hooks/useAdminOrganizations";

interface AdminOrgListProps {
  organizations: AdminOrganization[];
  onUpdatePlan: (orgId: string, plan: string, expiresAt: string | null) => void;
  onDelete: (orgId: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
  usageMap?: Map<string, UsageData>;
}

export function AdminOrgList({
  organizations,
  onUpdatePlan,
  onDelete,
  isUpdating,
  isDeleting,
  usageMap,
}: AdminOrgListProps) {
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null);

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.email?.toLowerCase().includes(search.toLowerCase()) ||
    org.cnpj_cpf?.includes(search)
  );

  const planLabel = (plan: string | null) => {
    switch (plan) {
      case "pro": return "Profissional";
      case "essential": return "Essencial";
      case "starter": return "Starter";
      default: return "Gratuito";
    }
  };

  const planVariant = (plan: string | null): "default" | "secondary" | "outline" => {
    switch (plan) {
      case "pro": return "default";
      case "essential": return "secondary";
      case "starter": return "outline";
      default: return "outline";
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizações Cadastradas
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar organização..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                  <TableHead className="hidden sm:table-cell">Usuários</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma organização encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{org.name}</span>
                          {org.email && (
                            <span className="text-xs text-muted-foreground">
                              {org.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={planVariant(org.plan)}>
                          {planLabel(org.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {org.profiles.length}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrg(org)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Gerenciar</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AdminOrgDialog
        organization={selectedOrg}
        open={!!selectedOrg}
        onOpenChange={(open) => !open && setSelectedOrg(null)}
        onUpdatePlan={onUpdatePlan}
        onDelete={onDelete}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        usageData={selectedOrg ? usageMap?.get(selectedOrg.id) : undefined}
      />
    </>
  );
}
