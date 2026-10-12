import { useNow } from "@/hooks/useNow";
import { describeDue } from "@/utils/businessTime";
import StatusBadge from "../StatusBadge";

/** "Overdue 8h" / "Due in 40m" / "Tomorrow, 10:00 AM", kept current while the page is open. */
const FollowUpDueBadge = ({ dueAt, className }: { dueAt: string; className?: string }) => {
  const now = useNow();
  const { state, label } = describeDue(dueAt, now);
  return (
    <StatusBadge
      status={state}
      label={label}
      type={state === "OVERDUE" ? "error" : state === "DUE_TODAY" ? "warning" : "success"}
      className={className}
    />
  );
};

export default FollowUpDueBadge;
