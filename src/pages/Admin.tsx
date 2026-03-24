import { useState } from "react";
import { ArrowLeft, Shield, LayoutDashboard, DollarSign, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminOrgList } from "@/components/admin";
import { AdminUserList } from "@/components/admin/AdminUserList";
import { AdminSuperAdminList } from "@/components/admin/AdminSuperAdminList";
import { AdminAICredits } from "@/components/admin/AdminAICredits";
import { AdminAIUsage } from "@/components/admin/AdminAIUsage";
import { AdminBackups } from "@/components/admin/AdminBackups";
import { AdminWhatsAppStatus } from "@/components/admin/AdminWhatsAppStatus";
import { ExecutiveDashboard } from "@/components/admin/ExecutiveDashboard";
import { AuditLogs } from "@/components/admin/AuditLogs";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { useAdminOrganizations } from "@/hooks/useAdminOrganizations";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useEngagementMetrics } from "@/hooks/useEngagementMetrics";
import { useNotificationTokens } from "@/hooks/useNotificationTokens";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  const { 
    organizations, 
    isLoading, 
    stats, 
    usageMap,
    updateOrganizationPlan,
    deleteOrganization,
  } = useAdminOrganizations();

  const {
    users,
    grants,
    usersLoading,
    grantsLoading,
    grantSuperAdmin,
    revokeSuperAdmin,
    deleteUser,
  } = useAdminUsers();

  const { metricsMap } = useEngagementMetrics();
  const { isSuperAdmin } = useSuperAdmin();
  const { pushInfo } = useNotificationTokens(isSuperAdmin);

  const handleUpdatePlan = (orgId: string, plan: string, expiresAt: string | null) => {
    updateOrganizationPlan.mutate({ orgId, plan, expiresAt });
  };

  const handleDelete = (orgId: string) => {
    deleteOrganization.mutate(orgId);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Painel Administrativo</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 py-4 space-y-4 sm:px-4 sm:py-6 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="organizations">Empresas</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="superadmins">Admins</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="ai-credits">IA</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ExecutiveDashboard onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="organizations">
            <AdminOrgList
              organizations={organizations}
              onUpdatePlan={handleUpdatePlan}
              onDelete={handleDelete}
              isUpdating={updateOrganizationPlan.isPending}
              isDeleting={deleteOrganization.isPending}
              usageMap={usageMap}
            />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserList
              users={users}
              isLoading={usersLoading}
              onGrantSuperAdmin={(userId) => grantSuperAdmin.mutate(userId)}
              isGranting={grantSuperAdmin.isPending}
              onDeleteUser={(userId) => deleteUser.mutate(userId)}
              isDeleting={deleteUser.isPending}
              engagementMap={metricsMap}
              pushEnabledUsers={pushInfo.userIds}
              pushDeviceCounts={pushInfo.deviceCounts}
            />
          </TabsContent>

          <TabsContent value="logs">
            <AuditLogs />
          </TabsContent>

          <TabsContent value="superadmins">
            <AdminSuperAdminList
              users={users}
              grants={grants}
              onGrant={(userId) => grantSuperAdmin.mutate(userId)}
              onRevoke={(userId) => revokeSuperAdmin.mutate(userId)}
              isGranting={grantSuperAdmin.isPending}
              isRevoking={revokeSuperAdmin.isPending}
            />
          </TabsContent>

          <TabsContent value="backups">
            <AdminBackups />
          </TabsContent>

          <TabsContent value="ai-credits">
            <div className="space-y-6">
              <AdminAICredits />
              <AdminAIUsage />
            </div>
          </TabsContent>

          <TabsContent value="whatsapp">
            <AdminWhatsAppStatus />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
