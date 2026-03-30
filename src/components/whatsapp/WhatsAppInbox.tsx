import { useState, useEffect, useMemo } from "react";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useSearchParams, useLocation } from "react-router-dom";
import { useWhatsAppChannel } from "@/hooks/useWhatsAppChannel";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { useWhatsAppTags } from "@/hooks/useWhatsAppTags";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { AICopilotPanel } from "./AICopilotPanel";
import { WhatsAppConnectionScreen } from "./WhatsAppConnectionScreen";
import { NotificationPromptBanner } from "./NotificationPromptBanner";
import { ConnectionStatusPanel } from "./ConnectionStatusPanel";
import { AICreditsDisplay } from "./AICreditsDisplay";
import { CreateOSModal } from "./CreateOSModal";
import { ScheduleVisitModal } from "./ScheduleVisitModal";
import { AnalyzeConversationModal } from "./AnalyzeConversationModal";
import { RegisterClientPanel } from "./RegisterClientPanel";
import { ScheduleMessagePanel } from "./ScheduleMessagePanel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Loader2,
  Settings,
  Maximize2,
  Minimize2,
  Users,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewContactDialog } from "./NewContactDialog";
import { NewConversationDialog } from "./NewConversationDialog";

interface WhatsAppInboxProps {
  fullscreen?: boolean;
}

export function WhatsAppInbox({ fullscreen = false }: WhatsAppInboxProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { channel, loading: channelLoading, checkStatus, fetchQRCode, qrCode, qrLoading, refetch: refetchChannel } =
    useWhatsAppChannel();
  const { channels: allChannels } = useWhatsAppChannels();
  const {
    contacts,
    loading: contactsLoading,
    loadingMore,
    hasMore,
    loadMore,
    searchTerm,
    setSearchTerm,
    markAsRead,
    markAsUnread,
    finalizeConversation,
    deleteConversation,
    moveContactToTop,
    promoteToAtendendo,
    refetch: refetchContacts,
  } = useWhatsAppConversations();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Reset chat selection when tapping WhatsApp icon in bottom nav
  useEffect(() => {
    if (location.state?.resetChat) {
      setSelectedContactId(null);
      setShowContactInfo(false);
    }
  }, [location.state?.resetChat]);

  // Auto-select contact from URL query param
  useEffect(() => {
    const contactFromUrl = searchParams.get("contact");
    if (contactFromUrl && !selectedContactId) {
      setSelectedContactId(contactFromUrl);
      markAsRead(contactFromUrl);
    }
  }, [searchParams, contacts]);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [aiTargetMessage, setAiTargetMessage] = useState<any>(null);
  const [forceInbox, setForceInbox] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [activePanel, setActivePanel] = useState<'createOS' | 'createQuote' | 'scheduleVisit' | 'analyze' | 'registerClient' | 'scheduleMessage' | null>(null);
  const [linkedClientData, setLinkedClientData] = useState<any>(null);
  
  const { tags: orgTags, refetch: refetchTags } = useWhatsAppTags();

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || null;

  // Resolve channelId strictly from the conversation itself.
  // Never fallback to another active channel, otherwise the sender identity changes.
  const activeChannelId = useMemo(() => {
    return selectedContact?.channel_id || null;
  }, [selectedContact?.channel_id]);

  // Fetch team members for assignment
  useEffect(() => {
    const fetchMembers = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!profile) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", profile.organization_id);
      setTeamMembers(data || []);
    };
    fetchMembers();
  }, [user]);
  // Fetch linked client data for panels
  useEffect(() => {
    if (!selectedContact?.linked_client_id) { setLinkedClientData(null); return; }
    supabase
      .from("clients")
      .select("id, name, phone, email, city, state, company_name, street, number, neighborhood, zip_code")
      .eq("id", selectedContact.linked_client_id)
      .single()
      .then(({ data }) => setLinkedClientData(data));
  }, [selectedContact?.linked_client_id]);

  // Close panel when deselecting contact
  useEffect(() => {
    if (!selectedContactId) setActivePanel(null);
  }, [selectedContactId]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    markAsRead(contactId);
    // In fullscreen mode, auto-show contact info panel
    if (fullscreen && !isMobile) {
      setShowContactInfo(true);
      setShowAICopilot(false);
      setActivePanel(null);
    }
  };

  const isConnected = !channelLoading && channel?.is_connected;
  // Show inbox whenever org has any channel (even deleted) or contacts exist — messages live in DB permanently
  const hasAnyChannel = allChannels.length > 0;
  const showInbox = !!channel || hasAnyChannel || forceInbox || contacts.length > 0;
  const isMobileChatFocused = isMobile && !!selectedContactId;

  // Channel options for NewConversationDialog
  const channelOptions = useMemo(() =>
    allChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      phone_number: ch.phone_number,
      is_connected: ch.is_connected,
    })),
    [allChannels]
  );

  if (channelLoading) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary animate-pulse" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">Conectando ao WhatsApp</p>
          <p className="text-xs text-muted-foreground">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  if (!showInbox) {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <WhatsAppConnectionScreen
          onConnected={() => {
            setForceInbox(true);
            refetchChannel();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Top bar */}
      {!isMobileChatFocused && !fullscreen && (
        <>
          <div className="flex items-center justify-between px-4 border-b border-border/40 bg-card gap-3 shrink-0 py-3 shadow-[0_1px_3px_0_hsl(0,0%,0%,0.04)]">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <h1 className="text-base font-black tracking-tight text-foreground shrink-0">WhatsApp</h1>
              <ConnectionStatusPanel
                channelId={channel?.id || null}
                isConnected={!!channel?.is_connected}
                phoneNumber={channel?.phone_number || null}
                lastConnectedAt={channel?.last_connected_at || null}
                onRequestQR={() => fetchQRCode()}
                onReconnect={() => fetchQRCode()}
                qrCode={qrCode}
                qrLoading={qrLoading}
                onRefreshQR={() => fetchQRCode()}
                compact
              />
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <AICreditsDisplay />
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={() => navigate("/whatsapp/contatos")} title="Contatos">
                <Users className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={() => navigate("/whatsapp/relatorio")} title="Relatório">
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:inline-flex" onClick={() => window.open("/whatsapp/full", "_blank")} title="Abrir em tela cheia">
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/whatsapp/configuracoes")} title="Configurações">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {!fullscreen && <NotificationPromptBanner />}
        </>
      )}

      {/* 3-column inbox */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Column 1: Conversation List */}
        <div
          className={`w-full md:w-80 lg:w-[340px] border-r border-border flex-shrink-0 ${
            selectedContactId ? "hidden md:flex" : "flex"
          } flex-col bg-card min-h-0`}
        >
          <ConversationList
            contacts={contacts}
            loading={contactsLoading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedContactId={selectedContactId}
            onSelectContact={handleSelectContact}
            currentUserId={user?.id}
            teamMembers={teamMembers}
            orgTags={orgTags}
            channels={channelOptions}
            onNewContact={() => setShowNewContact(true)}
            onNewConversation={() => setShowNewConversation(true)}
            onDeleteConversation={(id) => {
              deleteConversation(id);
              if (selectedContactId === id) setSelectedContactId(null);
            }}
            onMarkUnread={(id) => markAsUnread(id)}
            onFinalizeConversation={(id) => {
              finalizeConversation(id);
              if (selectedContactId === id) setSelectedContactId(null);
            }}
            onRefresh={refetchContacts}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </div>

        {/* Column 2: Chat */}
        <div
          className={`flex-1 flex flex-col min-w-0 min-h-0 ${
            !selectedContactId ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedContact ? (
            <ChatPanel
              key={selectedContact.id}
              contact={selectedContact}
              channelId={activeChannelId}
              onBack={() => setSelectedContactId(null)}
              onToggleInfo={() => { setShowContactInfo(!showContactInfo); setActivePanel(null); }}
              onContactUpdate={refetchContacts}
              onSelectContact={handleSelectContact}
              teamMembers={teamMembers}
              onAIReplyToMessage={(msg) => {
                setAiTargetMessage(msg);
                setShowAICopilot(true);
                setShowContactInfo(false);
                setActivePanel(null);
              }}
              onToggleAI={() => {
                setShowAICopilot(!showAICopilot);
                if (!showAICopilot) { setShowContactInfo(false); setAiTargetMessage(null); setActivePanel(null); }
              }}
              showAICopilot={showAICopilot}
              onShowCreateOS={() => {
                setActivePanel('createOS');
                setShowContactInfo(false);
                setShowAICopilot(false);
              }}
              onShowScheduleVisit={() => {
                setActivePanel('scheduleVisit');
                setShowContactInfo(false);
                setShowAICopilot(false);
              }}
              onShowAnalyze={() => {
                setActivePanel('analyze');
                setShowContactInfo(false);
                setShowAICopilot(false);
              }}
              onShowScheduleMessage={() => {
                setActivePanel('scheduleMessage');
                setShowContactInfo(false);
                setShowAICopilot(false);
              }}
              onShowCreateQuote={() => {
                // Navigate to quote creation with client pre-filled
                if (selectedContact?.linked_client_id) {
                  window.open(`/orcamentos/novo?client_id=${selectedContact.linked_client_id}`, '_blank');
                } else {
                  window.open('/orcamentos/novo', '_blank');
                }
              }}
              onMessageSent={(contactId, content) => {
                promoteToAtendendo(contactId);
                moveContactToTop(contactId, content);
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/[0.04] relative overflow-hidden">
              {/* WhatsApp-like background pattern */}
              <div className="absolute inset-0 bg-whatsapp-pattern opacity-[0.03] dark:opacity-[0.02] pointer-events-none" />
              
              <div className="text-center space-y-4 relative z-10 px-6 max-w-sm">
                <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
                  <MessageSquare className="h-9 w-9 text-primary/60" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight text-foreground/80">
                    Sua central de atendimento
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Selecione uma conversa à esquerda para visualizar o histórico e responder seus clientes em tempo real.
                  </p>
                </div>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/40 text-[11px] text-muted-foreground/80 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Pronto para receber mensagens
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Contact Info - Desktop side panel */}
        {showContactInfo && selectedContact && !showAICopilot && !isMobile && (
          <div className="hidden md:flex w-72 xl:w-80 border-l border-border flex-col min-h-0">
            <ContactInfoPanel
              contact={selectedContact}
              onClose={() => setShowContactInfo(false)}
              onContactUpdate={refetchContacts}
              onRegisterClient={() => {
                setActivePanel('registerClient');
                setShowContactInfo(false);
              }}
              onShowCreateOS={() => {
                setActivePanel('createOS');
                setShowContactInfo(false);
              }}
            />
          </div>
        )}

        {/* Contact Info - Mobile full-screen overlay */}
        {showContactInfo && selectedContact && isMobile && (
          <div className="absolute inset-0 z-50 bg-card flex flex-col min-h-0">
            <ContactInfoPanel
              contact={selectedContact}
              onClose={() => setShowContactInfo(false)}
              onContactUpdate={refetchContacts}
              onRegisterClient={() => {
                setActivePanel('registerClient');
                setShowContactInfo(false);
              }}
              onShowCreateOS={() => {
                setActivePanel('createOS');
                setShowContactInfo(false);
              }}
            />
          </div>
        )}

        {/* Column 3/4: AI Copilot (desktop only) */}
        {showAICopilot && selectedContact && !isMobile && (
          <div className="hidden md:flex w-80 xl:w-[340px] flex-col min-h-0">
            <AICopilotPanel
              contactId={selectedContact.id}
              channelId={activeChannelId}
              onClose={() => { setShowAICopilot(false); setAiTargetMessage(null); }}
              targetMessage={aiTargetMessage}
              onTargetMessageClear={() => setAiTargetMessage(null)}
              onMessageSent={(contactId, content) => {
                promoteToAtendendo(contactId);
                moveContactToTop(contactId, content);
              }}
            />
          </div>
        )}

        {/* Column: Action Panels (CreateOS, ScheduleVisit, Analyze) */}
        {activePanel === 'createOS' && selectedContact && !isMobile && (
          <div className="hidden md:flex w-[480px] xl:w-[540px] border-l border-border flex-col min-h-0">
            <CreateOSModal
              open={true}
              onOpenChange={(open) => { if (!open) setActivePanel(null); }}
              contact={selectedContact}
              linkedClient={linkedClientData}
              inline
            />
          </div>
        )}

        {activePanel === 'scheduleVisit' && selectedContact && !isMobile && (
          <div className="hidden md:flex w-80 xl:w-[400px] border-l border-border flex-col min-h-0">
            <ScheduleVisitModal
              open={true}
              onOpenChange={(open) => { if (!open) setActivePanel(null); }}
              contact={selectedContact}
              linkedClient={linkedClientData}
              inline
            />
          </div>
        )}

        {activePanel === 'analyze' && selectedContact && !isMobile && (
          <div className="hidden md:flex w-80 xl:w-[400px] border-l border-border flex-col min-h-0">
            <AnalyzeConversationModal
              open={true}
              onOpenChange={(open) => { if (!open) setActivePanel(null); }}
              contactId={selectedContact.id}
              contact={selectedContact}
              linkedClient={linkedClientData}
              inline
            />
          </div>
        )}

        {/* Column: Register Client Panel */}
        {activePanel === 'registerClient' && selectedContact && !isMobile && (
          <div className="hidden md:flex w-80 xl:w-[400px] border-l border-border flex-col min-h-0">
            <RegisterClientPanel
              contact={selectedContact}
              onClose={() => setActivePanel(null)}
              onClientRegistered={() => {
                refetchContacts();
                setActivePanel(null);
              }}
            />
          </div>
        )}

        {/* Column: Schedule Message Panel */}
        {activePanel === 'scheduleMessage' && selectedContact && !isMobile && (
          <div className="hidden md:flex w-80 xl:w-[400px] border-l border-border flex-col min-h-0">
            <ScheduleMessagePanel
              contact={selectedContact}
              channelId={activeChannelId}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}


        {activePanel === 'createOS' && selectedContact && isMobile && (
          <CreateOSModal
            open={true}
            onOpenChange={(open) => { if (!open) setActivePanel(null); }}
            contact={selectedContact}
            linkedClient={linkedClientData}
          />
        )}
        {activePanel === 'scheduleVisit' && selectedContact && isMobile && (
          <ScheduleVisitModal
            open={true}
            onOpenChange={(open) => { if (!open) setActivePanel(null); }}
            contact={selectedContact}
            linkedClient={linkedClientData}
          />
        )}
        {activePanel === 'analyze' && selectedContact && isMobile && (
          <AnalyzeConversationModal
            open={true}
            onOpenChange={(open) => { if (!open) setActivePanel(null); }}
            contactId={selectedContact.id}
            contact={selectedContact}
            linkedClient={linkedClientData}
          />
        )}
      </div>

      {/* Mobile fullscreen overlays - outside the 3-column flex to avoid overflow clipping */}
      {activePanel === 'registerClient' && selectedContact && isMobile && (
        <div className="absolute inset-0 z-50 bg-card flex flex-col min-h-0">
          <RegisterClientPanel
            contact={selectedContact}
            onClose={() => setActivePanel(null)}
            onClientRegistered={() => {
              refetchContacts();
              setActivePanel(null);
            }}
          />
        </div>
      )}
      {activePanel === 'scheduleMessage' && selectedContact && isMobile && (
        <div className="absolute inset-0 z-50 bg-card flex flex-col min-h-0">
          <ScheduleMessagePanel
            contact={selectedContact}
            channelId={activeChannelId}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}


      {/* Modals */}
      <NewContactDialog
        open={showNewContact}
        onOpenChange={setShowNewContact}
        channelId={channel?.id || null}
        onCreated={(contactId) => {
          refetchContacts();
          setSelectedContactId(contactId);
        }}
      />
      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        channels={channelOptions}
        onSelected={(contactId) => {
          refetchContacts();
          handleSelectContact(contactId);
        }}
      />
    </div>
  );
}
