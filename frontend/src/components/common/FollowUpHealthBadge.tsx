import type { Prospect } from "@/contracts/types";
import FollowUpDueBadge from "./activity/FollowUpDueBadge";
import StatusBadge from "./StatusBadge";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 7;

const idleDays = (prospect: Prospect) => {
  const lastTouch = new Date(prospect.updatedAt || prospect.createdAt).getTime();
  return Number.isNaN(lastTouch) ? 0 : Math.floor((Date.now() - lastTouch) / DAY_MS);
};

/** The prospect's next follow-up, judged from its due time in the business timezone. */
export const FollowUpHealthBadge = ({ prospect }: { prospect: Prospect }) => {
  if (prospect.isTerminal) {
    return <StatusBadge status="CLOSED" label="Closed" type="inactive" />;
  }

  const followUp = prospect.activeFollowUp;
  if (followUp?.dueAt) {
    return <FollowUpDueBadge dueAt={followUp.dueAt} />;
  }

  const days = idleDays(prospect);
  if (days >= STALE_AFTER_DAYS) {
    return <StatusBadge status="STALE" label={`No follow-up · idle ${days}d`} type="warning" />;
  }
  return <StatusBadge status="NONE" label="No follow-up" type="inactive" />;
};

export default FollowUpHealthBadge;
