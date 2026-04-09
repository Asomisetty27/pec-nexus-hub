import { Navigate, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

import { useAuth } from "@/lib/auth";
import { CommandPalette } from "@/components/CommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";

function AppLoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background bg-grid-animate"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-5"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg glow-primary">
          <span className="font-display text-2xl font-bold text-primary-foreground">P</span>
        </div>

        <div className="h-1 w-32 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              duration: 1.25,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "loop",
            }}
          />
        </div>

        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Loading Nexus</p>

        <span className="sr-only">Loading application</span>
      </motion.div>
    </div>
  );
}

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />

          <main id="app-main-content" className="relative flex-1 overflow-auto bg-grid-animate p-4 sm:p-6">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="min-w-0"
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
