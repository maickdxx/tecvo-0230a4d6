import { useState } from "react";
import { ArrowLeft, Shield, LayoutDashboard, DollarSign, FileText, BarChart3 } from "lucide-react";
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
import { AdminWhatsAppTecvo } from "@/components/admin/AdminWhatsAppTecvo";
import { ExecutiveDashboard } from "@/components/admin/ExecutiveDashboard";
import { AuditLogs } from "@/components/admin/AuditLogs";
import { FinancialDashboard } from "@/components/admin/FinancialDashboard";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminCampaigns } from "@/components/admin/AdminCampaigns";
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
      <div className="sticky top-0 z-50 border-b bg-card">
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

      <div className="mx-auto px-2 py-3 space-y-3 sm:px-4 sm:py-6 sm:space-y-6 max-w-[100vw] overflow-x-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full justify-start flex-nowrap h-auto p-1 gap-0.5">
              <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Dash</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="financial" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Financeiro</span>
                <span className="sm:hidden">Fin</span>
              </TabsTrigger>
              <TabsTrigger value="organizations" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Empresas</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Usuários</TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Auditoria</span>
                <span className="sm:hidden">Logs</span>
              </TabsTrigger>
              <TabsTrigger value="superadmins" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Admins</TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">WA</TabsTrigger>
              <TabsTrigger value="whatsapp-tecvo" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">
                <span className="hidden sm:inline">WA Tecvo</span>
                <span className="sm:hidden">Tecvo</span>
              </TabsTrigger>
              <TabsTrigger value="ai-credits" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">IA</TabsTrigger>
              <TabsTrigger value="backups" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">Backups</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            <ExecutiveDashboard onNavigateTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
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


          <TabsContent value="whatsapp-tecvo">
            <AdminWhatsAppTecvo />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
