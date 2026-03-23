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
import { Database, RefreshCw, Download, Upload, Trash2, Play, HardDrive, Activity } from "lucide-react";
import { toast } from "sonner";

interface DatabaseTable {
  name: string;
  rows: number;
  size: string;
  lastVacuum?: string;
  lastAnalyze?: string;
}

export function DatabaseManager() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isVacuuming, setIsVacuuming] = useState(false);

  const [dbStats] = useState({
    totalSize: "8.4 GB",
    usedSize: "6.2 GB",
    usedPercentage: 74,
    totalTables: 47,
    totalRows: 2847293,
    activeConnections: 12,
    maxConnections: 100,
  });

  const [tables] = useState<DatabaseTable[]>([
    {
      name: "services",
      rows: 145820,
      size: "1.2 GB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      name: "whatsapp_messages",
      rows: 1245670,
      size: "2.8 GB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      name: "clients",
      rows: 89430,
      size: "512 MB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      name: "financial_transactions",
      rows: 234890,
      size: "890 MB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      name: "users",
      rows: 12340,
      size: "124 MB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      name: "organizations",
      rows: 8920,
      size: "98 MB",
      lastVacuum: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      lastAnalyze: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
  ]);

  const [queries] = useState([
    {
      id: 1,
      query: "SELECT * FROM services WHERE...",
      duration: 1245,
      calls: 8920,
      avgTime: 0.14,
    },
    {
      id: 2,
      query: "SELECT * FROM whatsapp_messages...",
      duration: 3420,
      calls: 12450,
      avgTime: 0.27,
    },
    {
      id: 3,
      query: "UPDATE clients SET...",
      duration: 890,
      calls: 2340,
      avgTime: 0.38,
    },
  ]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsOptimizing(false);
    toast.success("Banco de dados otimizado");
  };

  const handleVacuum = async () => {
    setIsVacuuming(true);
    await new Promise(resolve => setTimeout(resolve, 4000));
    setIsVacuuming(false);
    toast.success("Vacuum executado com sucesso");
  };

  const handleExport = () => {
    toast.success("Exportacao iniciada");
  };

  const handleAnalyze = (table: string) => {
    toast.success(`Analyze executado em ${table}`);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60 / 60 / 24);

    if (diff === 0) return "Hoje";
    if (diff === 1) return "Ontem";
    return `${diff} dias atras`;
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
            <div className="text-2xl font-bold">{dbStats.usedSize}</div>
            <Progress value={dbStats.usedPercentage} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {dbStats.usedPercentage}% de {dbStats.totalSize}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tabelas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats.totalTables}</div>
            <p className="text-xs text-muted-foreground">
              {dbStats.totalRows.toLocaleString()} registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conexoes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats.activeConnections}</div>
            <p className="text-xs text-muted-foreground">
              de {dbStats.maxConnections} max
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">Score de saude</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciamento do Banco de Dados</CardTitle>
              <CardDescription>
                Otimize e monitore o banco de dados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button
                variant="outline"
                onClick={handleVacuum}
                disabled={isVacuuming}
              >
                {isVacuuming && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {!isVacuuming && <Trash2 className="h-4 w-4 mr-2" />}
                Vacuum
              </Button>
              <Button
                onClick={handleOptimize}
                disabled={isOptimizing}
              >
                {isOptimizing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {!isOptimizing && <Database className="h-4 w-4 mr-2" />}
                Otimizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Registros</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Ultimo Vacuum</TableHead>
                  <TableHead>Ultimo Analyze</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <code className="text-sm font-medium">{table.name}</code>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{table.rows.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{table.size}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {table.lastVacuum ? formatTimestamp(table.lastVacuum) : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {table.lastAnalyze ? formatTimestamp(table.lastAnalyze) : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAnalyze(table.name)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Analyze
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queries Mais Lentas</CardTitle>
          <CardDescription>
            Top queries por tempo de execucao
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {queries.map((query) => (
              <div
                key={query.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <code className="text-sm">{query.query}</code>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{query.calls.toLocaleString()} chamadas</span>
                    <span>Media: {query.avgTime}ms</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{query.duration}ms</div>
                  <div className="text-xs text-muted-foreground">Tempo total</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
