import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Command, Moon, Search, Sun } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

const THEME_STORAGE_KEY = "theme";

type ThemeMode = "light" | "dark";

function getPreferredTheme(): ThemeMode {
  if (typeof document === "undefined") return "dark";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return document.documentElement.classList.contains("dark") ? "dark" : "dark";
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function AppTopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const isDark = theme === "dark";

  useEffect(() => {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;

    const fetchUnread = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) {
        console.error("Failed to fetch unread notifications:", error);
        return;
      }

      if (isMounted) {
        setUnreadCount(count ?? 0);
      }
    };

    void fetchUnread();

    const channel = supabase
      .channel(`notifications-count:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUnread();
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return "No unread notifications";
    if (unreadCount > 9) return "9 or more unread notifications";
    return `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`;
  }, [unreadCount]);

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("pec:command-palette:open"));
  };

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger className="shrink-0" />

      <button
        type="button"
        onClick={openCommandPalette}
        className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left text-xs">Search everything...</span>
        <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={() => navigate("/app/settings")}
          title={unreadLabel}
          aria-label={unreadLabel}
        >
          <Bell className="h-4 w-4" />

          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                key="notification-badge"
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
      </div>
    </header>
  );
}
