import { memo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TagBadge } from "./TagBadge";
import { WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { MoreVertical, Trash2, EyeOff, Clock, MailOpen, CheckCircle2, Users } from "lucide-react";
import { getContactDisplayName } from "@/lib/whatsappContactName";
import { getConversionStep } from "./ConversionStatusSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConversationItemProps {
  contact: any;
  isSelected: boolean;
  onClick: () => void;
  teamMembers?: { user_id: string; full_name: string | null }[];
  orgTags?: WhatsAppTag[];
  onDelete?: () => void;
  onMarkUnread?: () => void;
  onFinalize?: () => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: () => void;
  hasScheduledMessage?: boolean;
}

/** Generate a deterministic color class from a string */
function nameToAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
    "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500",
    "bg-cyan-500", "bg-fuchsia-500",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export const ConversationItem = memo(function ConversationItem({ contact, isSelected, onClick, teamMembers = [], orgTags = [], onDelete, onMarkUnread, onFinalize, selectionMode, isChecked, onToggleCheck, hasScheduledMessage }: ConversationItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const displayName = getContactDisplayName(contact);
  const initial = displayName.charAt(0).toUpperCase();
  const timeAgo = contact.last_message_at
    ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: false, locale: ptBR })
    : "";

  let rawMessage = contact.last_message_content || contact.phone || "";
  const lastIsFromMe = contact.last_message_is_from_me === true;
  // Strip attendant signature pattern "*Name:*\n" or "*Name:* " from preview
  rawMessage = rawMessage.replace(/^\*[^*]+:\*\s*/, "");
  const lastMessage = rawMessage
    ? (lastIsFromMe ? "Você: " : "") + rawMessage
    : contact.phone || "";
  const tags: string[] = contact.tags || [];
  const assignedMember = teamMembers.find((m) => m.user_id === contact.assigned_to);
  const avatarBg = nameToAvatarColor(displayName);
  const channelLabel = contact.channel?.phone_number || contact.channel?.name || null;
  const isChannelOffline = contact.channel ? (contact.channel.is_connected === false || ["disconnected", "deleted", "error", "deleting"].includes(contact.channel.channel_status)) : false;

  const getColor = (name: string) => orgTags.find(t => t.name === name)?.color || "gray";

  /** Shared menu items for both dropdown and context menu */
  const renderMenuItems = (Item: typeof DropdownMenuItem) => (
    <>
      {onMarkUnread && (
        <Item onClick={(e: React.MouseEvent) => { e.stopPropagation(); onMarkUnread(); }}>
          <MailOpen className="h-4 w-4 mr-2" />
          Marcar como não lida
        </Item>
      )}
      {onFinalize && contact.conversation_status !== "resolvido" && (
        <Item onClick={(e: React.MouseEvent) => { e.stopPropagation(); onFinalize(); }}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Finalizar conversa
        </Item>
      )}
      {onDelete && (
        <Item
          className="text-destructive focus:text-destructive"
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Apagar conversa
        </Item>
      )}
    </>
  );

  const hasActions = !!(onDelete || onMarkUnread || onFinalize);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!hasActions}>
          <div className="relative group">
        <button
          onClick={selectionMode ? (onToggleCheck || onClick) : onClick}
          className={cn(
            "w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-200 border-l-2",
            selectionMode && isChecked
              ? "bg-primary/[0.06] border-l-primary"
              : isSelected
                ? "bg-primary/[0.07] dark:bg-primary/[0.12] border-l-primary"
                : contact.is_unread
                  ? "bg-primary/[0.02] hover:bg-muted/60 border-l-transparent"
                  : "hover:bg-muted/40 border-l-transparent"
          )}
        >
          {/* Selection checkbox */}
          {selectionMode && (
            <div className="shrink-0 flex items-center mt-1.5 mr-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={!!isChecked}
                onChange={onToggleCheck}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
            </div>
          )}
          {/* Avatar */}
          <div className="relative shrink-0 mt-0.5">
            {contact.profile_picture_url ? (
              <img
                src={contact.profile_picture_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-background"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : null}
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm",
                avatarBg,
                contact.profile_picture_url && "hidden"
              )}
            >
              {contact.is_group ? (
                <Users className="h-4.5 w-4.5" />
              ) : (
                <span className="text-sm font-bold">{initial}</span>
              )}
            </div>
            {contact.is_unread && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[hsl(222,69%,49%)] border-2 border-card shadow-sm" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {contact.is_group && (
                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-[13px] truncate",
                    contact.is_unread ? "font-bold text-foreground" : "font-semibold text-foreground/80"
                  )}
                >
                  {displayName}
                </span>
              </div>
              {timeAgo && (
                <span
                  className={cn(
                    "text-[10px] shrink-0",
                    contact.is_unread ? "text-[hsl(222,69%,49%)] font-bold" : "text-muted-foreground/50"
                  )}
                >
                  {timeAgo}
                </span>
              )}
            </div>
            <p
              className={cn(
                "text-[12px] truncate mt-0.5 leading-relaxed",
                contact.is_unread ? "text-foreground/80 font-medium" : "text-muted-foreground/60"
              )}
            >
              {lastMessage}
            </p>
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {/* Conversion status badge */}
              {contact.conversion_status && contact.conversion_status !== "novo_contato" && (() => {
                const step = getConversionStep(contact.conversion_status);
                const StepIcon = step.icon;
                return (
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[9px] font-medium rounded-full px-1.5 py-0.5",
                    step.bgColor, step.color
                  )}>
                    <StepIcon className="h-2.5 w-2.5" />
                    {step.label}
                  </span>
                );
              })()}
              {hasScheduledMessage && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full px-1.5 py-0.5 border border-amber-500/20">
                  <Clock className="h-2.5 w-2.5" />
                  Agendada
                </span>
              )}
              {contact.is_private && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-destructive/10 text-destructive rounded-full px-1.5 py-0.5">
                  <EyeOff className="h-2.5 w-2.5" />
                  Privada
                </span>
              )}
              {assignedMember && (
                <span className="text-[9px] text-muted-foreground bg-muted/80 rounded-full px-1.5 py-0.5">
                  {assignedMember.full_name?.split(" ")[0] || "Atendente"}
                </span>
              )}
              {channelLabel && (
                <span className={cn(
                  "text-[9px] rounded-full px-1.5 py-0.5 border inline-flex items-center gap-0.5",
                  isChannelOffline
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    : "bg-muted/80 text-muted-foreground border-border/60"
                )}>
                  {isChannelOffline ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {`Desconectado • ${channelLabel}`}
                    </>
                  ) : (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {channelLabel}
                    </>
                  )}
                </span>
              )}
              {!channelLabel && contact.channel_id && (
                <span className="text-[9px] rounded-full px-1.5 py-0.5 border bg-muted/60 text-muted-foreground/60 border-border/40 inline-flex items-center gap-0.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  Canal removido
                </span>
              )}
              {tags.slice(0, 2).map((tag) => (
                <TagBadge key={tag} tag={tag} color={getColor(tag)} size="xs" />
              ))}
              {tags.length > 2 && (
                <span className="text-[9px] text-muted-foreground/60">+{tags.length - 2}</span>
              )}
            </div>
          </div>

          {/* Unread counter */}
          {(contact.unread_count > 0 || contact.is_unread) && (
            <span className="bg-[hsl(222,69%,49%)] text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1.5 shrink-0 mt-0.5 shadow-md shadow-primary/20">
              {contact.unread_count > 0 ? (contact.unread_count > 99 ? "99+" : contact.unread_count) : "•"}
            </span>
          )}
        </button>

        {/* Three-dots menu */}
        {hasActions && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {renderMenuItems(DropdownMenuItem)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </ContextMenuTrigger>
    {hasActions && (
      <ContextMenuContent className="w-48">
        {renderMenuItems(ContextMenuItem)}
      </ContextMenuContent>
    )}
  </ContextMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar a conversa com <strong>{displayName}</strong>? Todas as mensagens serão removidas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete?.();
                setShowDeleteConfirm(false);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}, (prev, next) => {
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.onDelete !== next.onDelete) return false;
  if (prev.hasScheduledMessage !== next.hasScheduledMessage) return false;
  const a = prev.contact;
  const b = next.contact;
  return a.id === b.id &&
    a.last_message_at === b.last_message_at &&
    a.last_message_content === b.last_message_content &&
    a.last_message_is_from_me === b.last_message_is_from_me &&
    a.is_unread === b.is_unread &&
    a.unread_count === b.unread_count &&
    a.conversation_status === b.conversation_status &&
    a.conversion_status === b.conversion_status &&
    a.assigned_to === b.assigned_to &&
    a.is_private === b.is_private &&
    a.profile_picture_url === b.profile_picture_url &&
    a.channel_id === b.channel_id &&
    a.channel?.is_connected === b.channel?.is_connected &&
    a.channel?.channel_status === b.channel?.channel_status &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    prev.teamMembers === next.teamMembers &&
    prev.orgTags === next.orgTags;
});
