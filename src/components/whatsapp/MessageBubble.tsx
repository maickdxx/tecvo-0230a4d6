import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatWhatsAppMessage } from "@/lib/whatsappUtils";
import { format } from "date-fns";
import {
  Check,
  CheckCheck,
  Clock,
  Play,
  Pause,
  Download,
  FileText,
  Image as ImageIcon,
  Video,
  Mic,
  MoreVertical,
  Copy,
  Trash2,
  Pencil,
  X,
  Ban,
  SmilePlus,
  ZoomIn,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Reply,
  User,
  MessageSquare,
  Phone,
  MapPin,
  Sticker,
  ExternalLink,
} from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Distinct colors for group sender names (text + bg pairs)
const SENDER_COLORS: { text: string; bg: string }[] = [
  { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40" },
  { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  { text: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/40" },
  { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40" },
  { text: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-900/40" },
  { text: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/40" },
  { text: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
  { text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/40" },
];

function getSenderHash(senderName: string): number {
  let hash = 0;
  for (let i = 0; i < senderName.length; i++) {
    hash = senderName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % SENDER_COLORS.length;
}

function getSenderColor(senderName: string): string {
  return SENDER_COLORS[getSenderHash(senderName)].text;
}

function getSenderBg(senderName: string): string {
  return SENDER_COLORS[getSenderHash(senderName)].bg;
}

function getSenderInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

interface MessageBubbleProps {
  message: any;
  isGroup?: boolean;
  channelOwnerPhone?: string | null;
  onDelete?: (messageId: string, mode?: "all" | "local") => Promise<boolean>;
  onEdit?: (messageId: string, newText: string) => Promise<boolean>;
  onReact?: (messageId: string, emoji: string) => Promise<boolean>;
  onRetry?: () => void;
  onAIReply?: (message: any) => void;
  onReply?: (message: any) => void;
  onScrollToMessage?: (messageId: string) => void;
}


/* ─── Image Lightbox ─── */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="h-5 w-5 text-white" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/* ─── Shared Contact Card ─── */
function SharedContactCard({ content, isMe }: { content: string; isMe: boolean }) {
  // Parse contact(s) from content: "Name||Phone" or multiple separated by ";;"
  const entries = content.split(";;").map((entry) => {
    const parts = entry.split("||");
    return { name: parts[0] || "Contato", phone: parts[1] || "" };
  });

  const handleChat = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits) {
      window.open(`/whatsapp?phone=${digits}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg border p-3 space-y-2",
            isMe
              ? "border-primary-foreground/20 bg-primary-foreground/10"
              : "border-border bg-muted/50"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center",
              isMe ? "bg-primary-foreground/20" : "bg-primary/10"
            )}>
              <User className={cn("h-4 w-4", isMe ? "text-primary-foreground" : "text-primary")} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium truncate", isMe ? "text-primary-foreground" : "text-foreground")}>
                {entry.name}
              </p>
              {entry.phone && (
                <p className={cn("text-xs truncate", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  <Phone className="h-3 w-3 inline mr-1" />
                  {entry.phone}
                </p>
              )}
            </div>
          </div>
          {entry.phone && (
            <button
              onClick={() => handleChat(entry.phone)}
              className={cn(
                "w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors",
                isMe
                  ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
                  : "bg-primary/10 hover:bg-primary/20 text-primary"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Conversar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Main Component ─── */
export function MessageBubble({ message, isGroup, channelOwnerPhone, onDelete, onEdit, onReact, onRetry, onAIReply, onReply, onScrollToMessage }: MessageBubbleProps) {
  // In groups, also detect "me" by comparing sender_phone with channel owner phone
  // Normalize: strip non-digits and compare last 10+ digits to handle country code differences
  const isMe = message.is_from_me || !!(
    isGroup && channelOwnerPhone && message.sender_phone && (() => {
      const ownerDigits = channelOwnerPhone.replace(/\D/g, "");
      const senderDigits = message.sender_phone.replace(/\D/g, "");
      if (ownerDigits === senderDigits) return true;
      // Compare last 10 digits (handles +55 vs without)
      const minLen = Math.min(ownerDigits.length, senderDigits.length, 10);
      return minLen >= 8 && ownerDigits.slice(-minLen) === senderDigits.slice(-minLen);
    })()
  );
  const time = message.created_at ? format(new Date(message.created_at), "HH:mm") : "";
  const [showLightbox, setShowLightbox] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isDeleted = message.status === "deleted" || message.status === "deleted_local";
  const isEdited = message.status === "edited";
  const hasMedia = !!message.media_url;
  const mediaType = message.media_type;
  const [deleteMode, setDeleteMode] = useState<"all" | "local" | null>(null);

  // Check if message is within 15 min edit window
  const canEdit = isMe && !isDeleted && !hasMedia && message.content && (() => {
    const sentAt = new Date(message.created_at).getTime();
    return Date.now() - sentAt < 15 * 60 * 1000;
  })();

  const canDelete = isMe && !isDeleted;

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success("Texto copiado");
    }
  };

  const handleDelete = async (mode: "all" | "local") => {
    if (onDelete) {
      const success = await onDelete(message.id, mode);
      if (success) {
        setConfirmDelete(false);
        setDeleteMode(null);
      }
    }
  };

  const handleEdit = async () => {
    const cleanOriginal = (message.content || "").replace(/^\*[^*]+:\*\s*\n?/, "");
    if (onEdit && editText.trim() && editText.trim() !== cleanOriginal) {
      const success = await onEdit(message.id, editText.trim());
      if (success) setEditing(false);
    } else {
      setEditing(false);
    }
  };

  // Deleted message
  if (isDeleted) {
    return (
      <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
        {isGroup && !isMe && <div className="w-7 flex-shrink-0 mr-1.5" />}
        <div className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm border border-dashed",
          isMe ? "rounded-br-sm border-primary/20 bg-primary/5" : "rounded-bl-sm border-border/40 bg-muted/30"
        )}>
          <p className="flex items-center gap-1.5 text-muted-foreground/60 italic text-xs">
            <Ban className="h-3 w-3" />
            Mensagem apagada
          </p>
          <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
            <span className="text-[10px] text-muted-foreground/40">{time}</span>
          </div>
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    const cleanContent = (message.content || "").replace(/^\*[^*]+:\*\s*\n?/, "");
    setEditing(true);
    setEditText(cleanContent);
  };

  /** Shared menu items rendered as either DropdownMenuItem or ContextMenuItem */
  const renderMenuItems = (Item: typeof DropdownMenuItem, Separator: typeof DropdownMenuSeparator, closeMenu?: () => void) => (
    <>
      {onReply && (
        <Item onClick={() => { onReply(message); closeMenu?.(); }}>
          <Reply className="h-3.5 w-3.5 mr-2" />
          Responder mensagem
        </Item>
      )}
      {message.content && (
        <Item onClick={() => { handleCopy(); closeMenu?.(); }}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copiar texto
        </Item>
      )}
      {onReact && (
        <Item onClick={() => { setShowReactionPicker(true); closeMenu?.(); }}>
          <SmilePlus className="h-3.5 w-3.5 mr-2" />
          Reagir
        </Item>
      )}
      {!isMe && onAIReply && message.content && (
        <Item onClick={() => { onAIReply(message); closeMenu?.(); }}>
          <Sparkles className="h-3.5 w-3.5 mr-2" />
          Responder com IA
        </Item>
      )}
      {hasMedia && message.media_url && (
        <Item asChild>
          <a href={message.media_url} target="_blank" rel="noopener noreferrer" download>
            <Download className="h-3.5 w-3.5 mr-2" />
            Baixar arquivo
          </a>
        </Item>
      )}
      {canEdit && onEdit && (
        <>
          <Separator />
          <Item onClick={() => { handleStartEdit(); closeMenu?.(); }}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar mensagem
          </Item>
        </>
      )}
      {canDelete && onDelete && (
        <>
          <Separator />
          <Item
            onClick={() => { setDeleteMode("all"); setConfirmDelete(true); closeMenu?.(); }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Apagar para todos
          </Item>
          <Item
            onClick={() => { setDeleteMode("local"); setConfirmDelete(true); closeMenu?.(); }}
            className="text-destructive/70 focus:text-destructive"
          >
            <Ban className="h-3.5 w-3.5 mr-2" />
            Apagar só da plataforma
          </Item>
        </>
      )}
    </>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className={cn("flex group", isMe ? "justify-end" : "justify-start")}>
            {/* Group avatar for non-own messages */}
            {isGroup && !isMe && message.sender_name && (
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-auto mb-1 mr-1.5 text-[10px] font-bold select-none",
                getSenderBg(message.sender_name),
                getSenderColor(message.sender_name)
              )}>
                {getSenderInitials(message.sender_name)}
              </div>
            )}
            {/* Spacer for group messages without sender_name */}
            {isGroup && !isMe && !message.sender_name && (
              <div className="w-7 flex-shrink-0 mr-1.5" />
            )}
            <div className="relative max-w-[75%]">
              {/* Action menu - visible on hover */}
              <div className={cn(
                "absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                isMe ? "-left-8" : "-right-8"
              )}>
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button className="h-6 w-6 rounded-full bg-background/80 border border-border/40 shadow-sm flex items-center justify-center hover:bg-muted transition-colors">
                      <MoreVertical className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isMe ? "start" : "end"} className="w-44">
                    {renderMenuItems(DropdownMenuItem, DropdownMenuSeparator, () => setMenuOpen(false))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

          {/* Bubble */}
          <div
            className={cn(
              "rounded-2xl overflow-hidden transition-all duration-200",
              isMe
                ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                : "bg-card text-foreground rounded-bl-sm border border-border/50 shadow-sm",
              message.status === "failed" && "opacity-70",
              message.status === "pending" && "opacity-80"
            )}
          >
            {/* Group sender name */}
            {isGroup && !isMe && message.sender_name && (
              <div className="px-3.5 pt-2 pb-0.5">
                <p className={cn(
                  "text-[11px] font-bold truncate",
                  getSenderColor(message.sender_name)
                )}>
                  {message.sender_name}
                </p>
              </div>
            )}
            {/* Quoted reply block */}
            {message.reply_to_content && (
              <button
                onClick={() => message.reply_to_id && onScrollToMessage?.(message.reply_to_id)}
                className={cn(
                  "w-full text-left px-3 py-2 border-l-[3px] rounded-t-2xl cursor-pointer transition-colors",
                  isMe
                    ? "bg-primary-foreground/10 border-blue-300 hover:bg-primary-foreground/15"
                    : "bg-muted/50 border-primary/60 hover:bg-muted/70"
                )}
              >
                <p className={cn(
                  "text-[11px] font-semibold truncate",
                  isMe ? "text-blue-200" : "text-primary"
                )}>
                  {message.reply_to_sender || "Mensagem"}
                </p>
                <p className={cn(
                  "text-[11px] truncate leading-snug mt-0.5",
                  isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  {message.reply_to_content.length > 120
                    ? message.reply_to_content.substring(0, 120) + "…"
                    : message.reply_to_content}
                </p>
              </button>
            )}
            {/* Image */}
            {mediaType === "image" && message.media_url && (
              <button
                onClick={() => setShowLightbox(true)}
                className="block relative group/img w-full"
              >
                <img
                  src={message.media_url}
                  alt=""
                  className="max-w-[280px] w-full max-h-[200px] rounded-t-2xl object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-70 transition-opacity" />
                </div>
              </button>
            )}

            {/* Video */}
            {mediaType === "video" && message.media_url && (
              <div className="max-w-[280px] w-full">
                <video
                  src={message.media_url}
                  controls
                  className="w-full rounded-t-2xl max-h-[200px] object-contain bg-black"
                  preload="metadata"
                  playsInline
                />
              </div>
            )}

            {/* Sticker */}
            {mediaType === "sticker" && message.media_url && (
              <div className="p-2">
                <img
                  src={message.media_url}
                  alt="Sticker"
                  className="max-w-[160px] max-h-[160px] object-contain"
                  loading="lazy"
                />
              </div>
            )}

            {/* Location */}
            {mediaType === "location" && (
              <a
                href={(() => {
                  // Try to extract coordinates from content
                  const coordMatch = message.content?.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
                  if (coordMatch) return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`;
                  // Fallback: search by content text
                  return `https://maps.google.com/maps?q=${encodeURIComponent(message.content || "Localização")}`;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  isMe
                    ? "bg-primary-foreground/10 hover:bg-primary-foreground/15"
                    : "bg-muted/50 hover:bg-muted/80"
                )}>
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    isMe ? "bg-primary-foreground/20" : "bg-red-100 dark:bg-red-900/30"
                  )}>
                    <MapPin className={cn("h-5 w-5", isMe ? "text-primary-foreground" : "text-red-600 dark:text-red-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-medium truncate",
                      isMe ? "text-primary-foreground" : "text-foreground"
                    )}>
                      {message.content || "Localização compartilhada"}
                    </p>
                    <p className={cn(
                      "text-[10px] flex items-center gap-1",
                      isMe ? "text-primary-foreground/50" : "text-muted-foreground"
                    )}>
                      <ExternalLink className="h-3 w-3" />
                      Abrir no Google Maps
                    </p>
                  </div>
                </div>
              </a>
            )}

            {/* Content area */}
            <div className="px-3.5 py-2">
              {/* Audio */}
              {mediaType === "audio" && message.media_url && (
                <AudioPlayer src={message.media_url} isMe={isMe} messageId={message.id} />
              )}

              {/* Document */}
              {mediaType === "document" && message.media_url && (() => {
                // If content is long (body text with document), show text separately
                const isBodyText = (message.content?.length || 0) > 60;
                const fileName = isBodyText
                  ? (message.media_url.split("/").pop()?.split("?")[0] || "Documento")
                  : (message.content || "Documento");
                return (
                  <a
                    href={message.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-lg transition-colors mb-1",
                      isMe
                        ? "bg-primary-foreground/10 hover:bg-primary-foreground/15"
                        : "bg-muted/50 hover:bg-muted/80"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      isMe ? "bg-primary-foreground/20" : "bg-primary/10"
                    )}>
                      <FileText className={cn("h-5 w-5", isMe ? "text-primary-foreground" : "text-primary")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium truncate",
                        isMe ? "text-primary-foreground" : "text-foreground"
                      )}>
                        {fileName}
                      </p>
                      <p className={cn(
                        "text-[10px]",
                        isMe ? "text-primary-foreground/50" : "text-muted-foreground"
                      )}>
                        Toque para abrir
                      </p>
                    </div>
                    <Download className={cn(
                      "h-4 w-4 shrink-0",
                      isMe ? "text-primary-foreground/50" : "text-muted-foreground"
                    )} />
                  </a>
                );
              })()}

              {/* Media placeholder for unsupported/missing URL */}
              {mediaType && !message.media_url && !message.content && (
                <p className="italic opacity-70 text-xs flex items-center gap-1">
                  {mediaType === "image" && <><ImageIcon className="h-3 w-3" /> Imagem</>}
                  {mediaType === "audio" && <><Mic className="h-3 w-3" /> Áudio</>}
                  {mediaType === "video" && <><Video className="h-3 w-3" /> Vídeo</>}
                  {mediaType === "document" && <><FileText className="h-3 w-3" /> Arquivo</>}
                  {mediaType === "sticker" && <><Sticker className="h-3 w-3" /> Figurinha</>}
                  {mediaType === "location" && <><MapPin className="h-3 w-3" /> Localização</>}
                </p>
              )}

              {/* Shared contact card */}
              {mediaType === "contact" && message.content && (
                <SharedContactCard content={message.content} isMe={isMe} />
              )}

              {/* Text content (skip for documents and contacts since we show custom UI above) */}
              {message.content && mediaType !== "contact" && mediaType !== "location" && mediaType !== "sticker" && !(mediaType === "document" && (message.content?.length || 0) <= 60) && !editing && (
                <p
                  className="whitespace-pre-wrap break-words text-sm leading-relaxed [&_strong]:font-bold [&_em]:italic [&_s]:line-through"
                  dangerouslySetInnerHTML={{
                    __html: formatWhatsAppMessage(message.content, isMe),
                  }}
                />
              )}

              {/* Edit mode */}
              {editing && (
                <div className="space-y-2 min-w-[200px]">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-sm bg-background text-foreground min-h-[60px] max-h-[200px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                      if (e.key === "Escape") setEditing(false);
                    }}
                    autoFocus
                    rows={Math.min(5, Math.max(2, (editText.match(/\n/g) || []).length + 1))}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={() => setEditing(false)}>
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                    <Button size="sm" className="h-7 text-xs px-3" onClick={handleEdit}>
                      <Check className="h-3 w-3 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* Footer: time + status */}
              {!editing && (
                <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                  {isEdited && (
                    <span className={cn("text-[10px] italic", isMe ? "text-primary-foreground/40" : "text-muted-foreground/40")}>
                      editada
                    </span>
                  )}
                  {message.status === "failed" && (
                    <button
                      onClick={onRetry}
                      className="flex items-center gap-1 text-[10px] text-destructive hover:underline"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Falha
                      {onRetry && <RotateCcw className="h-2.5 w-2.5 ml-0.5" />}
                    </button>
                  )}
                  <span className={cn("text-[10px]", isMe ? "text-primary-foreground/60" : "text-muted-foreground/60")}>
                    {time}
                  </span>
                  {isMe && message.status !== "failed" && (
                    message.status === "pending" ? (
                      <Clock className={cn("h-3 w-3 animate-pulse", "text-primary-foreground/50")} />
                    ) : message.status === "read" ? (
                      <CheckCheck className="h-3 w-3 text-blue-300" />
                    ) : message.status === "delivered" ? (
                      <CheckCheck className={cn("h-3 w-3", "text-primary-foreground/50")} />
                    ) : (
                      <Check className={cn("h-3 w-3", "text-primary-foreground/50")} />
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reactions display */}
          {Array.isArray(message.reactions) && message.reactions.length > 0 && (
            <div className={cn("flex gap-0.5 mt-0.5", isMe ? "justify-end" : "justify-start")}>
              {message.reactions.map((r: any, idx: number) => (
                <span
                  key={idx}
                  title={r.name || r.jid}
                  className="text-sm bg-muted/80 border border-border/40 rounded-full px-1.5 py-0.5 cursor-default hover:scale-110 transition-transform"
                >
                  {r.emoji}
                </span>
              ))}
            </div>
          )}

          {/* Reaction picker */}
          {showReactionPicker && onReact && (
            <div className={cn(
              "flex gap-1 mt-1 p-1.5 bg-background border border-border rounded-full shadow-lg animate-in fade-in zoom-in-95 duration-150",
              isMe ? "justify-end" : "justify-start"
            )}>
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(message.id, emoji);
                    setShowReactionPicker(false);
                  }}
                  className="text-lg hover:scale-125 transition-transform px-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-44">
      {renderMenuItems(ContextMenuItem, ContextMenuSeparator)}
    </ContextMenuContent>
  </ContextMenu>

      {/* Image Lightbox */}
      {showLightbox && message.media_url && (
        <ImageLightbox src={message.media_url} onClose={() => setShowLightbox(false)} />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
      <AlertDialog open={confirmDelete} onOpenChange={(open) => { setConfirmDelete(open); if (!open) setDeleteMode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === "local" ? "Apagar da plataforma?" : "Apagar para todos?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "local"
                ? "A mensagem será ocultada apenas na Tecvo. O destinatário ainda verá no WhatsApp."
                : "Esta ação apagará a mensagem no WhatsApp para todos. Não é possível desfazer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteMode || "all")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMode === "local" ? "Apagar da plataforma" : "Apagar para todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}
    </>
  );
}
