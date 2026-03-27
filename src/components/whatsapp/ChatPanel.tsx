import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppSend } from "@/hooks/useWhatsAppSend";
import { useWhatsAppMediaSend } from "@/hooks/useWhatsAppMediaSend";
import { useWhatsAppMessageActions } from "@/hooks/useWhatsAppMessageActions";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TagBadge } from "./TagBadge";
import { TagSelector } from "./TagSelector";
import { useWhatsAppTags } from "@/hooks/useWhatsAppTags";
import { QuickRepliesPopover } from "./QuickRepliesPopover";
import { BotExecutionPanel, BotStatusBanner } from "./bots/BotExecutionPanel";
import { ScheduledMessageIndicator } from "./ScheduledMessageIndicator";
import { ClientSummaryBar } from "./ClientSummaryBar";
import { ConversationResolveDialog } from "./ConversationResolveDialog";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  Send,
  User,
  Loader2,
  CheckCircle,
  MoreVertical,
  Paperclip,
  Pencil,
  UserCheck,
  Zap,
  Plus,
  CalendarPlus,
  ClipboardList,
  ExternalLink,
  ArrowRightLeft,
  PenLine,
  Image as ImageIcon,
  Globe,
  FileText,
  Video,
  Mic,
  MicOff,
  X,
  Eye,
  EyeOff,
  Info,
  Sparkles,
  Upload,
  Clock,
  WifiOff,
  Link2,
  Reply,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ChatPanelProps {
  contact: any;
  channelId: string | null;
  onBack: () => void;
  onToggleInfo: () => void;
  onContactUpdate: () => void;
  teamMembers?: { user_id: string; full_name: string | null }[];
  onAIReplyToMessage?: (message: any) => void;
  onToggleAI?: () => void;
  showAICopilot?: boolean;
  onShowCreateOS?: (prefill?: any) => void;
  onShowScheduleVisit?: () => void;
  onShowAnalyze?: () => void;
  onShowScheduleMessage?: () => void;
  onShowCreateQuote?: () => void;
  onMessageSent?: (contactId: string, content: string) => void;
}

export function ChatPanel({ contact, channelId, onBack, onToggleInfo, onContactUpdate, teamMembers = [], onAIReplyToMessage, onToggleAI, showAICopilot, onShowCreateOS, onShowScheduleVisit, onShowAnalyze, onShowScheduleMessage, onShowCreateQuote, onMessageSent }: ChatPanelProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { messages, loading, refetch: refetchMessages, addOptimisticMessage, updateOptimisticMessage } = useWhatsAppMessages(contact.id);
  const { sendMessage, sending } = useWhatsAppSend();
  const { sendMedia, sending: sendingMedia } = useWhatsAppMediaSend();
  const { deleteMessage, editMessage, reactToMessage, acting } = useWhatsAppMessageActions();
  const { organization } = useOrganization();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [signatureEnabled, setSignatureEnabled] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const { tags: orgTags, getTagByName } = useWhatsAppTags();
  
  const [linkedClientData, setLinkedClientData] = useState<any>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelOwnerPhone, setChannelOwnerPhone] = useState<string | null>(null);
  // Media states
  const [attachOpen, setAttachOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "document" | "audio" | "video" | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");

  const isSimplified = false;

  // Audio recording
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Load signature preference from profile via sensitive data hook
  const { sensitiveData } = useProfileSensitiveData();
  useEffect(() => {
    const pref = sensitiveData?.whatsapp_signature_enabled;
    if (pref !== undefined) setSignatureEnabled(pref);
  }, [sensitiveData]);

  // Fetch channel info for this contact
  useEffect(() => {
    if (!contact.channel_id) { setChannelName(null); setChannelOwnerPhone(null); return; }
    supabase
      .from("whatsapp_channels")
      .select("name, phone_number, instance_name, owner_jid")
      .eq("id", contact.channel_id)
      .single()
      .then(({ data }) => {
        if (data) {
          const customName = data.name && data.name !== data.instance_name && !data.name.startsWith("org-")
            ? data.name
            : null;
          const display = customName || data.phone_number || null;
          setChannelName(display);
          // Extract owner phone for group isMe detection
          const ownerPhone = data.owner_jid
            ? data.owner_jid.split("@")[0]
            : data.phone_number?.replace(/\D/g, "") || null;
          setChannelOwnerPhone(ownerPhone);
        }
      });
  }, [contact.channel_id]);


  useEffect(() => {
    if (!contact.linked_client_id) { setLinkedClientData(null); return; }
    supabase
      .from("clients")
      .select("id, name, phone, email, city, state, company_name, street, number, neighborhood, zip_code")
      .eq("id", contact.linked_client_id)
      .single()
      .then(({ data }) => setLinkedClientData(data));
  }, [contact.linked_client_id]);

  const prevMessagesLenRef = useRef(0);
  const userSentRef = useRef(false);
  const initialLoadRef = useRef(true);

  // Mark that user just sent a message (to force scroll to bottom)
  const originalAddOptimistic = addOptimisticMessage;
  const wrappedAddOptimistic = useCallback((msg: any) => {
    userSentRef.current = true;
    originalAddOptimistic(msg);
  }, [originalAddOptimistic]);

  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;

    // Always scroll to bottom on initial load
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
      prevMessagesLenRef.current = messages.length;
      return;
    }

    const isNewMessage = messages.length > prevMessagesLenRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    const shouldScroll = userSentRef.current || (isNewMessage && isNearBottom);

    if (shouldScroll) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    userSentRef.current = false;
    prevMessagesLenRef.current = messages.length;
  }, [messages]);

  // Fetch quick replies
  useEffect(() => {
    if (!organization?.id) return;
    supabase
      .from("whatsapp_quick_messages")
      .select("*")
      .eq("organization_id", organization.id)
      .order("title")
      .then(({ data }) => setQuickReplies(data || []));
  }, [organization?.id]);

  // Determine if the channel for this conversation is online
  const channelData = contact.channel;
  const isChannelConnected = useMemo(() => {
    if (!channelData) return false; // No channel data — block send until confirmed
    return channelData.is_connected === true && channelData.channel_status === "connected";
  }, [channelData]);
  const isChannelDeleted = channelData?.channel_status === "deleted";
  const canSend = !!channelId && isChannelConnected;
  // Only show offline banner when we have definitive channel data showing disconnection
  const isChannelOffline = !!channelId && !!channelData && !isChannelConnected;
  const tags: string[] = contact.tags || [];
  const userName = profile?.full_name || "";
  const isSending = sending || sendingMedia;

  // Slash command filtering
  const filteredSlashReplies = quickReplies.filter((r) => {
    if (!slashFilter) return true;
    const q = slashFilter.toLowerCase();
    return r.title.toLowerCase().includes(q) || (r.shortcut || "").toLowerCase().includes(q);
  });

  const handleSlashSelect = (reply: any) => {
    setText(reply.content);
    setShowSlashMenu(false);
    setSlashFilter("");
    setSlashIndex(0);
    textareaRef.current?.focus();
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (value.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(value.substring(1));
      setSlashIndex(0);
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }
  };

  // Auto-assign current user as attendant when sending a message
  const autoAssignOnSend = useCallback(async () => {
    if (!profile?.user_id || !contact.id) return;
    // Only assign if not already assigned to this user
    if (contact.assigned_to === profile.user_id) return;
    await supabase
      .from("whatsapp_contacts")
      .update({ assigned_to: profile.user_id })
      .eq("id", contact.id);
  }, [profile?.user_id, contact.id, contact.assigned_to]);

  const handleSend = async () => {
    if (!text.trim() || isSending || !channelId) return;
    let msg = text.trim();
    const isWebchat = contact?.source === "webchat" || (contact?.whatsapp_id || "").startsWith("webchat-");
    // Build the raw message with signature for WhatsApp
    const finalMsg = (signatureEnabled && userName && !isWebchat) ? `*${userName}:*\n${msg}` : msg;
    
    // Capture reply context before clearing
    const replyContext = replyingTo ? {
      reply_to_id: replyingTo.id,
      reply_to_message_id: replyingTo.message_id || null,
      reply_to_content: (replyingTo.content || "").replace(/^\*[^*]+:\*\s*\n?/, "").substring(0, 200),
      reply_to_sender: replyingTo.is_from_me ? (userName || "Eu") : (contact.name || contact.phone || "Cliente"),
    } : null;
    
    // Generate optimistic message ID matching edge function pattern
    const optimisticId = `out_${crypto.randomUUID()}`;
    
    // Add message instantly to UI
    wrappedAddOptimistic({
      id: `opt-${optimisticId}`,
      message_id: optimisticId,
      content: finalMsg,
      is_from_me: true,
      status: "pending",
      created_at: new Date().toISOString(),
      contact_id: contact.id,
      ...(replyContext || {}),
    });
    
    setText("");
    setReplyingTo(null);
    setShowSlashMenu(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
    
    // If conversation is finalized, let realtime update only this item without refetching the inbox
    
    // Auto-assign attendant on send
    autoAssignOnSend();

    // Optimistically move conversation to top of the list
    onMessageSent?.(contact.id, finalMsg);
    
    // Send via API
    const result = await sendMessage(channelId, contact.id, finalMsg, replyContext);
    
    if (result.ok) {
      // Update the optimistic message_id to the real one so realtime can replace it
      updateOptimisticMessage(optimisticId, { 
        status: "sent", 
        message_id: result.message_id || optimisticId,
      });
    } else {
      updateOptimisticMessage(optimisticId, { status: "failed", _failedPayload: { channelId, contactId: contact.id, message: finalMsg } });
    }
  };

  const handleRetry = async (messageId: string, payload: { channelId: string; contactId: string; message: string }) => {
    updateOptimisticMessage(messageId, { status: "pending" });
    const result = await sendMessage(payload.channelId, payload.contactId, payload.message);
    if (result.ok) {
      updateOptimisticMessage(messageId, { status: "sent", _optimistic: false, _failedPayload: undefined });
    } else {
      updateOptimisticMessage(messageId, { status: "failed" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu && filteredSlashReplies.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((prev) => Math.min(prev + 1, filteredSlashReplies.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((prev) => Math.max(prev - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); handleSlashSelect(filteredSlashReplies[slashIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setShowSlashMenu(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "document" | "video") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    setPreviewType(type);
    setMediaCaption("");
    if (type === "image" || type === "video") {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
    setAttachOpen(false);
  };

  const handleSendMedia = async () => {
    if (!previewFile || !previewType || !channelId) return;
    // Auto-assign attendant on media send too
    autoAssignOnSend();
    // Promote to "atendendo" on first media send
    onMessageSent?.(contact.id, `[${previewType}]`);
    await sendMedia(channelId, contact.id, previewFile, previewType, mediaCaption || undefined);
    clearPreview();
  };

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewType(null);
    setMediaCaption("");
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Detect type
    let type: "image" | "document" | "video" = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";

    setPreviewFile(file);
    setPreviewType(type);
    setMediaCaption("");
    if (type === "image" || type === "video") {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }, []);

  // Paste image from clipboard (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setPreviewFile(file);
        setPreviewType("image");
        setMediaCaption("");
        setPreviewUrl(URL.createObjectURL(file));
        return;
      }
    }
  }, []);

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: "audio/webm" });
        setPreviewFile(file);
        setPreviewType("audio");
        setPreviewUrl(URL.createObjectURL(blob));
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  // Message actions
  const handleDeleteMessage = async (messageId: string, mode: "all" | "local" = "all") => {
    const success = await deleteMessage(messageId, mode);
    return success;
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    const success = await editMessage(messageId, newText);
    return success;
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    return await reactToMessage(messageId, emoji);
  };

  const handleToggleTag = async (tag: string) => {
    const current = contact.tags || [];
    const updated = current.includes(tag) ? current.filter((t: string) => t !== tag) : [...current, tag];
    await supabase.from("whatsapp_contacts").update({ tags: updated }).eq("id", contact.id);
  };

  const handleResolve = async () => {
    const isResolved = contact.conversation_status === "resolvido" || contact.conversation_status === "resolved";
    if (isResolved) {
      // Reopen directly
      await supabase.from("whatsapp_contacts").update({ conversation_status: "novo" }).eq("id", contact.id);
      toast.success("Conversa reaberta");
      return;
    }
    // Show dialog to ask for sale result
    setResolveDialogOpen(true);
  };

  const handleResolveResult = async (result: "concluido" | "nao_convertido" | "skip" | null) => {
    // If null, it was a manual close/ESC/click-outside, so just cancel
    if (result === null) {
      setResolveDialogOpen(false);
      return;
    }

    try {
      setIsResolving(true);
      const updates: Record<string, any> = { 
        conversation_status: "resolvido"
      };

      if (result === "concluido") {
        updates.conversion_status = "concluido";
      } else if (result === "nao_convertido") {
        updates.conversion_status = "nao_convertido";
      }

      const { error } = await supabase.from("whatsapp_contacts").update(updates).eq("id", contact.id);
      
      if (error) {
        console.error("Erro ao finalizar conversa:", error);
        toast.error("Erro ao finalizar conversa");
        return;
      }

      toast.success("Conversa finalizada ✓");
      setResolveDialogOpen(false);
      onBack();
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao finalizar");
    } finally {
      setIsResolving(false);
    }
  };


  const handleRename = async () => {
    if (!newName.trim()) return;
    await supabase.from("whatsapp_contacts").update({ name: newName.trim(), is_name_custom: true }).eq("id", contact.id);
    // If linked to a client, also update the client name
    if (contact.linked_client_id) {
      await supabase.from("clients").update({ name: newName.trim() }).eq("id", contact.linked_client_id);
    }
    setRenameOpen(false);
    toast.success("Contato renomeado");
  };

  const handleAssign = async (userId: string | null) => {
    const previousAssigned = contact.assigned_to;
    await supabase.from("whatsapp_contacts").update({ assigned_to: userId }).eq("id", contact.id);
    if (organization?.id) {
      await supabase.from("whatsapp_transfer_log").insert({
        contact_id: contact.id,
        organization_id: organization.id,
        from_user_id: previousAssigned || null,
        to_user_id: userId,
        action: previousAssigned ? "transfer" : "assign",
      });
    }
    toast.success(userId ? "Atendente atribuído" : "Atribuição removida");
  };

  const handleTransfer = async (toUserId: string) => {
    const fromUserId = contact.assigned_to;
    const fromName = teamMembers.find((m) => m.user_id === fromUserId)?.full_name || "Ninguém";
    const toName = teamMembers.find((m) => m.user_id === toUserId)?.full_name || "Sem nome";
    await supabase.from("whatsapp_contacts").update({ assigned_to: toUserId }).eq("id", contact.id);
    if (organization?.id) {
      await supabase.from("whatsapp_transfer_log").insert({
        contact_id: contact.id,
        organization_id: organization.id,
        from_user_id: fromUserId || null,
        to_user_id: toUserId,
        action: "transfer",
      });
    }
    setTransferOpen(false);
    toast.success(`Conversa transferida de ${fromName} para ${toName}`);
  };

  const handleToggleSignature = async () => {
    const newValue = !signatureEnabled;
    setSignatureEnabled(newValue);
    if (profile?.user_id) {
      await supabase.from("profiles").update({ whatsapp_signature_enabled: newValue }).eq("user_id", profile.user_id);
    }
  };

  const handleQuickReply = (content: string) => {
    setText(content);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(Math.max(scrollH, 40), 100) + "px";
    }
  }, [text]);

  const assignedMember = teamMembers.find((m) => m.user_id === contact.assigned_to);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div
      className="flex flex-col overflow-hidden absolute inset-0 z-30 bg-background md:relative md:inset-auto md:z-auto md:h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header - compact on mobile simplified */}
      <div className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 border-b border-border/60 bg-card shadow-sm shrink-0 sticky top-0 z-20`}>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} title="Fechar conversa">
          <ArrowLeft className="h-4 w-4 md:hidden" />
          <X className="h-4 w-4 hidden md:block" />
        </Button>

        <button onClick={onToggleInfo} className="flex items-center gap-3 flex-1 min-w-0">
          {contact.profile_picture_url ? (
            <img
              src={contact.profile_picture_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover shrink-0 ring-2 ring-background"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm ${
              contact.profile_picture_url ? "hidden" : ""
            }`}
          >
            <span className="text-sm font-bold text-primary-foreground">
              {(linkedClientData?.name || contact.linked_client?.name || contact.name || contact.phone || "?").charAt(0).toUpperCase()}
            </span>
          </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{linkedClientData?.name || contact.linked_client?.name || contact.name || contact.phone || "Contato"}</p>
              {!isSimplified && (
                <p className="text-xs text-muted-foreground/70 truncate flex items-center gap-1">
                  {contact.source === "webchat" ? (
                    <>
                      <Globe className="h-3 w-3 text-primary/60" />
                      <span>Chat do Site</span>
                    </>
                  ) : contact.source === "instagram" ? (
                    <>
                      <svg className="h-3 w-3 text-pink-500/70" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      <span>Instagram</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3 text-emerald-500/70" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      <span>WhatsApp</span>
                    </>
                  )}
                  {channelName && <span>• {channelName}</span>}
                  {contact.phone && <span>• {contact.phone}</span>}
                </p>
              )}
            </div>
        </button>

        {!isSimplified && (
          <div className="hidden sm:flex items-center gap-1 mr-1">
            {tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag} tag={tag} color={getTagByName(tag)?.color || "gray"} size="xs" />
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5">
          {/* Resolve button - always visible */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={(contact.conversation_status === "resolvido" || contact.conversation_status === "resolved") ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 md:h-7 md:w-7"
                  onClick={handleResolve}
                >
                  <CheckCircle className={cn("h-4 w-4 md:h-3.5 md:w-3.5", (contact.conversation_status === "resolvido" || contact.conversation_status === "resolved") ? "text-emerald-500" : "")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{(contact.conversation_status === "resolvido" || contact.conversation_status === "resolved") ? "Reabrir conversa" : "Finalizar conversa"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!isSimplified && <BotExecutionPanel contactId={contact.id} />}
          {!isSimplified && <TagSelector currentTags={tags} onToggle={handleToggleTag} />}
          {!isSimplified && onToggleAI && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showAICopilot ? "secondary" : "ghost"} size="icon" className="hidden lg:flex h-7 w-7" onClick={onToggleAI}>
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Copiloto IA</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {!isSimplified && (
            <Button variant="ghost" size="icon" className="hidden lg:flex h-7 w-7" onClick={onToggleInfo}>
              <User className="h-3.5 w-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-7 md:w-7">
                <MoreVertical className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Quick actions (always in menu, primary on mobile simplified) */}
              <DropdownMenuItem onClick={() => onShowCreateOS?.()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar OS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowScheduleVisit?.()}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Agendar visita
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowScheduleMessage?.()}>
                <Clock className="h-4 w-4 mr-2" />
                Agendar mensagem
              </DropdownMenuItem>
              {contact.linked_client_id && (
                <DropdownMenuItem onClick={onToggleInfo}>
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Histórico do cliente
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setNewName(contact.name || ""); setRenameOpen(true); }}>
                <Pencil className="h-4 w-4 mr-2" />
                Renomear contato
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleResolve}>
                <CheckCircle className="h-4 w-4 mr-2" />
                {(contact.conversation_status === "resolvido" || contact.conversation_status === "resolved") ? "Reabrir conversa" : "Finalizar conversa"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const newBlocked = !contact.is_blocked;
                const { error } = await supabase
                  .from("whatsapp_contacts")
                  .update({ is_blocked: newBlocked })
                  .eq("id", contact.id);
                if (error) { toast.error("Erro ao atualizar bloqueio"); return; }
                toast.success(newBlocked ? "Contato bloqueado" : "Contato desbloqueado");
              }}>
                <X className="h-4 w-4 mr-2" />
                {contact.is_blocked ? "Desbloquear contato" : "Bloquear contato"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const newPrivate = !contact.is_private;
                await supabase.from("whatsapp_contacts").update({ is_private: newPrivate }).eq("id", contact.id);
                toast.success(newPrivate ? "Conversa marcada como privada" : "Privacidade removida");
              }}>
                {contact.is_private ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {contact.is_private ? "Remover privacidade" : "Tornar privada"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Atribuir atendente
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  <DropdownMenuItem onClick={() => handleAssign(null)} disabled={!contact.assigned_to}>
                    Remover atribuição
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {teamMembers.map((m) => (
                    <DropdownMenuItem key={m.user_id} onClick={() => handleAssign(m.user_id)}>
                      {m.full_name || "Sem nome"}
                      {m.user_id === contact.assigned_to && " ✓"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transferir conversa
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {teamMembers
                    .filter((m) => m.user_id !== contact.assigned_to)
                    .map((m) => (
                      <DropdownMenuItem key={m.user_id} onClick={() => handleTransfer(m.user_id)}>
                        {m.full_name || "Sem nome"}
                      </DropdownMenuItem>
                    ))}
                  {teamMembers.filter((m) => m.user_id !== contact.assigned_to).length === 0 && (
                    <DropdownMenuItem disabled>Nenhum outro atendente</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Assigned banner - hidden in simplified mode */}
      {!isSimplified && (
        <div className="px-4 py-1.5 bg-muted/20 border-b border-border/40 text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0">
          <UserCheck className="h-3 w-3" />
          {assignedMember ? (
            <>
              Atendente responsável:{" "}
              <span className="font-semibold text-foreground">{assignedMember.full_name}</span>
            </>
          ) : (
            <span className="italic">Sem atendente definido</span>
          )}
          {contact.is_private && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
              <EyeOff className="h-2.5 w-2.5" />
              Privada
            </span>
          )}
        </div>
      )}

      {/* Client summary bar - hidden in simplified mode */}
      {!isSimplified && (
        <ClientSummaryBar contact={contact} />
      )}

      {/* Quick action bar - hidden in simplified mode */}
      {!isSimplified && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => onShowCreateOS?.()}
          >
            <Plus className="h-3 w-3" /> Criar OS
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 shrink-0"
            onClick={() => onShowCreateQuote?.()}
          >
            <FileText className="h-3 w-3" /> Criar orçamento
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 shrink-0"
            onClick={() => onShowScheduleVisit?.()}
          >
            <CalendarPlus className="h-3 w-3" /> Agendar visita
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => onShowAnalyze?.()}
          >
            <Sparkles className="h-3 w-3" /> Analisar conversa
          </Button>
          {contact.linked_client_id && (
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 shrink-0" onClick={onToggleInfo}>
              <ClipboardList className="h-3 w-3" /> Histórico
            </Button>
          )}
        </div>
      )}

      {/* Bot Status Banner */}
      {!isSimplified && <BotStatusBanner contactId={contact.id} />}

      {/* Scheduled message indicator */}
      <ScheduledMessageIndicator contactId={contact.id} onClick={onShowScheduleMessage} />


      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-primary/5 backdrop-blur-[2px] border-2 border-dashed border-primary/40 rounded-lg pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-10 w-10" />
            <p className="text-sm font-semibold">Solte o arquivo aqui</p>
            <p className="text-xs text-muted-foreground">PDF, imagem, vídeo ou documento</p>
          </div>
        </div>
      )}

      {/* Channel offline banner */}
      {isChannelOffline && (
        <div className={cn(
          "shrink-0 flex items-center gap-2 px-4 py-2.5 border-b",
          isChannelDeleted
            ? "bg-muted/60 border-border"
            : "bg-destructive/10 border-destructive/20"
        )}>
          <WifiOff className={cn("h-4 w-4 shrink-0", isChannelDeleted ? "text-muted-foreground" : "text-destructive")} />
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-medium", isChannelDeleted ? "text-muted-foreground" : "text-destructive")}>
              {isChannelDeleted
                ? `Canal excluído${channelData?.phone_number ? ` — ${channelData.phone_number}` : ""}`
                : `Canal desconectado${channelData?.phone_number ? ` — ${channelData.phone_number}` : ""}`
              }
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isChannelDeleted
                ? "O histórico está disponível, mas este canal foi excluído permanentemente."
                : "O histórico está disponível, mas o envio está bloqueado até a reconexão."
              }
            </p>
          </div>
          {!isChannelDeleted && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => navigate("/whatsapp/configuracoes")}
            >
              <Link2 className="h-3 w-3" />
              Reconectar
            </Button>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className={cn("flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-2.5 bg-muted/[0.08]", isMobile && "overscroll-contain")}>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</div>
        ) : (
          messages.map((msg, idx) => {
            const msgDate = new Date(msg.created_at || msg.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
            const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at || messages[idx - 1].timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
            const showDateSeparator = idx === 0 || msgDate !== prevDate;
            return (
              <div key={msg.id} data-message-id={msg.id}>
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-3">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-3 py-0.5 rounded-full">
                      {msgDate}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isGroup={contact?.is_group}
                  channelOwnerPhone={channelOwnerPhone}
                  onDelete={handleDeleteMessage}
                  onEdit={handleEditMessage}
                  onReact={handleReactToMessage}
                  onRetry={msg._failedPayload ? () => handleRetry(msg.message_id, msg._failedPayload) : undefined}
                  onAIReply={onAIReplyToMessage}
                  onReply={(m) => { setReplyingTo(m); setTimeout(() => textareaRef.current?.focus(), 0); }}
                  onScrollToMessage={(id) => {
                    const el = scrollRef.current?.querySelector(`[data-message-id="${id}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      el.classList.add("ring-2", "ring-primary/50");
                      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
                    }
                  }}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Media Preview */}
      {previewFile && !recording && (
        <div className="px-2 py-1.5 border-t border-border/60 bg-card shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]">
          <div className="flex items-center gap-1">
            <button onClick={clearPreview} className="h-7 w-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
            {previewType === "image" && previewUrl && (
              <img src={previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            {previewType === "audio" && (
              <div className="flex items-center gap-2 flex-1 min-w-0 bg-muted/50 rounded-full px-3 h-[34px]">
                <Mic className="h-3.5 w-3.5 text-primary shrink-0" />
                {previewUrl && <audio src={previewUrl} controls className="h-7 flex-1" />}
              </div>
            )}
            {previewType === "video" && previewUrl && (
              <video src={previewUrl} className="h-16 w-20 rounded-lg object-cover" muted />
            )}
            {previewType === "document" && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate">{previewFile.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {(previewFile.size / 1024).toFixed(0)} KB
                </span>
              </div>
            )}
            {(previewType === "image" || previewType === "video") && (
              <Input
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Legenda (opcional)..."
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleSendMedia()}
              />
            )}
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSendMedia}
              disabled={sendingMedia}
            >
              {sendingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Recording bar — replaces input bar inline */}
      {recording && (
        <div className="px-2 py-1.5 border-t border-border/60 bg-card shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]">
          <div className="flex items-center gap-1">
            <button onClick={cancelRecording} className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-destructive hover:bg-destructive/10 transition-colors">
              <X className="h-[18px] w-[18px]" />
            </button>
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-full border border-border/40 px-3 h-[34px]">
              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <span className="text-sm font-medium text-foreground">Gravando</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmtTime(recordingTime)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      {!previewFile && !recording && (
        <div className="relative px-2 py-1.5 border-t border-border/60 bg-card shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.375rem)]">
          {/* Slash command menu */}
          {showSlashMenu && canSend && filteredSlashReplies.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
              <div className="p-1.5">
                <p className="text-[10px] font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Respostas rápidas
                </p>
                {filteredSlashReplies.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => handleSlashSelect(r)}
                    className={`w-full text-left px-2.5 py-2 rounded-md flex items-start gap-2 transition-colors ${
                      i === slashIndex ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{r.title}</span>
                        {r.shortcut && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                            /{r.shortcut}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSlashMenu && canSend && filteredSlashReplies.length === 0 && slashFilter && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-3">
              <p className="text-xs text-muted-foreground text-center">Nenhuma resposta encontrada</p>
            </div>
          )}

          {/* Reply preview bar */}
          {replyingTo && (
            <div className="mb-1.5 flex items-start gap-2 bg-muted/60 border-l-[3px] border-primary rounded-r-lg px-3 py-2 animate-in slide-in-from-bottom-2 duration-150">
              <Reply className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary truncate">
                  {replyingTo.is_from_me ? (userName || "Eu") : (contact.name || contact.phone || "Cliente")}
                </p>
                <p className="text-[11px] text-muted-foreground truncate leading-snug">
                  {(() => {
                    const clean = (replyingTo.content || "").replace(/^\*[^*]+:\*\s*\n?/, "");
                    if (replyingTo.media_type === "image") return "📷 Imagem";
                    if (replyingTo.media_type === "audio") return "🎤 Áudio";
                    if (replyingTo.media_type === "video") return "🎥 Vídeo";
                    if (replyingTo.media_type === "document") return "📄 Documento";
                    return clean.length > 100 ? clean.substring(0, 100) + "…" : clean;
                  })()}
                </p>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="shrink-0 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Signature indicator - hidden in simplified mode */}
          {!isSimplified && canSend && signatureEnabled && userName && (
            <div className="mb-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
              <PenLine className="h-3 w-3" />
              Assinando como <span className="font-medium text-foreground">{userName}</span>
            </div>
          )}

          {canSend ? (
            <div className="flex items-end gap-1">
              {/* Attachment button - left side */}
              <Popover open={attachOpen} onOpenChange={setAttachOpen}>
                <PopoverTrigger asChild>
                  <button className="shrink-0 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-full">
                    <Paperclip className="h-[18px] w-[18px]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-44 p-1.5">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm">Imagem</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Documento</span>
                  </button>
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <Video className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Vídeo</span>
                  </button>
                </PopoverContent>
              </Popover>

              {/* Text input - compact like WhatsApp */}
              <div className="flex-1 flex items-end bg-muted/50 rounded-full border border-border/40 overflow-hidden">
                <Textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={isSimplified ? "Mensagem..." : "Mensagem..."}
                  className={cn(
                    "flex-1 resize-none text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-3 py-1.5",
                    "min-h-[34px] max-h-[80px]"
                  )}
                  disabled={false}
                  rows={1}
                />

                {/* Quick replies button - inside input area */}
                {!isSimplified && (
                  <QuickRepliesPopover onSelect={handleQuickReply} />
                )}
              </div>

              {/* Signature toggle - compact */}
              {!isSimplified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "shrink-0 h-8 w-8 flex items-center justify-center rounded-full transition-colors",
                          signatureEnabled ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={handleToggleSignature}
                      >
                        <PenLine className="h-[15px] w-[15px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Assinatura {signatureEnabled ? "ativada" : "desativada"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Send / Mic button */}
              {text.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <button
                  onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
                  className="shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : isChannelOffline ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className={cn("flex items-center gap-2", isChannelDeleted ? "text-muted-foreground" : "text-destructive")}>
                <WifiOff className="h-4 w-4" />
                <span className="text-xs font-medium">
                  {isChannelDeleted
                    ? `Canal ${channelData?.phone_number || channelData?.name || ""} excluído`
                    : `Canal ${channelData?.phone_number || channelData?.name || ""} desconectado`
                  }
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                {isChannelDeleted
                  ? "Este canal foi excluído permanentemente. Para usar este número, crie um novo canal."
                  : "Reconecte este canal para voltar a enviar mensagens nesta conversa."
                }
              </p>
              {!isChannelDeleted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => navigate("/whatsapp/configuracoes")}
                >
                  <Link2 className="h-3 w-3" />
                  Reconectar canal
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-1">
              Envio indisponível — nenhum canal vinculado
            </p>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "document")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/3gpp,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, "video")}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Renomear contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
            <Button onClick={handleRename} disabled={!newName.trim()} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve dialog with sale result */}
      <ConversationResolveDialog
        open={resolveDialogOpen}
        onResult={handleResolveResult}
        loading={isResolving}
      />


      {/* Panels moved to WhatsAppInbox as inline columns */}
    </div>
  );
}
