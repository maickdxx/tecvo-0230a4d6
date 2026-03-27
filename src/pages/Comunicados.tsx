import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Bell, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Comunicados() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["comunicados", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements" as any)
        .select("*")
        .eq("organization_id", orgId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!orgId,
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Comunicados</h1>
            <p className="text-sm text-muted-foreground">Avisos e orientações da empresa</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-muted-foreground">Nenhum comunicado no momento</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Quando houver avisos importantes, eles aparecerão aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {announcements.map((item: any) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 flex-shrink-0 ${
                      item.priority === "high" ? "bg-destructive/10" : 
                      item.priority === "medium" ? "bg-amber-500/10" : "bg-primary/10"
                    }`}>
                      <Megaphone className={`h-4 w-4 ${
                        item.priority === "high" ? "text-destructive" :
                        item.priority === "medium" ? "text-amber-600 dark:text-amber-400" : "text-primary"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        {item.priority === "high" && (
                          <Badge variant="destructive" className="text-[10px]">Urgente</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground/60">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
