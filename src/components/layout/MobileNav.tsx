import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { usePendingAdjustmentsCount } from "@/hooks/usePendingAdjustments";
import { useWhatsAppUnreadCount } from "@/hooks/useWhatsAppUnreadCount";
import { 
  LayoutDashboard, 
  Wallet, 
  Wrench, 
  Users, 
  Menu,
  Snowflake,
  Settings,
  Shield,
  CalendarDays,
  ClipboardList,
  LogOut,
  Pencil,
  Building2,
  FileText,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  BookOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Receipt,
  Trash2,
  Megaphone,
  Bot,
  Briefcase,
  Clock,
  RefreshCw,
  BarChart3,
  MessageSquare,
  Tag,
  Zap,
  Radio,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { EmployeeProfileDialog } from "@/components/employee";
import { useSubscription } from "@/hooks/useSubscription";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MobileNavProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

const adminBottomNavItems: NavItem[] = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "OS", href: "/ordens-servico", icon: ClipboardList },
];

const adminBottomNavItemsWithWhatsApp: NavItem[] = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
  { label: "OS", href: "/ordens-servico", icon: ClipboardList },
];

const employeeBottomNavItems: NavItem[] = [
  { label: "Meu Dia", href: "/meu-dia", icon: Briefcase },
  { label: "Ponto", href: "/ponto", icon: Clock },
  { label: "Comunicados", href: "/comunicados", icon: Megaphone },
];

const employeeMenuItems: NavItem[] = [
  { label: "Meu Dia", href: "/meu-dia", icon: Briefcase },
  { label: "Ponto", href: "/ponto", icon: Clock },
  { label: "Histórico de Ponto", href: "/historico-ponto", icon: ClipboardList },
  { label: "Espelho de Ponto", href: "/espelho-ponto", icon: FileText },
  { label: "Comunicados", href: "/comunicados", icon: Megaphone },
];

const atendenteBottomNavItems: NavItem[] = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "OS", href: "/ordens-servico", icon: ClipboardList },
];

const operacaoItems: NavItem[] = [
  { label: "Meu Dia", href: "/meu-dia", icon: Briefcase },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Ordens de Serviço", href: "/ordens-servico", icon: ClipboardList },
  { label: "Laudos Técnicos", href: "/laudos", icon: FileText },
];

const pontoSubItems: NavItem[] = [
  { label: "Dashboard", href: "/ponto-admin", icon: LayoutDashboard },
  { label: "Registros", href: "/ponto-admin/registros", icon: ClipboardList },
  { label: "Espelho de Ponto", href: "/ponto-admin/espelho", icon: FileText },
  { label: "Funcionários", href: "/ponto-admin/funcionarios", icon: Users },
  { label: "Ajustes", href: "/ponto-admin/ajustes", icon: Clock },
  { label: "Calendário", href: "/ponto-admin/calendario", icon: CalendarDays },
  { label: "Escalas", href: "/ponto-admin/escalas", icon: Clock },
  { label: "Relatórios", href: "/ponto-admin/relatorios", icon: BarChart3 },
  { label: "Fechamento", href: "/ponto-admin/fechamento", icon: Clock },
  { label: "Configurações", href: "/ponto-admin/configuracoes", icon: Settings },
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
  { label: "Atendentes", href: "/whatsapp/atendentes", icon: Users },
  { label: "Canais", href: "/whatsapp/canais", icon: Radio },
];

const financeiroSubItems: NavItem[] = [
  { label: "Transações", href: "/financeiro", icon: Wallet },
  { label: "Contas a Pagar", href: "/contas-pagar", icon: ArrowDownCircle },
  { label: "Contas a Receber", href: "/contas-receber", icon: ArrowUpCircle },
  { label: "Transferências", href: "/financeiro/transferencias", icon: ArrowRightLeft },
  { label: "Recebimentos por Técnico", href: "/financeiro/recebimentos-tecnico", icon: Receipt },
];

const ajudaSubItems: NavItem[] = [
  { label: "Tutorial", href: "/tutorial", icon: BookOpen },
  { label: "Suporte", href: "/suporte", icon: HelpCircle },
  { label: "Atualizações", href: "/atualizacoes", icon: Megaphone },
];

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground/60 select-none">
      {label}
    </p>
  );
}

function SectionDivider() {
  return <div className="mx-3 my-1 border-t border-border/60" />;
}

function MenuNavItem({ 
  item, 
  onClick, 
  badgeContent 
}: { 
  item: NavItem; 
  onClick: () => void; 
  badgeContent?: React.ReactNode;
}) {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  return (
    <NavLink
      to={item.href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98]",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground/80 hover:bg-muted hover:text-foreground"
      )}
    >
      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
      <span className="flex-1 truncate">{item.label}</span>
      {badgeContent}
    </NavLink>
  );
}

function MenuGroup({ 
  label, 
  items, 
  onItemClick, 
  isOpen, 
  onToggle,
  badgeCount,
  itemBadges,
}: { 
  label: string; 
  items: NavItem[]; 
  onItemClick: () => void; 
  isOpen: boolean; 
  onToggle: () => void;
  badgeCount?: number;
  itemBadges?: Record<string, number>;
}) {
  const location = useLocation();

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground transition-all duration-200 active:scale-[0.98]">
        <div className="flex items-center gap-3">
          {items[0] && (() => { const Icon = items[0].icon; return <Icon className="h-[18px] w-[18px] opacity-70" />; })()}
          <span>{label}</span>
          {!!badgeCount && badgeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {badgeCount}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-3 mt-0.5">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          const itemBadge = itemBadges?.[item.href];
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.98]",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/60 hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "opacity-60")} />
              <span className="flex-1">{item.label}</span>
              {!!itemBadge && itemBadge > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
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

export function MobileNav({ sidebarOpen, setSidebarOpen }: MobileNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { isEmployee, isFieldWorker, isMember, hasPermission, roleLabel } = useUserRole();
  const { profile, signOut, user } = useAuth();
  const { organization } = useOrganization();
  const { plan, hasWhatsAppFull, hasRecurrence } = useSubscription();
  const { isSuperAdmin } = useSuperAdmin();
  const whatsAppUnread = useWhatsAppUnreadCount();
  const pendingAdjCount = usePendingAdjustmentsCount();
  const pontoBadges = { "/ponto-admin/ajustes": pendingAdjCount };

  // Track if sheet was recently open (to allow close animation)
  const [sheetMounted, setSheetMounted] = useState(false);

  useEffect(() => {
    if (sidebarOpen) {
      setSheetMounted(true);
    }
  }, [sidebarOpen]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleSheetAnimationEnd = () => {
    if (!sidebarOpen) {
      setSheetMounted(false);
    }
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const path = location.pathname;
    return {
      comercial: comercialSubItems.some(i => i.href === path),
      whatsapp: path.startsWith("/whatsapp"),
      financeiro: financeiroSubItems.some(i => i.href === path),
      ponto: path.startsWith("/ponto-admin"),
      ajuda: ajudaSubItems.some(i => i.href === path),
    };
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const { hasTimeClock } = useSubscription();
  const timeClockEnabled = !!(organization as any)?.time_clock_enabled && hasTimeClock;

  const bottomNavItems = isEmployee 
    ? employeeBottomNavItems.filter(i => i.href !== "/ponto" || timeClockEnabled)
    : isMember
      ? atendenteBottomNavItems
      : hasWhatsAppFull ? adminBottomNavItemsWithWhatsApp : adminBottomNavItems;

  const handleSignOut = async () => {
    setSidebarOpen(false);
    await signOut();
  };

  const closeMenu = () => setSidebarOpen(false);

  const userInitial = profile?.full_name?.charAt(0).toUpperCase() || "U";
  const userName = profile?.full_name || "Usuário";

  return (
    <>
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border safe-top">
        <div className="flex h-14 items-center justify-between px-4 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {organization?.logo_url ? (
              <img 
                src={organization.logo_url} 
                alt="Logo da empresa" 
                className="h-8 w-8 rounded-lg object-contain shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
                <Snowflake className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <span className="font-bold text-foreground truncate max-w-[100px] text-sm tracking-tight">
              {organization?.name || "Tecvo"}
            </span>
          </div>

          {/* Menu Button */}
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          {sheetMounted && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen} modal>
            <SheetContent side="right" className="w-[280px] p-0 flex flex-col bg-card" onAnimationEnd={handleSheetAnimationEnd}>
              {/* Sheet Header */}
              <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
                {organization?.logo_url ? (
                  <img 
                    src={organization.logo_url} 
                    alt="Logo" 
                    className="h-9 w-9 rounded-xl object-contain"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                    <Snowflake className="h-4.5 w-4.5 text-primary-foreground" />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight">
                    {organization?.name || "Tecvo"}
                  </h2>
                  <p className="text-xs text-muted-foreground tracking-wide">
                    Gestão para Climatização
                  </p>
                </div>
              </div>
              
              {/* Navigation */}
              <nav className="flex-1 flex flex-col px-3 py-2 overflow-y-auto">
                {isEmployee ? (
                  employeeMenuItems
                    .filter(item => {
                      if (item.href === "/ponto" && !timeClockEnabled) return false;
                      return true;
                    })
                    .map((item) => (
                    <MenuNavItem key={item.href} item={item} onClick={closeMenu} />
                  ))
                ) : isMember ? (
                  <>
                    <SectionLabel label="Operação" />
                    <div className="space-y-0.5">
                      <MenuNavItem item={{ label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard }} onClick={closeMenu} />
                      <MenuNavItem item={{ label: "Meu Dia", href: "/meu-dia", icon: Briefcase }} onClick={closeMenu} />
                      <MenuNavItem item={{ label: "Agenda", href: "/agenda", icon: CalendarDays }} onClick={closeMenu} />
                      <MenuNavItem item={{ label: "Ordens de Serviço", href: "/ordens-servico", icon: ClipboardList }} onClick={closeMenu} />
                      <MenuNavItem item={{ label: "Laudos Técnicos", href: "/laudos", icon: FileText }} onClick={closeMenu} />
                      {timeClockEnabled && (
                        <MenuGroup 
                          label="Controle de Ponto" 
                          items={pontoSubItems} 
                          onItemClick={closeMenu}
                          isOpen={openGroups.ponto}
                          onToggle={() => toggleGroup('ponto')}
                          badgeCount={pendingAdjCount}
                          itemBadges={pontoBadges}
                        />
                      )}
                    </div>
                    <SectionDivider />
                    <SectionLabel label="Atendimento & Vendas" />
                    <div className="space-y-0.5">
                      <MenuGroup label="Comercial" items={comercialSubItems.filter(i => i.href !== "/recorrencia" || hasRecurrence)} onItemClick={closeMenu} isOpen={openGroups.comercial} onToggle={() => toggleGroup('comercial')} />
                      <MenuNavItem item={{ label: "Clientes", href: "/clientes", icon: Users }} onClick={closeMenu} />
                      <MenuNavItem item={{ label: "Catálogo de Serviços", href: "/catalogo-servicos", icon: Wrench }} onClick={closeMenu} />
                    </div>
                    {hasPermission("finance.view") && (
                      <>
                        <SectionDivider />
                        <SectionLabel label="Controle" />
                        <div className="space-y-0.5">
                          <MenuGroup label="Financeiro" items={financeiroSubItems} onItemClick={closeMenu} isOpen={openGroups.financeiro} onToggle={() => toggleGroup('financeiro')} />
                          <MenuNavItem item={{ label: "Relatórios", href: "/financeiro/relatorios", icon: FileText }} onClick={closeMenu} />
                          <MenuNavItem item={{ label: "Fornecedores", href: "/fornecedores", icon: Building2 }} onClick={closeMenu} />
                        </div>
                      </>
                    )}
                    <SectionDivider />
                    <SectionLabel label="Sistema" />
                    <div className="space-y-0.5">
                      <MenuGroup label="Ajuda" items={ajudaSubItems} onItemClick={closeMenu} isOpen={openGroups.ajuda} onToggle={() => toggleGroup('ajuda')} />
                      {hasPermission("service.delete") && <MenuNavItem item={{ label: "Lixeira", href: "/lixeira", icon: Trash2 }} onClick={closeMenu} />}
                    </div>
                  </>
                ) : (
                  <>
                    {/* ── 🎯 OPERAÇÃO ── */}
                    <SectionLabel label="Operação" />
                    <div className="space-y-0.5">
                      <MenuNavItem item={{ label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard }} onClick={closeMenu} />
                      {operacaoItems
                        .filter(item => {
                          return true;
                        })
                        .map((item) => (
                        <MenuNavItem key={item.href} item={item} onClick={closeMenu} />
                      ))}
                    </div>

                    <SectionDivider />

                    {/* ── 💰 RECEITA & CLIENTES ── */}
                    <SectionLabel label="Receita & Clientes" />
                    <div className="space-y-0.5">
                      <MenuGroup 
                        label="Comercial" 
                        items={comercialSubItems.filter(i => i.href !== "/recorrencia" || hasRecurrence)} 
                        onItemClick={closeMenu}
                        isOpen={openGroups.comercial}
                        onToggle={() => toggleGroup('comercial')}
                      />
                      <MenuNavItem 
                        item={{ label: "Clientes", href: "/clientes", icon: Users }} 
                        onClick={closeMenu} 
                      />
                      <MenuNavItem 
                        item={{ label: "Fornecedores", href: "/fornecedores", icon: Building2 }} 
                        onClick={closeMenu} 
                      />
                      <MenuNavItem 
                        item={{ label: "Catálogo de Serviços", href: "/catalogo-servicos", icon: Wrench }} 
                        onClick={closeMenu} 
                      />
                    </div>

                    <SectionDivider />

                    {/* ── 💬 ATENDIMENTO ── */}
                    {hasWhatsAppFull && (
                      <>
                        <SectionLabel label="Atendimento" />
                        <div className="space-y-0.5">
                          <MenuGroup 
                            label="WhatsApp" 
                            items={whatsappSubItems} 
                            onItemClick={closeMenu}
                            isOpen={openGroups.whatsapp}
                            onToggle={() => toggleGroup('whatsapp')}
                          />
                        </div>
                      </>
                    )}

                    <SectionDivider />

                    {/* ── 📊 CONTROLE ── */}
                    <SectionLabel label="Controle" />
                    <div className="space-y-0.5">
                      <MenuGroup 
                        label="Financeiro" 
                        items={financeiroSubItems} 
                        onItemClick={closeMenu}
                        isOpen={openGroups.financeiro}
                        onToggle={() => toggleGroup('financeiro')}
                      />
                      <MenuNavItem 
                        item={{ label: "Relatórios", href: "/financeiro/relatorios", icon: FileText }} 
                        onClick={closeMenu} 
                      />
                    </div>

                    <SectionDivider />

                    {/* ── 👥 EQUIPE ── */}
                    {timeClockEnabled && (
                      <>
                        <SectionLabel label="Equipe" />
                        <div className="space-y-0.5">
                          <MenuGroup 
                            label="Controle de Ponto" 
                            items={pontoSubItems} 
                            onItemClick={closeMenu}
                            isOpen={openGroups.ponto}
                            onToggle={() => toggleGroup('ponto')}
                            badgeCount={pendingAdjCount}
                            itemBadges={pontoBadges}
                          />
                        </div>
                        <SectionDivider />
                      </>
                    )}

                    {/* ── ⚙️ SISTEMA ── */}
                    <SectionLabel label="Sistema" />
                    <div className="space-y-0.5">
                      <MenuNavItem 
                        item={{ label: "Configurações", href: "/configuracoes", icon: Settings }} 
                        onClick={closeMenu} 
                      />
                      {isSuperAdmin && (
                        <MenuNavItem 
                          item={{ label: "Painel Admin", href: "/admin", icon: Shield }} 
                          onClick={closeMenu} 
                        />
                      )}
                      <MenuNavItem 
                        item={{ label: "Lixeira", href: "/lixeira", icon: Trash2 }} 
                        onClick={closeMenu} 
                      />
                      <MenuGroup 
                        label="Ajuda" 
                        items={ajudaSubItems} 
                        onItemClick={closeMenu}
                        isOpen={openGroups.ajuda}
                        onToggle={() => toggleGroup('ajuda')}
                      />
                    </div>
                  </>
                )}
              </nav>

              {/* User footer */}
              <div className="p-4 border-t border-border/60 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-primary">{userInitial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {roleLabel}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      closeMenu();
                      navigate("/configuracoes?view=my-account");
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Editar Perfil"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Sair"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          )}
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
        <div className="flex items-center justify-around py-2">
          {bottomNavItems.map((item) => {
            const isActive = item.href === "/whatsapp"
              ? location.pathname.startsWith("/whatsapp")
              : location.pathname === item.href;
            const isWhatsApp = item.href === "/whatsapp";
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={(e) => {
                  if (isWhatsApp && location.pathname.startsWith("/whatsapp")) {
                    e.preventDefault();
                    navigate("/whatsapp", { replace: true, state: { resetChat: Date.now() } });
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 min-w-[48px] rounded-lg transition-colors relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute -top-1 w-5 h-0.5 rounded-full bg-primary" />
                )}
                <span className="relative">
                  <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  {isWhatsApp && whatsAppUnread > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center px-1">
                      {whatsAppUnread > 99 ? "99+" : whatsAppUnread}
                    </span>
                  )}
                </span>
                <span className="text-2xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
          {!isEmployee && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 min-w-[48px] rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
              <span className="text-2xs font-medium">Mais</span>
            </button>
          )}
        </div>
      </nav>

      <EmployeeProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </>
  );
}
