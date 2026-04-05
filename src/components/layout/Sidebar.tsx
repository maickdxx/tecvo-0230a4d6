import { useState, useRef, useEffect, useCallback } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { usePendingAdjustmentsCount } from "@/hooks/usePendingAdjustments";
import {
  LayoutDashboard, Wallet, Wrench, Users, Settings,
  ChevronRight, ChevronDown, Snowflake, CalendarDays,
  ClipboardList, LogOut, Clock, ClipboardCheck, Building2,
  FileText, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft,
  Shield, HelpCircle, BookOpen, Trash2, MessageSquare,
  Megaphone, Bot, Briefcase, Pencil, RefreshCw, Receipt,
  Tag, Zap, Users as UsersIcon, Radio, BarChart3,
  PanelLeftClose, PanelLeftOpen, Download, Home, DollarSign,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UsageBadge } from "@/components/subscription";
import { UpgradeModal } from "@/components/subscription";
import { useSubscription } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { EmployeeProfileDialog } from "@/components/employee";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// ── Navigation data ──
const operacaoItems: NavItem[] = [
  { label: "Meu Dia", href: "/meu-dia", icon: Briefcase },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Ordens de Serviço", href: "/ordens-servico", icon: ClipboardList },
  { label: "Laudos Técnicos", href: "/laudos", icon: FileText },
];

const comercialSubItems: NavItem[] = [
  { label: "Orçamentos", href: "/orcamentos", icon: FileText },
  { label: "Recorrência", href: "/recorrencia", icon: RefreshCw },
];

const whatsappSubItems: NavItem[] = [
  { label: "Conversas", href: "/whatsapp", icon: MessageSquare },
  { label: "Contatos", href: "/whatsapp/contatos", icon: Users },
  { label: "Relatório", href: "/whatsapp/relatorio", icon: BarChart3 },
  { label: "Etiquetas", href: "/whatsapp/etiquetas", icon: Tag },
  { label: "Respostas rápidas", href: "/whatsapp/respostas-rapidas", icon: Zap },
  { label: "Automações", href: "/whatsapp/bots", icon: Bot },
  { label: "Atendentes", href: "/whatsapp/atendentes", icon: UsersIcon },
  { label: "Canais", href: "/whatsapp/canais", icon: Radio },
];

const financeiroSubItems: NavItem[] = [
  { label: "Transações", href: "/financeiro", icon: Wallet },
  { label: "Contas a Pagar", href: "/contas-pagar", icon: ArrowDownCircle },
  { label: "Contas a Receber", href: "/contas-receber", icon: ArrowUpCircle },
  { label: "Transferências", href: "/financeiro/transferencias", icon: ArrowRightLeft },
  { label: "Recebimentos por Técnico", href: "/financeiro/recebimentos-tecnico", icon: Receipt },
  { label: "Recibos", href: "/financeiro/recibos", icon: FileText },
];

const pontoSubItems: NavItem[] = [
  { label: "Dashboard", href: "/ponto-admin", icon: LayoutDashboard },
  { label: "Registros", href: "/ponto-admin/registros", icon: ClipboardList },
  { label: "Espelho de Ponto", href: "/ponto-admin/espelho", icon: FileText },
  { label: "Funcionários", href: "/ponto-admin/funcionarios", icon: Users },
  { label: "Ajustes", href: "/ponto-admin/ajustes", icon: ClipboardCheck },
  { label: "Calendário", href: "/ponto-admin/calendario", icon: CalendarDays },
  { label: "Escalas", href: "/ponto-admin/escalas", icon: Clock },
  { label: "Relatórios", href: "/ponto-admin/relatorios", icon: BarChart3 },
  { label: "Fechamento", href: "/ponto-admin/fechamento", icon: ClipboardCheck },
  { label: "Configurações", href: "/ponto-admin/configuracoes", icon: Settings },
];

const ajudaSubItems: NavItem[] = [
  { label: "Tutorial", href: "/tutorial", icon: BookOpen },
  { label: "Suporte", href: "/suporte", icon: HelpCircle },
  { label: "Atualizações", href: "/atualizacoes", icon: Megaphone },
];

const employeeNavItems: NavItem[] = [
  { label: "Meu Dia", href: "/meu-dia", icon: Briefcase },
  { label: "Ponto", href: "/ponto", icon: Clock },
  { label: "Histórico", href: "/historico-ponto", icon: ClipboardCheck },
  { label: "Espelho", href: "/espelho-ponto", icon: FileText },
  { label: "Comunicados", href: "/comunicados", icon: Megaphone },
];

// ── Sub-components ──

function SectionLabel({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) return <div className="mx-auto my-3 w-5 border-t border-sidebar-border/50" />;
  return (
    <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/30 select-none">
      {label}
    </p>
  );
}

function SidebarNavItem({ item, collapsed, badgeContent }: { item: NavItem; collapsed?: boolean; badgeContent?: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  const link = (
    <NavLink
      to={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150",
        collapsed ? "justify-center px-0 w-9 h-9 mx-auto" : "",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary" />
      )}
      <item.icon className={cn(
        "shrink-0 transition-colors duration-150",
        collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
        isActive ? "text-sidebar-primary" : "opacity-50 group-hover:opacity-80"
      )} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && badgeContent}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

function SidebarGroup({
  label, items, isOpen, onToggle, collapsed, badgeCount, itemBadges,
}: {
  label: string; items: NavItem[]; isOpen: boolean; onToggle: () => void;
  collapsed?: boolean; badgeCount?: number; itemBadges?: Record<string, number>;
}) {
  const location = useLocation();

  if (collapsed) {
    const Icon = items[0]?.icon;
    const anyActive = items.some(i => location.pathname === i.href);
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <NavLink
            to={items[0]?.href || "#"}
            className={cn(
              "flex items-center justify-center w-9 h-9 mx-auto rounded-md transition-all duration-150",
              anyActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            {Icon && <Icon className="h-[18px] w-[18px]" />}
            {!!badgeCount && badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1">
                {badgeCount}
              </span>
            )}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2.5 py-[7px] text-[13px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150">
        <div className="flex items-center gap-2.5">
          {(() => { const Icon = items[0]?.icon; return Icon ? <Icon className="h-4 w-4 opacity-50" /> : null; })()}
          <span>{label}</span>
          {!!badgeCount && badgeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {badgeCount}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="h-3 w-3 opacity-40" /> : <ChevronRight className="h-3 w-3 opacity-40" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-4 mt-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          const itemBadge = itemBadges?.[item.href];
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[12px] font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                  : "text-sidebar-foreground/45 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70"
              )}
            >
              <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-sidebar-primary" : "opacity-50")} />
              <span className="flex-1 truncate">{item.label}</span>
              {!!itemBadge && itemBadge > 0 && (
                <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {itemBadge}
                </span>
              )}
            </NavLink>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Persist sidebar state ──
let _sidebarScrollTop = 0;
let _sidebarCollapsed = false;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(_sidebarCollapsed);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { isEmployee, isFieldWorker, isMember, isAdmin, isOwner, hasPermission, roleLabel } = useUserRole();
  const { profile, signOut } = useAuth();
  const { organization } = useOrganization();
  const { isSuperAdmin } = useSuperAdmin();
  const { plan, hasTimeClock, hasWhatsAppFull, hasRecurrence } = useSubscription();
  const pendingAdjCount = usePendingAdjustmentsCount();
  const pontoBadges = { "/ponto-admin/ajustes": pendingAdjCount };
  const { isInstallable, promptInstall } = useInstallPrompt();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const path = location.pathname;
    return {
      comercial: comercialSubItems.some(i => i.href === path),
      whatsapp: path.startsWith("/whatsapp"),
      financeiro: financeiroSubItems.some(i => i.href === path),
      ajuda: ajudaSubItems.some(i => i.href === path),
      ponto: path.startsWith("/ponto-admin"),
    };
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    _sidebarCollapsed = next;
  };

  const handleSignOut = async () => { await signOut(); };
  const userInitial = profile?.full_name?.charAt(0).toUpperCase() || "U";
  const userName = profile?.full_name || "Usuário";

  const navRef = useRef<HTMLElement>(null);
  const handleNavScroll = useCallback(() => {
    if (navRef.current) _sidebarScrollTop = navRef.current.scrollTop;
  }, []);
  useEffect(() => {
    if (navRef.current && _sidebarScrollTop > 0) {
      navRef.current.scrollTop = _sidebarScrollTop;
    }
  }, []);

  const sidebarWidth = collapsed ? "w-16" : "w-[240px]";

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar flex flex-col transition-all duration-200 border-r border-sidebar-border/40",
      sidebarWidth
    )}>
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border/40 shrink-0",
        collapsed ? "h-14 justify-center" : "h-14 gap-2.5 px-4"
      )}>
        {collapsed ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/90">
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt="Logo" className="h-full w-full rounded-lg object-contain" />
            ) : (
              <Snowflake className="h-4 w-4 text-sidebar-primary-foreground" />
            )}
          </div>
        ) : (
          <>
            {organization?.logo_url ? (
              <img src={organization.logo_url} alt="Logo" className="h-8 w-8 rounded-lg object-contain shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/90 shrink-0">
                <Snowflake className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-foreground truncate max-w-[140px] tracking-tight leading-tight">
                {organization?.name || "Tecvo"}
              </h1>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        onScroll={handleNavScroll}
        className={cn(
          "flex-1 flex flex-col overflow-y-auto overflow-x-hidden",
          collapsed ? "px-1.5 py-2" : "px-2 py-1"
        )}
      >
        {isEmployee ? (
          <div className="space-y-0.5">
            {employeeNavItems
              .filter(item => {
                if (item.href === "/ponto" && (!(organization as any)?.time_clock_enabled || !hasTimeClock)) return false;
                return true;
              })
              .map((item) => (
                <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
          </div>
        ) : isMember ? (
          <>
            <SectionLabel label="Operação" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarNavItem item={{ label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Meu Dia", href: "/meu-dia", icon: Briefcase }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Agenda", href: "/agenda", icon: CalendarDays }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Ordens de Serviço", href: "/ordens-servico", icon: ClipboardList }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Laudos Técnicos", href: "/laudos", icon: FileText }} collapsed={collapsed} />
              {(organization as any)?.time_clock_enabled && hasTimeClock && <SidebarNavItem item={{ label: "Ponto", href: "/ponto", icon: Clock }} collapsed={collapsed} />}
            </div>
            <SectionLabel label="Vendas" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarGroup label="Comercial" items={comercialSubItems} isOpen={openGroups.comercial} onToggle={() => toggleGroup('comercial')} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Clientes", href: "/clientes", icon: Users }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Catálogo", href: "/catalogo-servicos", icon: Wrench }} collapsed={collapsed} />
            </div>
            {hasPermission("finance.view") && (
              <>
                <SectionLabel label="Controle" collapsed={collapsed} />
                <div className="space-y-0.5">
                  <SidebarGroup label="Financeiro" items={financeiroSubItems} isOpen={openGroups.financeiro} onToggle={() => toggleGroup('financeiro')} collapsed={collapsed} />
                  <SidebarNavItem item={{ label: "Relatórios", href: "/financeiro/relatorios", icon: FileText }} collapsed={collapsed} />
                  <SidebarNavItem item={{ label: "Fornecedores", href: "/fornecedores", icon: Building2 }} collapsed={collapsed} />
                </div>
              </>
            )}
            <SectionLabel label="Sistema" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarGroup label="Ajuda" items={ajudaSubItems} isOpen={openGroups.ajuda} onToggle={() => toggleGroup('ajuda')} collapsed={collapsed} />
              {hasPermission("service.delete") && <SidebarNavItem item={{ label: "Lixeira", href: "/lixeira", icon: Trash2 }} collapsed={collapsed} />}
            </div>
          </>
        ) : (
          <>
            {/* Admin / Owner full menu */}
            <SectionLabel label="Operação" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarNavItem item={{ label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard }} collapsed={collapsed} />
              {operacaoItems.map((item) => (
                <SidebarNavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>

            <SectionLabel label="Receita & Clientes" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarGroup label="Comercial" items={comercialSubItems.filter(i => i.href !== "/recorrencia" || hasRecurrence)} isOpen={openGroups.comercial} onToggle={() => toggleGroup('comercial')} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Clientes", href: "/clientes", icon: Users }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Fornecedores", href: "/fornecedores", icon: Building2 }} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Catálogo", href: "/catalogo-servicos", icon: Wrench }} collapsed={collapsed} />
            </div>

            {hasWhatsAppFull && (
              <>
                <SectionLabel label="Atendimento" collapsed={collapsed} />
                <div className="space-y-0.5">
                  <SidebarGroup label="WhatsApp" items={whatsappSubItems} isOpen={openGroups.whatsapp} onToggle={() => toggleGroup('whatsapp')} collapsed={collapsed} />
                </div>
              </>
            )}

            <SectionLabel label="Controle" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarGroup label="Financeiro" items={financeiroSubItems} isOpen={openGroups.financeiro} onToggle={() => toggleGroup('financeiro')} collapsed={collapsed} />
              <SidebarNavItem item={{ label: "Relatórios", href: "/financeiro/relatorios", icon: FileText }} collapsed={collapsed} />
            </div>

            {(organization as any)?.time_clock_enabled && hasTimeClock && (
              <>
                <SectionLabel label="Equipe" collapsed={collapsed} />
                <div className="space-y-0.5">
                  <SidebarGroup label="Ponto" items={pontoSubItems} isOpen={openGroups.ponto} onToggle={() => toggleGroup('ponto')} collapsed={collapsed} badgeCount={pendingAdjCount} itemBadges={pontoBadges} />
                </div>
              </>
            )}

            <SectionLabel label="Sistema" collapsed={collapsed} />
            <div className="space-y-0.5">
              <SidebarNavItem item={{ label: "Configurações", href: "/configuracoes", icon: Settings }} collapsed={collapsed} />
              {isSuperAdmin && (
                <SidebarNavItem item={{ label: "Admin", href: "/admin", icon: Shield }} collapsed={collapsed} />
              )}
              <SidebarNavItem item={{ label: "Lixeira", href: "/lixeira", icon: Trash2 }} collapsed={collapsed} />
              <SidebarGroup label="Ajuda" items={ajudaSubItems} isOpen={openGroups.ajuda} onToggle={() => toggleGroup('ajuda')} collapsed={collapsed} />
            </div>
          </>
        )}
      </nav>

      {/* Install CTA */}
      {isInstallable && !collapsed && (
        <div className="px-3 mb-1">
          <button
            onClick={promptInstall}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[12px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150"
          >
            <Download className="h-3.5 w-3.5 opacity-60" />
            <span>Instalar app</span>
          </button>
        </div>
      )}
      {isInstallable && collapsed && (
        <div className="flex justify-center mb-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={promptInstall}
                className="h-8 w-8 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Instalar app</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Usage Badge */}
      {!isEmployee && !collapsed && (
        <div className="px-3 mb-1">
          <UsageBadge
            showUpgradeButton
            onUpgradeClick={() => setShowUpgradeModal(true)}
            className="px-2"
          />
        </div>
      )}

      {/* User + Collapse toggle */}
      <div className={cn(
        "border-t border-sidebar-border/40 bg-sidebar shrink-0",
        collapsed ? "p-2" : "p-3"
      )}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/configuracoes?view=my-account")}
                  className="h-8 w-8 rounded-full overflow-hidden bg-sidebar-primary/15 border border-sidebar-primary/20 flex items-center justify-center"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-sidebar-primary">{userInitial}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{userName}</TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapse}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate("/configuracoes?view=my-account")}
              className="h-8 w-8 rounded-full overflow-hidden bg-sidebar-primary/15 border border-sidebar-primary/20 flex items-center justify-center shrink-0 hover:border-sidebar-primary/40 transition-colors"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-sidebar-primary">{userInitial}</span>
              )}
            </button>
            <div 
              className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/configuracoes?view=my-account")}
            >
              <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">{userName}</p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate">{roleLabel}</p>
            </div>
            <button
              onClick={toggleCollapse}
              className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
              title="Recolher menu"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSignOut}
              className="h-7 w-7 flex items-center justify-center rounded-md text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {!collapsed && (
          <div className="mt-1 px-1 flex justify-center">
            <span className="text-[10px] text-sidebar-foreground/20 font-medium">Versão 1.0.1</span>
          </div>
        )}
      </div>

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
      <EmployeeProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </aside>
  );
}

export function useSidebarWidth() {
  // This is a simple approach - returns the current sidebar width class for layout
  return _sidebarCollapsed ? "pl-16" : "pl-[240px]";
}
