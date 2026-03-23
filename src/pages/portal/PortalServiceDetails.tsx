import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClientPortal } from "@/contexts/ClientPortalContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Wrench, Camera, FileText, DollarSign, User, MessageCircle, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  scheduled: { label: "Agendado", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  in_progress: { label: "Em andamento", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  completed: { label: "Concluído", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelled: { label: "Cancelado", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
};

const TYPE_MAP: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return "—"; }
}

function generatePortalPDF(service: any, orgName: string, clientName: string, logoUrl?: string | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 25;

  // Header
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(orgName, margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Ordem de Serviço", margin, y);
  y += 20;

  // Client info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Cliente", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clientName, margin, y);
  y += 10;

  // Service details
  const statusLabel = STATUS_CONFIG[service.status]?.label || service.status;
  const typeLabel = TYPE_MAP[service.service_type] || service.service_type;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes do Serviço", margin, y);
  y += 7;

  const details: [string, string][] = [
    ["Tipo", typeLabel],
    ["Status", statusLabel],
  ];
  if (service.scheduled_date || service.entry_date) {
    details.push(["Data", formatDate(service.scheduled_date || service.entry_date)]);
  }
  if (service.completed_date) {
    details.push(["Concluído em", formatDate(service.completed_date)]);
  }
  if (service.technician_name) {
    details.push(["Técnico", service.technician_name]);
  }
  if (service.value != null && service.value > 0) {
    details.push(["Valor", `R$ ${service.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`]);
  }

  doc.setFontSize(10);
  for (const [label, value] of details) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(value, margin + 35, y);
    y += 6;
  }

  // Description
  if (service.description) {
    y += 4;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Descrição", margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(service.description, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5;
  }

  // Equipment / Technical reports
  if (service.equipment && service.equipment.length > 0) {
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Laudo Técnico", margin, y);
    y += 7;

    for (const eq of service.equipment) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      let eqTitle = eq.name;
      if (eq.brand) eqTitle += ` — ${eq.brand}`;
      if (eq.model) eqTitle += ` ${eq.model}`;
      doc.text(eqTitle, margin, y);
      y += 6;

      if (eq.defects) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(220, 38, 38);
        doc.text("Defeitos:", margin, y);
        y += 5;
        doc.setTextColor(30, 41, 59);
        const dLines = doc.splitTextToSize(eq.defects, contentWidth);
        doc.text(dLines, margin, y);
        y += dLines.length * 5;
      }
      if (eq.solution) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(16, 185, 129);
        doc.text("Solução:", margin, y);
        y += 5;
        doc.setTextColor(30, 41, 59);
        const sLines = doc.splitTextToSize(eq.solution, contentWidth);
        doc.text(sLines, margin, y);
        y += sLines.length * 5;
      }
      if (eq.technical_report) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Relatório:", margin, y);
        y += 5;
        doc.setTextColor(30, 41, 59);
        const rLines = doc.splitTextToSize(eq.technical_report, contentWidth);
        doc.text(rLines, margin, y);
        y += rLines.length * 5;
      }
      y += 4;
    }
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — ${orgName}`, margin, footerY);

  doc.save(`OS-${orgName.replace(/\s/g, "_")}.pdf`);
}

export default function PortalServiceDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { session, data } = useClientPortal();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!session) navigate("/portal/login", { replace: true });
  }, [session]);

  const service = data?.services?.find(s => s.id === id);

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col items-center justify-center p-4 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium">Serviço não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/portal/dashboard")} className="rounded-xl">Voltar</Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[service.status] || { label: service.status, bg: "bg-accent", text: "text-muted-foreground", border: "border-border" };
  const whatsappNumber = data?.portal_config?.contact_phone || data?.organization?.whatsapp_owner || data?.organization?.phone;
  const orgName = data?.portal_config?.display_name || data?.organization?.name || "Empresa";
  const clientName = data?.client?.name || "Cliente";
  const logoUrl = data?.portal_config?.logo_url || data?.organization?.logo_url;

  const handleWhatsApp = () => {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      generatePortalPDF(service, orgName, clientName, logoUrl);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-border/40 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/portal/dashboard")}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-foreground">Detalhes do Serviço</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5 animate-fade-in">
        {/* Status + Type Card */}
        <div className={`bg-card rounded-2xl border-2 ${cfg.border} shadow-md shadow-black/[0.04] p-5 relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: service.status === "scheduled" ? "#3b82f6" : service.status === "in_progress" ? "#f59e0b" : service.status === "completed" ? "#10b981" : "#ef4444" }}
          />

          <div className="flex items-center justify-between mb-4 pt-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
              {service.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
               service.status === "in_progress" ? <Wrench className="h-3.5 w-3.5" /> :
               service.status === "cancelled" ? <Clock className="h-3.5 w-3.5" /> :
               <Calendar className="h-3.5 w-3.5" />}
              {cfg.label}
            </span>
            <span className="text-xs font-medium text-muted-foreground bg-accent/50 px-2.5 py-1 rounded-lg">
              {TYPE_MAP[service.service_type] || service.service_type}
            </span>
          </div>

          {service.description && (
            <p className="text-sm text-foreground mb-5 leading-relaxed">{service.description}</p>
          )}

          <div className="space-y-2">
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Data" value={formatDate(service.scheduled_date || service.entry_date)} />
            {service.completed_date && (
              <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} label="Concluído em" value={formatDate(service.completed_date)} />
            )}
            {service.technician_name && (
              <InfoRow icon={<User className="h-4 w-4" />} label="Técnico" value={service.technician_name} />
            )}
            {service.value != null && service.value > 0 && (
              <InfoRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Valor"
                value={`R$ ${service.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                highlight
              />
            )}
          </div>
        </div>

        {/* Download PDF Button */}
        <Button
          onClick={handleDownloadPDF}
          disabled={downloadingPdf}
          variant="outline"
          className="w-full gap-2.5 h-12 rounded-xl font-semibold border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
        >
          {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar ordem de serviço
        </Button>

        {/* Photos */}
        {service.photos.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: "100ms" }}>
            <h3 className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
              <Camera className="h-3.5 w-3.5" /> Fotos ({service.photos.length})
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {service.photos.map((photo, i) => (
                <a
                  key={i}
                  href={photo.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-square rounded-xl overflow-hidden bg-accent border border-border/60 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
                >
                  <img
                    src={photo.photo_url}
                    alt={photo.description || `Foto ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {photo.photo_type && (
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium rounded-md">
                      {photo.photo_type === "before" ? "Antes" : photo.photo_type === "after" ? "Depois" : photo.photo_type}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Technical Reports */}
        {service.equipment.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: "150ms" }}>
            <h3 className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
              <FileText className="h-3.5 w-3.5" /> Laudo Técnico
            </h3>
            <div className="space-y-2.5">
              {service.equipment.map((eq, i) => (
                <div key={i} className="bg-card rounded-xl border border-border/60 shadow-sm p-4 text-sm">
                  <p className="font-semibold text-foreground mb-3">
                    {eq.name}
                    {eq.brand && <span className="text-muted-foreground font-normal"> — {eq.brand}</span>}
                    {eq.model && <span className="text-muted-foreground font-normal"> {eq.model}</span>}
                  </p>
                  {eq.defects && (
                    <div className="mb-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Defeitos</span>
                      <p className="text-foreground mt-1">{eq.defects}</p>
                    </div>
                  )}
                  {eq.solution && (
                    <div className="mb-3 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Solução</span>
                      <p className="text-foreground mt-1">{eq.solution}</p>
                    </div>
                  )}
                  {eq.technical_report && (
                    <div className="p-3 rounded-lg bg-accent/50 border border-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Relatório</span>
                      <p className="text-foreground mt-1 whitespace-pre-wrap leading-relaxed">{eq.technical_report}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* WhatsApp CTA */}
        {whatsappNumber && (
          <div className="animate-fade-in pt-1" style={{ animationDelay: "200ms" }}>
            <Button
              onClick={handleWhatsApp}
              className="w-full gap-2.5 h-14 text-base font-semibold rounded-2xl bg-[#25D366] hover:bg-[#1fba59] text-white shadow-lg shadow-[#25D366]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
            >
              <MessageCircle className="h-5 w-5" />
              Falar no WhatsApp
            </Button>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground/50 py-6">
        Powered by <span className="font-semibold text-muted-foreground/70">Tecvo</span>
      </footer>
    </div>
  );
}

function InfoRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3.5 rounded-xl ${highlight ? "bg-primary/5 border border-primary/10" : "bg-accent/30"}`}>
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`ml-auto text-right text-sm ${highlight ? "font-bold text-primary" : "font-medium text-foreground"}`}>{value}</span>
    </div>
  );
}
