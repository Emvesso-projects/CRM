import { useState, useEffect } from "react";
import {
  Bell,
  ChevronUp,
  HelpCircle,
  LogOut,
  MoreHorizontal,
  Settings,
  UserCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TooltipLabel from "@/components/common/TooltipLabel";
import {
  PLATFORM_SETTINGS_ROUTE_ROLES,
  SETTINGS_ROUTE_ROLES,
  type UserRole,
} from "@/constants/roles";
import type { AuthUser } from "@/contracts/types";
import { useAppDispatch } from "@/hooks/useRedux";
import { logout } from "@/features/auth";
import { useFeedUnreadCount } from "@/features/notifications";
import { resolveAssetUrl } from "@/utils/assetUrl";

interface SidebarFooterProps {
  isCollapsed?: boolean;
  onNavigate: () => void;
  user: AuthUser;
}

const formatRole = (role: string) =>
  role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getUserName = (user: AuthUser) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.email;
};

const getInitials = (user: AuthUser) => {
  const source = getUserName(user);
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const SidebarFooter = ({
  isCollapsed = false,
  onNavigate,
  user,
}: SidebarFooterProps) => {
  const dispatch = useAppDispatch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const unreadCount = useFeedUnreadCount();
  const hasUnread = unreadCount > 0;

  const profileImageUrl = resolveAssetUrl(user.profileImage);
  const userName = getUserName(user);
  const userRole = formatRole(user.role);
  const initials = getInitials(user);

  useEffect(() => {
    setImageError(false);
  }, [user.profileImage]);

  /**
   * "Settings" means different things by role: an organization's own
   * preferences for an admin, installation-wide configuration for a
   * super-admin. One menu entry, two destinations — and hidden for roles that
   * have neither.
   */
  const isPlatformOperator = (
    PLATFORM_SETTINGS_ROUTE_ROLES as readonly UserRole[]
  ).includes(user.role as UserRole);
  const canOpenTenantSettings = (
    SETTINGS_ROUTE_ROLES as readonly UserRole[]
  ).includes(user.role as UserRole);

  const canOpenSettings = isPlatformOperator || canOpenTenantSettings;
  const settingsHref = isPlatformOperator
    ? "/platform/settings"
    : "/settings";

  const handleNavigate = () => {
    setIsMenuOpen(false);
    onNavigate();
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    onNavigate();
    void dispatch(logout());
  };

  return (
    <div
      className={`
        shrink-0 border-t border-sidebar-border px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1 transition-[padding] duration-200 ease-out motion-reduce:transition-none lg:pb-4
        ${isCollapsed ? "lg:px-2" : "lg:px-3"}
      `}
    >
      {isCollapsed ? (
        /* Collapsed Sidebar Rail */
        <div className="flex flex-col items-center gap-2">
          {/* User Profile Avatar Dropdown */}
          <DropdownMenu modal={false} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <TooltipLabel label={`${userName} (${userRole})`} side="right">
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open user menu"
                  aria-expanded={isMenuOpen}
                  className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 cursor-pointer"
                >
                  {profileImageUrl && !imageError ? (
                    <img
                      src={profileImageUrl}
                      alt={userName}
                      onError={() => setImageError(true)}
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                      {initials || <UserCircle className="h-4 w-4" />}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/70 shadow-xs"
                  >
                    <MoreHorizontal className="h-2.5 w-2.5" />
                  </span>
                </button>
              </DropdownMenuTrigger>
            </TooltipLabel>

            <DropdownMenuContent
              align="end"
              side="right"
              sideOffset={10}
              className="w-52 border-sidebar-border bg-popover p-1.5 shadow-xl"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  to="/profile"
                  onClick={handleNavigate}
                >
                  <UserCircle className="h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              {canOpenSettings ? (
                <DropdownMenuItem asChild>
                  <Link
                    className="cursor-pointer"
                    to={settingsHref}
                    onClick={handleNavigate}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link
                  className="cursor-pointer"
                  to="/help"
                  onClick={handleNavigate}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Help</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                variant="destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Button */}
          <TooltipLabel
            label={
              hasUnread ? `Notifications (${unreadCount} unread)` : "Notifications"
            }
            side="right"
          >
            <Link
              to="/notifications"
              onClick={handleNavigate}
              aria-label={
                hasUnread
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 outline-none cursor-pointer"
            >
              <Bell className="h-5 w-5 shrink-0" />
              {hasUnread && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-destructive"
                />
              )}
            </Link>
          </TooltipLabel>
        </div>
      ) : (
        /* Expanded 2-Column Sidebar Layout */
        <div className="flex items-center justify-between gap-1.5">
          {/* Column 1 (Left): User Name & Role */}
          <div className="min-w-0 flex-1">
            <DropdownMenu modal={false} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open user menu"
                  aria-expanded={isMenuOpen}
                  className="group flex min-h-13 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 cursor-pointer"
                >
                  {profileImageUrl && !imageError ? (
                    <img
                      src={profileImageUrl}
                      alt={userName}
                      onError={() => setImageError(true)}
                      className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
                      {initials || <UserCircle className="h-4 w-4" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-xs font-bold leading-tight">
                      {userName}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-sidebar-foreground/60 leading-tight">
                      {userRole}
                    </span>
                  </span>
                  <ChevronUp
                    className={`h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 transition-transform duration-200 group-hover:text-sidebar-foreground ${
                      isMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-52 border-sidebar-border bg-popover p-1.5 shadow-xl"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DropdownMenuItem asChild>
                  <Link
                    className="cursor-pointer"
                    to="/profile"
                    onClick={handleNavigate}
                  >
                    <UserCircle className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                {canOpenSettings ? (
                  <DropdownMenuItem asChild>
                    <Link
                      className="cursor-pointer"
                      to={settingsHref}
                      onClick={handleNavigate}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link
                    className="cursor-pointer"
                    to="/help"
                    onClick={handleNavigate}
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span>Help</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  variant="destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Column 2 (Right): Notification Icon */}
          <div className="shrink-0">
            <TooltipLabel
              label={
                hasUnread ? `Notifications (${unreadCount} unread)` : "Notifications"
              }
              side="top"
            >
              <Link
                to="/notifications"
                onClick={handleNavigate}
                aria-label={
                  hasUnread
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
                className="relative flex bg-secondary  h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 outline-none cursor-pointer"
              >
                <Bell className="h-4 w-4  shrink-0" />
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white shadow-xs">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </TooltipLabel>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarFooter;
