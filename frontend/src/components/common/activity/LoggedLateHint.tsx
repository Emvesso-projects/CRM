import { History } from "lucide-react";
import { formatBusinessDateTime, formatDuration } from "@/utils/businessTime";

interface LoggedLateHintProps {
  /** Minutes between happening and being logged; nothing shows when empty. */
  minutes?: number | null;
  loggedAt: string;
}

/** "Logged 8h later" for an entry recorded well after it happened. */
const LoggedLateHint = ({ minutes, loggedAt }: LoggedLateHintProps) => {
  if (!minutes) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
      title={`Logged on ${formatBusinessDateTime(loggedAt)}`}
    >
      <History className="h-3 w-3" aria-hidden="true" />
      Logged {formatDuration(minutes)} later
    </span>
  );
};

export default LoggedLateHint;
