import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Upload, FileUp, AlertTriangle, CheckCircle2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type ImportStep = "upload" | "preview" | "importing" | "done";
type DuplicateAction = "skip" | "update";

interface ParsedContact {
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  company?: string;
  notes?: string;
  tags?: string[];
  isDuplicate?: boolean;
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  channelId: string | null;
  existingPhones: string[]; // normalized phones of existing contacts
  onImported: () => void;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

function parseVcf(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const cards = text.split("BEGIN:VCARD");

  for (const card of cards) {
    if (!card.includes("END:VCARD")) continue;

    let name = "";
    let phone = "";
    let email = "";
    let company = "";
    let notes = "";
    let tags: string[] = [];

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith("FN:") || upper.startsWith("FN;")) {
        name = line.substring(line.indexOf(":") + 1).trim();
      } else if (upper.startsWith("TEL") && line.includes(":")) {
        phone = line.substring(line.indexOf(":") + 1).trim();
      } else if (upper.startsWith("EMAIL") && line.includes(":")) {
        email = line.substring(line.indexOf(":") + 1).trim();
      } else if (upper.startsWith("ORG:") || upper.startsWith("ORG;")) {
        company = line.substring(line.indexOf(":") + 1).trim();
      } else if (upper.startsWith("NOTE:") || upper.startsWith("NOTE;")) {
        notes = line.substring(line.indexOf(":") + 1).trim();
      } else if (upper.startsWith("CATEGORIES:")) {
        tags = line.substring(line.indexOf(":") + 1).split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    if (!phone) continue;

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 10) continue;

    contacts.push({
      name: name || "",
      phone,
      normalizedPhone,
      email: email || undefined,
      company: company || undefined,
      notes: notes || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
  }

  return contacts;
}

function parseCsv(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return contacts;

  // Parse header
  const header = lines[0].split(",").map(h => h.replace(/"/g, "").trim().toLowerCase());
  const nameIdx = header.findIndex(h => h.includes("nome") || h === "name" || h === "fn");
  const phoneIdx = header.findIndex(h => h.includes("telefone") || h.includes("phone") || h.includes("tel") || h.includes("celular"));
  const emailIdx = header.findIndex(h => h.includes("email") || h.includes("e-mail"));
  const companyIdx = header.findIndex(h => h.includes("empresa") || h.includes("company") || h.includes("org"));
  const tagsIdx = header.findIndex(h => h.includes("etiqueta") || h.includes("tag") || h.includes("categor"));
  const notesIdx = header.findIndex(h => h.includes("observ") || h.includes("nota") || h.includes("note"));

  if (phoneIdx === -1 && nameIdx === -1) return contacts;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const phone = values[phoneIdx] || "";
    const name = values[nameIdx] || "";
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length < 10) continue;

    contacts.push({
      name,
      phone,
      normalizedPhone,
      email: emailIdx >= 0 ? values[emailIdx] || undefined : undefined,
      company: companyIdx >= 0 ? values[companyIdx] || undefined : undefined,
      notes: notesIdx >= 0 ? values[notesIdx] || undefined : undefined,
      tags: tagsIdx >= 0 && values[tagsIdx]
        ? values[tagsIdx].split(";").map(t => t.trim()).filter(Boolean)
        : undefined,
    });
  }

  return contacts;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function ImportContactsDialog({
  open,
  onOpenChange,
  organizationId,
  channelId,
  existingPhones,
  onImported,
}: ImportContactsDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("skip");
  const [importResult, setImportResult] = useState({ created: 0, updated: 0, skipped: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setParsed([]);
    setImportResult({ created: 0, updated: 0, skipped: 0 });
  };

  const handleClose = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "vcf" && ext !== "csv") {
      toast.error("Formato não suportado. Use .VCF ou .CSV");
      return;
    }

    const text = await file.text();
    let contacts: ParsedContact[] = [];

    if (ext === "vcf") {
      contacts = parseVcf(text);
    } else {
      contacts = parseCsv(text);
    }

    if (contacts.length === 0) {
      toast.error("Nenhum contato válido encontrado no arquivo");
      return;
    }

    // Deduplicate within file
    const seen = new Set<string>();
    const unique: ParsedContact[] = [];
    for (const c of contacts) {
      if (seen.has(c.normalizedPhone)) continue;
      seen.add(c.normalizedPhone);
      c.isDuplicate = existingPhones.includes(c.normalizedPhone);
      unique.push(c);
    }

    setParsed(unique);
    setStep("preview");
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const duplicates = parsed.filter(c => c.isDuplicate);
  const newContacts = parsed.filter(c => !c.isDuplicate);

  const handleImport = async () => {
    setStep("importing");
    let created = 0;
    let updated = 0;
    let skipped = 0;

    try {
      // Insert new contacts in batches
      const toInsert = newContacts.map(c => ({
        organization_id: organizationId,
        channel_id: channelId,
        name: c.name || null,
        phone: c.phone.startsWith("+") ? c.phone : "+" + c.normalizedPhone,
        normalized_phone: c.normalizedPhone,
        whatsapp_id: c.normalizedPhone + "@s.whatsapp.net",
        is_group: false,
        conversation_status: "novo" as const,
        source: "import" as const,
        has_conversation: false,
        is_name_custom: !!c.name,
        internal_note: c.notes || null,
        tags: c.tags || null,
        visitor_metadata: (c.email || c.company) ? {
          ...(c.email ? { email: c.email } : {}),
          ...(c.company ? { company: c.company } : {}),
        } : null,
      }));

      if (toInsert.length > 0) {
        // Batch insert (max 50 at a time)
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error } = await supabase
            .from("whatsapp_contacts")
            .insert(batch as any);
          if (error) {
            console.error("Insert batch error:", error);
          } else {
            created += batch.length;
          }
        }
      }

      // Handle duplicates
      if (duplicateAction === "update" && duplicates.length > 0) {
        for (const c of duplicates) {
          const updateData: any = {};
          if (c.name) {
            updateData.name = c.name;
            updateData.is_name_custom = true;
          }
          if (c.notes) updateData.internal_note = c.notes;
          if (c.tags) updateData.tags = c.tags;
          if (c.email || c.company) {
            updateData.visitor_metadata = {
              ...(c.email ? { email: c.email } : {}),
              ...(c.company ? { company: c.company } : {}),
            };
          }

          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("whatsapp_contacts")
              .update(updateData)
              .eq("organization_id", organizationId)
              .eq("normalized_phone", c.normalizedPhone);
            if (!error) updated++;
            else skipped++;
          } else {
            skipped++;
          }
        }
      } else {
        skipped = duplicates.length;
      }

      setImportResult({ created, updated, skipped });
      setStep("done");
      onImported();
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || ""));
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar contatos
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Faça upload de um arquivo .VCF ou .CSV para importar contatos."}
            {step === "preview" && "Revise os contatos encontrados antes de importar."}
            {step === "importing" && "Importando contatos..."}
            {step === "done" && "Importação concluída!"}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <input
              ref={fileRef}
              type="file"
              accept=".vcf,.csv"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all p-8 group"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileUp className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  Clique para selecionar arquivo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos aceitos: .VCF (vCard) ou .CSV (Planilha)
                </p>
              </div>
            </button>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4 pt-2">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{parsed.length}</p>
                <p className="text-[11px] text-muted-foreground">Encontrados</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{newContacts.length}</p>
                <p className="text-[11px] text-muted-foreground">Novos</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                <p className="text-lg font-bold text-amber-600">{duplicates.length}</p>
                <p className="text-[11px] text-muted-foreground">Duplicados</p>
              </div>
            </div>

            {/* Duplicate handling */}
            {duplicates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Contatos duplicados ({duplicates.length})
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Estes contatos já existem (mesmo telefone). O que fazer?
                </p>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setDuplicateAction("skip")}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-sm",
                      duplicateAction === "skip"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <span className="font-medium">Ignorar duplicados</span>
                    <span className="text-xs text-muted-foreground ml-auto">Manter os existentes</span>
                  </button>
                  <button
                    onClick={() => setDuplicateAction("update")}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-sm",
                      duplicateAction === "update"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <span className="font-medium">Atualizar existentes</span>
                    <span className="text-xs text-muted-foreground ml-auto">Sobrescrever dados</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sample list */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prévia ({Math.min(parsed.length, 5)} de {parsed.length})
              </Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {parsed.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
                  >
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate flex-1">
                      {c.name || c.phone}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>
                    {c.isDuplicate && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50 shrink-0">
                        Duplicado
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button onClick={handleImport} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Importar {newContacts.length + (duplicateAction === "update" ? duplicates.length : 0)} contato(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando contatos...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Importação concluída!</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-lg font-bold text-emerald-600">{importResult.created}</p>
                <p className="text-[11px] text-muted-foreground">Criados</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{importResult.updated}</p>
                <p className="text-[11px] text-muted-foreground">Atualizados</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-muted-foreground">{importResult.skipped}</p>
                <p className="text-[11px] text-muted-foreground">Ignorados</p>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
