import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, AlertTriangle, MessageSquare, FileOutput, Calendar, Megaphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type NotificationRow } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const ICONS: Record<string, any> = {
  mention: MessageSquare,
  assignment: FileOutput,
  review_requested: FileOutput,
  review_approved: CheckCheck,
  revision_requested: AlertTriangle,
  review_rejected: AlertTriangle,
  event_created: Calendar,
  event_updated: Calendar,
  event_cancelled: Calendar,
  announcement: Megaphone,
  escalation: Zap,
};

function NotifRow({ n, onClick }: { n: NotificationRow; onClick: () => void }) {
  const Icon = ICONS[n.category] || Bell;
  const isHigh = n.priority === "high" || n.escalated;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md p-2.5 transition-colors hover:bg-muted/50 flex gap-2.5 ${
        !n.read ? "bg-primary/5" : ""
      }`}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
        isHigh ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-xs truncate ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
        </div>
        {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
        <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unreadCount, markRead } = useNotifications(30);

  const handleClick = async (n: NotificationRow) => {
    if (!n.read) await markRead([n.id]);
    if (n.link) navigate(n.link);
  };

  const label = unreadCount === 0 ? "No unread notifications" : `${unreadCount} unread`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          title={label}
          aria-label={label}
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.75, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute -right-0.5 -top-0.5"
              >
                <Badge className="flex h-4 min-w-4 items-center justify-center p-0 font-mono text-[9px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">Inbox</h3>
            <p className="text-[10px] text-muted-foreground">{unreadCount} unread · {items.length} total</p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => markRead()}>
                <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => navigate("/app/settings#notifications")}>
              Preferences
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[420px]">
          <div className="p-1.5 space-y-0.5">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Mentions, reviews, and assignments will appear here</p>
              </div>
            ) : (
              items.map(n => <NotifRow key={n.id} n={n} onClick={() => handleClick(n)} />)
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
