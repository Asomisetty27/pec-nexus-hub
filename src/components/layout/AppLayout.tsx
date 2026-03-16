import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";
import { CommandPalette } from "@/components/CommandPalette";
import { motion } from "framer-motion";

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background bg-grid-animate">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary glow-primary">
            <span className="font-display text-2xl font-bold text-primary-foreground">P</span>
          </div>
          <div className="h-1 w-32 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Loading Nexus</p>
        </motion.div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopBar />
          <main className="flex-1 overflow-auto p-4 sm:p-6 bg-grid-animate relative">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
