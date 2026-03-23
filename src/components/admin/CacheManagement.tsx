import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Trash2, RefreshCw, HardDrive, Clock, Zap } from "lucide-react";
import { toast } from "sonner";

interface CacheEntry {
  key: string;
  type: string;
  size: string;
  hits: number;
  misses: number;
  hitRate: number;
  lastAccessed: string;
  expiresAt?: string;
}

export function CacheManagement() {
  const [isClearing, setIsClearing] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  const [cacheStats] = useState({
    totalSize: "2.4 GB",
    usedSize: "1.8 GB",
    usedPercentage: 75,
    entries: 15428,
    hitRate: 94.2,
    avgResponseTime: 12,
  });

  const [cacheEntries] = useState<CacheEntry[]>([
    {
      key: "dashboard:metrics:*",
      type: "Redis",
      size: "245 MB",
      hits: 125890,
      misses: 3240,
      hitRate: 97.5,
      lastAccessed: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    {
      key: "whatsapp:conversations:*",
      type: "Redis",
      size: "512 MB",
      hits: 234120,
      misses: 8920,
      hitRate: 96.3,
      lastAccessed: new Date(Date.now() - 1000 * 60).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
    {
      key: "services:list:*",
      type: "Redis",
      size: "128 MB",
      hits: 89430,
      misses: 2340,
      hitRate: 97.4,
      lastAccessed: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      key: "clients:profiles:*",
      type: "Memory",
      size: "64 MB",
      hits: 45230,
      misses: 1890,
      hitRate: 96.0,
      lastAccessed: new Date(Date.now() - 1000 * 30).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
    },
    {
      key: "financial:reports:*",
      type: "Redis",
      size: "186 MB",
      hits: 23450,
      misses: 890,
      hitRate: 96.3,
      lastAccessed: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  ]);

  const handleClearExpired = async () => {
    setIsClearing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsClearing(false);
    toast.success("Cache expirado removido");
  };

  const handleFlushAll = async () => {
    setIsFlushing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsFlushing(false);
    toast.success("Todo o cache foi limpo");
  };

  const handleClearEntry = (key: string) => {
    toast.success(`Cache ${key} removido`);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return "agora";
    if (diff < 60) return `${diff}min atras`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atras`;
    return `${Math.floor(diff / 1440)}d atras`;
  };

  const formatExpiry = (timestamp?: string) => {
    if (!timestamp) return "Sem expiracao";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((date.getTime() - now.getTime()) / 1000 / 60);

    if (diff < 1) return "Expirando";
    if (diff < 60) return `Expira em ${diff}min`;
    if (diff < 1440) return `Expira em ${Math.floor(diff / 60)}h`;
    return `Expira em ${Math.floor(diff / 1440)}d`;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tamanho Total</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats.usedSize}</div>
            <Progress value={cacheStats.usedPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {cacheStats.usedPercentage}% de {cacheStats.totalSize}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats.entries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Chaves em cache</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats.hitRate}%</div>
            <p className="text-xs text-muted-foreground">Hit rate medio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats.avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">Media atual</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciamento de Cache</CardTitle>
              <CardDescription>
                Monitore e gerencie o cache da aplicacao
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClearExpired}
                disabled={isClearing}
              >
                {isClearing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {!isClearing && <Trash2 className="h-4 w-4 mr-2" />}
                Limpar Expirados
              </Button>
              <Button
                variant="destructive"
                onClick={handleFlushAll}
                disabled={isFlushing}
              >
                {isFlushing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {!isFlushing && <Trash2 className="h-4 w-4 mr-2" />}
                Limpar Tudo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Taxa de Acerto</TableHead>
                  <TableHead>Ultimo Acesso</TableHead>
                  <TableHead>Expiracao</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cacheEntries.map((entry, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <code className="text-sm">{entry.key}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.type === "Redis" ? "default" : "secondary"}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{entry.size}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.hitRate}%</span>
                        <div className="text-xs text-muted-foreground">
                          ({entry.hits.toLocaleString()} hits / {entry.misses.toLocaleString()} misses)
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatTimestamp(entry.lastAccessed)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatExpiry(entry.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClearEntry(entry.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
