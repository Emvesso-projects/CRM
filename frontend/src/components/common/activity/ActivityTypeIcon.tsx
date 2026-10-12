import {
  Building2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  FileText,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Sparkles,
  StickyNote,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";

const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  CALL: { icon: Phone, className: "text-blue-500" },
  IN_PERSON_MEETING: { icon: Users, className: "text-indigo-500" },
  VIRTUAL_MEETING: { icon: Video, className: "text-purple-500" },
  MEETING: { icon: Users, className: "text-purple-500" },
  EMAIL: { icon: Mail, className: "text-amber-500" },
  WHATSAPP: { icon: MessageSquare, className: "text-emerald-500" },
  TEXT: { icon: MessageCircle, className: "text-cyan-500" },
  SITE_VISIT: { icon: Building2, className: "text-orange-500" },
  NOTE: { icon: StickyNote, className: "text-slate-500" },
  FOLLOW_UP_SET: { icon: CalendarPlus, className: "text-primary" },
  FOLLOW_UP_RESCHEDULED: { icon: CalendarClock, className: "text-amber-600" },
  FOLLOW_UP_CANCELLED: { icon: CalendarX2, className: "text-red-500" },
  STAGE_CHANGE: { icon: RefreshCw, className: "text-primary" },
  STATUS_CHANGE: { icon: RefreshCw, className: "text-primary" },
  CONVERSION: { icon: Sparkles, className: "text-emerald-600" },
  QUOTATION_CREATED: { icon: FileText, className: "text-indigo-500" },
  QUOTATION_UPDATED: { icon: FileText, className: "text-indigo-500" },
};

const FALLBACK = { icon: RefreshCw, className: "text-muted-foreground" };

const ActivityTypeIcon = ({ type, className }: { type: string; className?: string }) => {
  const { icon: Icon, className: tone } = ICONS[type] ?? FALLBACK;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", tone, className)} aria-hidden="true" />;
};

export default ActivityTypeIcon;
