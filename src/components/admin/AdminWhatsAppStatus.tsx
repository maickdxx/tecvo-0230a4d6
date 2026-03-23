import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

interface ChannelInfo {
  id: string;
  instance_name: string;
  name: string;
  is_connected: boolean;
  phone_number: string | null;
  last_connected_at: string | null;
  channel_type: string;
  organization_id: string;
  organization_name: string;
  created_at: string;
}

interface LiveStatus {
  state: string;
  phone_number: string | null;
  error_message: string | null;
  checked_at: string;
}

export function AdminWhatsAppStatus() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [qrCodes, setQrCodes] = useState<Record<string, string | null>>({});
  const [qrStrings, setQrStrings] = useState<Record<string, string | null>>({});
  const [qrLoading, setQrLoading] = useState<Record<string, boolean>>({});
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-admin-status", {
        body: { action: "list" },
      });
      if (data?.channels) {
        setChannels(data.channels);
      }
    } catch (e) {
      console.error("Failed to fetch channels:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async (instanceName: string) => {
    setStatusLoading(prev => ({ ...prev, [instanceName]: true }));
    try {
      const { data } = await supabase.functions.invoke("whatsapp-admin-status", {
        body: { action: "status", instance_name: instanceName },
      });
      if (data?.ok) {
        setLiveStatus(prev => ({
          ...prev,
          [instanceName]: {
            state: data.state,
            phone_number: data.phone_number,
            error_message: data.error_message,
            checked_at: data.checked_at,
          },
        }));

        // If connected, clear QR
        if (data.state === "open") {
          setQrCodes(prev => ({ ...prev, [instanceName]: null }));
        }
      }
    } catch (e) {
      console.error("Failed to fetch status:", e);
    } finally {
      setStatusLoading(prev => ({ ...prev, [instanceName]: false }));
    }
  }, []);

  const fetchQR = useCallback(async (instanceName: string) => {
    setQrLoading(prev => ({ ...prev, [instanceName]: true }));
    try {
      const { data } = await supabase.functions.invoke("whatsapp-admin-status", {
        body: { action: "qrcode", instance_name: instanceName },
      });
      console.log("[AdminWhatsApp] QR response:", data);
      if (data?.ok) {
        if (data.state === "open") {
          setQrCodes(prev => ({ ...prev, [instanceName]: null }));
          setQrStrings(prev => ({ ...prev, [instanceName]: null }));
          setLiveStatus(prev => ({
            ...prev,
            [instanceName]: {
              ...prev[instanceName],
              state: "open",
              checked_at: data.checked_at,
            },
          }));
        } else {
          setQrCodes(prev => ({ ...prev, [instanceName]: data.qrcode }));
          setQrStrings(prev => ({ ...prev, [instanceName]: data.qr_string }));
        }
      }
    } catch (e) {
      console.error("Failed to fetch QR:", e);
    } finally {
      setQrLoading(prev => ({ ...prev, [instanceName]: false }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-fetch status for all channels on load
  useEffect(() => {
    if (channels.length > 0) {
      channels.forEach(ch => fetchStatus(ch.instance_name));
    }
  }, [channels, fetchStatus]);

  // Polling for selected instance (every 8 seconds)
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (selectedInstance) {
      pollingRef.current = setInterval(() => {
        const status = liveStatus[selectedInstance];
        if (status?.state === "open") {
          // If connected, just check status less frequently
          fetchStatus(selectedInstance);
        } else {
          // If not connected, fetch QR + status
          fetchQR(selectedInstance);
          fetchStatus(selectedInstance);
        }
      }, 8000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedInstance, liveStatus, fetchStatus, fetchQR]);

  const getStateBadge = (instanceName: string) => {
    const status = liveStatus[instanceName];
    if (!status) return <Badge variant="outline">Desconhecido</Badge>;

    switch (status.state) {
      case "open":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case "close":
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
            <WifiOff className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
      case "connecting":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Conectando
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            {status.state}
          </Badge>
        );
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Status do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Status do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Nenhuma instância de WhatsApp encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Instâncias de WhatsApp ({channels.length})
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchChannels}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channels.map((ch) => {
              const isSelected = selectedInstance === ch.instance_name;
              const status = liveStatus[ch.instance_name];
              const isOpen = status?.state === "open";

              return (
                <div
                  key={ch.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() =>
                    setSelectedInstance(isSelected ? null : ch.instance_name)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {ch.instance_name}
                        </span>
                        {getStateBadge(ch.instance_name)}
                        <Badge variant="outline" className="text-xs">
                          {ch.channel_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ch.organization_name}
                      </p>
                      {(isOpen && status?.phone_number) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Wifi className="h-3 w-3 text-green-500" />
                          {status.phone_number}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchStatus(ch.instance_name);
                        }}
                        disabled={statusLoading[ch.instance_name]}
                      >
                        {statusLoading[ch.instance_name] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Última conexão:</span>
                          <p className="font-mono">{formatDate(ch.last_connected_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Última verificação:</span>
                          <p className="font-mono">{formatDate(status?.checked_at || null)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Criado em:</span>
                          <p className="font-mono">{formatDate(ch.created_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Organização:</span>
                          <p>{ch.organization_name}</p>
                        </div>
                      </div>

                      {/* QR Code section */}
                      {!isOpen && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchQR(ch.instance_name);
                              }}
                              disabled={qrLoading[ch.instance_name]}
                            >
                              {qrLoading[ch.instance_name] ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <QrCode className="h-4 w-4 mr-1" />
                              )}
                              Gerar QR Code
                            </Button>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Atualiza a cada 8s automaticamente
                            </span>
                          </div>

                          {qrCodes[ch.instance_name] ? (
                            <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-card rounded-lg border">
                              <p className="text-sm text-muted-foreground font-medium">
                                📱 Leia este QR com o WhatsApp da instância para reconectar
                              </p>
                              <img
                                src={
                                  qrCodes[ch.instance_name]!.startsWith("data:")
                                    ? qrCodes[ch.instance_name]!
                                    : `data:image/png;base64,${qrCodes[ch.instance_name]!}`
                                }
                                alt="QR Code WhatsApp"
                                className="w-64 h-64 object-contain"
                              />
                              <p className="text-xs text-muted-foreground">
                                Atualizado: {formatDate(status?.checked_at || new Date().toISOString())}
                              </p>
                            </div>
                          ) : qrStrings[ch.instance_name] ? (
                            <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-card rounded-lg border">
                              <p className="text-sm text-muted-foreground font-medium">
                                📱 QR String (copie e cole no leitor de QR):
                              </p>
                              <code className="text-xs bg-muted p-3 rounded break-all max-w-md">
                                {qrStrings[ch.instance_name]}
                              </code>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Instância sem QR no momento. Clique em "Gerar QR Code" para iniciar a conexão.
                            </p>
                          )}
                        </div>
                      )}

                      {isOpen && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              Instância conectada
                            </p>
                            {status?.phone_number && (
                              <p className="text-xs text-green-600 dark:text-green-500">
                                Número: {status.phone_number}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {status?.error_message && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {status.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
