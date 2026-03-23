import { Clock } from "lucide-react";
import { useScheduledMessages } from "@/hooks/useScheduledMessages";
import { formatDateTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface Props {
  contactId: string;
  onClick?: () => void;
}

export function ScheduledMessageIndicator({ contactId, onClick }: Props) {
  const tz = useOrgTimezone();
  const { messages, pendingCount } = useScheduledMessages(contactId);

  if (pendingCount === 0) return null;

  const next = messages[0];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="text-xs font-medium truncate">
        {pendingCount === 1
          ? `Mensagem agendada para ${formatDateTimeInTz(next.scheduled_at, tz)}`
          : `${pendingCount} mensagens agendadas`}
      </span>
    </button>
  );
}
