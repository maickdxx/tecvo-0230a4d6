import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, Contact, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getContactDisplayName } from "@/lib/whatsappContactName";

type ExportFormat = "vcf" | "csv";
type ExportScope = "all" | "filtered";

interface ExportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allContacts: any[];
  filteredContacts: any[];
  hasActiveFilters: boolean;
}

function contactToVCard(c: any): string {
  const name = getContactDisplayName(c);
  const phone = c.phone || "";
  const email = c.visitor_metadata?.email || "";
  const company = c.visitor_metadata?.company || "";
  const note = c.internal_note || "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:${name};;;;`,
  ];
  if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
  if (email) lines.push(`EMAIL:${email}`);
  if (company) lines.push(`ORG:${company}`);
  if (note) lines.push(`NOTE:${note}`);
  if (c.tags?.length) lines.push(`CATEGORIES:${c.tags.join(",")}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function contactsToCsv(contacts: any[]): string {
  const header = "Nome,Telefone,Email,Empresa,Etiquetas,Observações";
  const rows = contacts.map(c => {
    const name = getContactDisplayName(c);
    const phone = c.phone || "";
    const email = c.visitor_metadata?.email || "";
    const company = c.visitor_metadata?.company || "";
    const tags = (c.tags || []).join("; ");
    const notes = (c.internal_note || "").replace(/"/g, '""');
    return [name, phone, email, company, tags, notes]
      .map(v => `"${v}"`)
      .join(",");
  });
  return [header, ...rows].join("\r\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportContactsDialog({
  open,
  onOpenChange,
  allContacts,
  filteredContacts,
  hasActiveFilters,
}: ExportContactsDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("vcf");
  const [scope, setScope] = useState<ExportScope>("all");
  const [exporting, setExporting] = useState(false);

  const contactsToExport = scope === "filtered" ? filteredContacts : allContacts;
  const count = contactsToExport.length;

  const handleExport = () => {
    if (count === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      if (format === "vcf") {
        const vcf = contactsToExport.map(contactToVCard).join("\r\n");
        downloadFile(vcf, `contatos-tecvo-${date}.vcf`, "text/vcard");
      } else {
        const csv = contactsToCsv(contactsToExport);
        downloadFile(csv, `contatos-tecvo-${date}.csv`, "text/csv");
      }
      toast.success(`${count} contato(s) exportado(s) com sucesso`);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao exportar contatos");
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    {
      value: "vcf" as const,
      icon: Contact,
      label: "VCF (vCard)",
      desc: "Formato completo com todos os dados. Importação fácil em celulares e apps.",
    },
    {
      value: "csv" as const,
      icon: FileSpreadsheet,
      label: "CSV (Planilha)",
      desc: "Formato simples com nome, telefone, email. Ideal para planilhas.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar contatos
          </DialogTitle>
          <DialogDescription>
            Escolha o formato e quais contatos exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Formato do arquivo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map(opt => {
                const Icon = opt.icon;
                const selected = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                        {opt.label}
                      </span>
                    </div>
                    <span className="text-[11px] leading-tight text-muted-foreground">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contatos
            </Label>
            <div className="space-y-1.5">
              <button
                onClick={() => setScope("all")}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all",
                  scope === "all"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/30"
                )}
              >
                <span className="text-sm font-medium">Todos os contatos</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {allContacts.length}
                </span>
              </button>
              <button
                onClick={() => setScope("filtered")}
                disabled={!hasActiveFilters}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all",
                  scope === "filtered"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/30",
                  !hasActiveFilters && "opacity-40 cursor-not-allowed"
                )}
              >
                <span className="text-sm font-medium">Contatos filtrados</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {filteredContacts.length}
                </span>
              </button>
              {!hasActiveFilters && (
                <p className="text-[11px] text-muted-foreground/60 pl-1">
                  Use busca ou filtros na tela de contatos para habilitar essa opção.
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={exporting || count === 0} className="gap-1.5">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar {count} contato{count !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
