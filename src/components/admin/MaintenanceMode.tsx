import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings, TriangleAlert as AlertTriangle, Calendar as CalendarIcon, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MaintenanceSchedule {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: "scheduled" | "active" | "completed";
  affectedServices: string[];
  notifyUsers: boolean;
}

export function MaintenanceMode() {
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "Sistema em manutencao. Voltaremos em breve!"
  );
  const [allowAdminAccess, setAllowAdminAccess] = useState(true);
  const [notifyUsers, setNotifyUsers] = useState(true);

  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledEndDate, setScheduledEndDate] = useState<Date>();
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDescription, setScheduleDescription] = useState("");

  const [schedules] = useState<MaintenanceSchedule[]>([
    {
      id: "1",
      title: "Atualizacao de Servidor",
      description: "Migracao para novos servidores com melhor performance",
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 60 * 2),
      status: "scheduled",
      affectedServices: ["API", "Dashboard", "WhatsApp"],
      notifyUsers: true,
    },
    {
      id: "2",
      title: "Backup do Banco de Dados",
      description: "Backup completo e otimizacao do banco de dados",
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60),
      status: "scheduled",
      affectedServices: ["Database"],
      notifyUsers: true,
    },
  ]);

  const handleToggleMaintenance = () => {
    setIsMaintenanceActive(!isMaintenanceActive);
    toast.success(
      !isMaintenanceActive
        ? "Modo de manutencao ativado"
        : "Modo de manutencao desativado"
    );
  };

  const handleScheduleMaintenance = () => {
    if (!scheduledDate || !scheduledEndDate || !scheduleTitle) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    toast.success("Manutencao agendada com sucesso");
    setScheduleTitle("");
    setScheduleDescription("");
    setScheduledDate(undefined);
    setScheduledEndDate(undefined);
  };

  const getStatusBadge = (status: MaintenanceSchedule["status"]) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Agendada</Badge>;
      case "active":
        return <Badge variant="default" className="bg-yellow-600">Em Andamento</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600">Concluida</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Modo de Manutencao</CardTitle>
          <CardDescription>
            Controle o acesso ao sistema durante manutencoes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/50">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isMaintenanceActive ? "bg-yellow-100" : "bg-green-100"}`}>
                <Settings className={`h-5 w-5 ${isMaintenanceActive ? "text-yellow-600" : "text-green-600"}`} />
              </div>
              <div>
                <h4 className="font-medium">
                  Status: {isMaintenanceActive ? "Em Manutencao" : "Operacional"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {isMaintenanceActive
                    ? "Sistema bloqueado para usuarios"
                    : "Sistema funcionando normalmente"}
                </p>
              </div>
            </div>
            <Switch
              checked={isMaintenanceActive}
              onCheckedChange={handleToggleMaintenance}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Mensagem de Manutencao</Label>
              <Textarea
                id="message"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="Mensagem exibida aos usuarios"
                className="mt-2"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Permitir Acesso de Administradores</Label>
                <p className="text-sm text-muted-foreground">
                  Admins podem acessar durante manutencao
                </p>
              </div>
              <Switch
                checked={allowAdminAccess}
                onCheckedChange={setAllowAdminAccess}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Notificar Usuarios</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar email sobre a manutencao
                </p>
              </div>
              <Switch
                checked={notifyUsers}
                onCheckedChange={setNotifyUsers}
              />
            </div>
          </div>

          {isMaintenanceActive && (
            <div className="flex items-start gap-3 p-4 border border-yellow-200 rounded-lg bg-yellow-50">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Sistema em Manutencao</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Usuarios nao conseguem acessar o sistema no momento.
                  {allowAdminAccess && " Apenas administradores tem acesso."}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agendar Manutencao</CardTitle>
          <CardDescription>
            Programe manutencoes futuras e notifique usuarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              value={scheduleTitle}
              onChange={(e) => setScheduleTitle(e.target.value)}
              placeholder="Atualizacao do sistema"
            />
          </div>

          <div>
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              value={scheduleDescription}
              onChange={(e) => setScheduleDescription(e.target.value)}
              placeholder="Descreva o que sera feito durante a manutencao"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data de Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Data de Termino</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledEndDate ? format(scheduledEndDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledEndDate}
                    onSelect={setScheduledEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button onClick={handleScheduleMaintenance} className="w-full">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Agendar Manutencao
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manutencoes Agendadas</CardTitle>
          <CardDescription>
            Visualize e gerencie manutencoes programadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma manutencao agendada
              </div>
            ) : (
              schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{schedule.title}</h4>
                        {getStatusBadge(schedule.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {schedule.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Inicio</div>
                        <div>{format(schedule.startDate, "dd/MM/yyyy HH:mm")}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Termino</div>
                        <div>{format(schedule.endDate, "dd/MM/yyyy HH:mm")}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs text-muted-foreground">Usuarios</div>
                        <div>{schedule.notifyUsers ? "Serao notificados" : "Nao serao notificados"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Servicos Afetados:</div>
                    <div className="flex flex-wrap gap-1">
                      {schedule.affectedServices.map((service, index) => (
                        <Badge key={index} variant="outline">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
