import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import TooltipLabel from "@/components/common/TooltipLabel";
import { cn } from "@/utils/cn";
import { useFeedUnreadCount } from "../../hooks/useNotifications";

/**
 * Bell icon linking to the notifications page.
 */
const NotificationBellLink = ({ className }: { className?: string }) => {
  const unreadCount = useFeedUnreadCount();
  const hasUnread = unreadCount > 0;

  return (
    <TooltipLabel
      label={
        hasUnread ? `Notifications (${unreadCount} unread)` : "Notifications"
      }
      side="bottom"
    >
      <Button
        asChild
        variant="outline"
        size="icon"
        className={cn(
          "relative h-10 w-10 rounded-full border border-border/70 bg-primary text-white shadow-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/40 active:scale-95",
          className,
        )}
      >
        <Link
          to={"/notifications"}
          aria-label={
            hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
        >
          <Bell className="h-5 w-5 shrink-0" />
          {hasUnread && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
                "rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </Button>
    </TooltipLabel>
  );
};

export default NotificationBellLink;
