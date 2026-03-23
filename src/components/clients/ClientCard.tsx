import { Phone, Mail, MapPin, MoreVertical, Pencil, Trash2, History, Map, CalendarPlus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Client } from "@/hooks/useClients";
import type { ClientMetrics } from "@/pages/Clientes";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onViewHistory: (client: Client) => void;
  onCreateOS?: (clientId: string) => void;
  metrics?: ClientMetrics;
}

function formatAddress(client: Client): string | null {
  const parts = [];
  
  if (client.street) {
    let streetPart = client.street;
    if (client.number) {
      streetPart += `, ${client.number}`;
    }
    parts.push(streetPart);
  }
  
  if (client.neighborhood) {
    parts.push(client.neighborhood);
  }
  
  if (client.city && client.state) {
    parts.push(`${client.city}/${client.state}`);
  } else if (client.city) {
    parts.push(client.city);
  }
  
  return parts.length > 0 ? parts.join(" - ") : client.address;
}

function openInMaps(client: Client) {
  const addressParts = [
    client.street,
    client.number,
    client.neighborhood,
    client.city,
    client.state,
    client.zip_code
  ].filter(Boolean);
  
  const address = addressParts.length > 0 
    ? addressParts.join(', ') 
    : client.address;
  
  if (!address) return;
  
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  window.open(url, '_blank');
}

function hasAddress(client: Client): boolean {
  return !!(client.street || client.city || client.address);
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  window.open(`https://wa.me/${number}`, "_blank");
}

function getStatusBadges(metrics?: ClientMetrics) {
  if (!metrics) return [];
  const badges: { label: string; className: string }[] = [];

  if (metrics.lastServiceDate) {
    const diffMs = new Date().getTime() - new Date(metrics.lastServiceDate).getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMonths < 3) {
      badges.push({ label: "Ativo", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" });
    } else if (diffMonths < 6) {
      badges.push({ label: "Inativo", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" });
    } else {
      badges.push({ label: "Reativar", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" });
    }
  }

  if (metrics.hasScheduled) {
    badges.push({ label: "Agendado", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" });
  }

  if (metrics.hasPendingPayment) {
    badges.push({ label: "Pgto Pendente", className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20" });
  }

  return badges;
}

export function ClientCard({ client, onEdit, onDelete, onViewHistory, onCreateOS, metrics }: ClientCardProps) {
  const formattedAddress = formatAddress(client);
  const canOpenMaps = hasAddress(client);
  const badges = getStatusBadges(metrics);

  const renderMenuItems = (Item: typeof DropdownMenuItem) => (
    <>
      <Item onClick={() => onViewHistory(client)}>
        <History className="mr-2 h-4 w-4" />
        Histórico
      </Item>
      <Item onClick={() => onEdit(client)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Item>
      <Item
        onClick={() => onDelete(client)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Excluir
      </Item>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card className="transition-all duration-200 hover:shadow-card-hover hover:border-primary/10 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                  {badges.map((b) => (
                    <Badge key={b.label} variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-medium rounded-full ${b.className}`}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </div>

                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}

                {formattedAddress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{formattedAddress}</span>
                    {canOpenMaps && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInMaps(client);
                        }}
                        title="Abrir no Maps"
                      >
                        <Map className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {renderMenuItems(DropdownMenuItem)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {client.notes && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {client.notes}
              </p>
            )}

            {/* Indicadores estratégicos */}
            <Separator className="my-2" />
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {metrics && metrics.totalServices > 0 ? (
                <>
                  <span>Último: {new Date(metrics.lastServiceDate!).toLocaleDateString("pt-BR")}</span>
                  <span>Faturado: R$ {metrics.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <span>{metrics.totalServices} serviço{metrics.totalServices !== 1 ? "s" : ""}</span>
                </>
              ) : (
                <span>Sem serviços ainda</span>
              )}
            </div>

            {/* Ações rápidas */}
            <div className="flex items-center gap-1 mt-2">
              {onCreateOS && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => { e.stopPropagation(); onCreateOS(client.id); }}
                  title="Criar OS"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); openWhatsApp(client.phone); }}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onViewHistory(client); }}
                title="Histórico"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {renderMenuItems(ContextMenuItem)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
