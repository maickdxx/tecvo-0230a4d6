import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, QrCode, Loader2, RefreshCw, CheckCircle2, Smartphone } from "lucide-react";
import { useWhatsAppChannel } from "@/hooks/useWhatsAppChannel";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export function WhatsAppOnboarding() {
  const { organization } = useOrganization();
  const { createInstance, fetchQRCode, checkStatus, qrCode, qrLoading, channel, refetch } = useWhatsAppChannel();
  const [showQrModal, setShowQrModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  // Generate a unique instance name from org id
  const generateInstanceName = useCallback(() => {
    if (!organization?.id) return "";
    // Pattern: org-<first 12 chars of uuid without hyphens>
    return `org-${organization.id.replace(/-/g, "").substring(0, 12)}`;
  }, [organization?.id]);

  const handleConnect = async () => {
    if (!organization?.id) return;

    setConnecting(true);
    try {
      // If a CUSTOMER_INBOX channel already exists, just reopen QR flow
      if (channel?.id) {
        setShowQrModal(true);
        await fetchQRCode();
        return;
      }

      const instanceName = generateInstanceName();
      const result = await createInstance(instanceName);

      if (result?.ok) {
        setShowQrModal(true);
        // If QR wasn't returned inline, fetch it after channel creation settles
        if (!result.qrcode) {
          setTimeout(() => fetchQRCode(), 1500);
        }
      } else {
        toast.error("Falha ao criar instância. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
    } finally {
      setConnecting(false);
    }
  };

  // Poll status while QR modal is open
  useEffect(() => {
    if (!showQrModal || !channel?.id) return;
    const interval = setInterval(async () => {
      const status = await checkStatus();
      if (status?.connected) {
        setConnected(true);
        clearInterval(interval);
        setTimeout(() => {
          setShowQrModal(false);
          refetch();
        }, 2000);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [showQrModal, channel?.id, checkStatus, refetch]);

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Conecte seu WhatsApp</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vincule o WhatsApp da sua empresa para receber e responder mensagens dos seus clientes diretamente por aqui.
            </p>
          </div>
          <div className="space-y-3 text-left bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <p className="text-sm text-muted-foreground">Clique em "Conectar WhatsApp" abaixo</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <p className="text-sm text-muted-foreground">Escaneie o QR Code com o WhatsApp do celular da empresa</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <p className="text-sm text-muted-foreground">Pronto! As mensagens aparecerão aqui automaticamente</p>
            </div>
          </div>
          <Button size="lg" onClick={handleConnect} disabled={connecting} className="gap-2 w-full sm:w-auto">
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            {connecting ? "Preparando conexão..." : "Conectar WhatsApp"}
          </Button>
        </div>
      </div>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Escaneie o QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {connected ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
                <p className="text-sm font-medium text-primary">WhatsApp conectado com sucesso!</p>
              </div>
            ) : qrLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : qrCode ? (
              <>
                <div className="bg-white p-3 rounded-lg">
                  <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
                </p>
                <Button variant="outline" size="sm" onClick={fetchQRCode} disabled={qrLoading} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar QR Code
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted-foreground">QR Code não disponível</p>
                <Button variant="outline" size="sm" onClick={fetchQRCode} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gerar QR Code
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}