import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { isApplicantAllowed, parkedReason } from "@/lib/roleHQ";
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
  const { user, loading, highestRole, signOut } = useAuth();
  const location = useLocation();

  // Microsoft SSO can be registered multi-tenant, which would let any org account
  // in. PEC is Cal Poly only: reject an OAuth sign-in whose email isn't @calpoly.edu.
  // Password accounts are already gated at signup, so this only affects SSO users.
  const provider = user?.app_metadata?.provider;
  const isOauth = !!provider && provider !== "email";
  const nonCalPolyOauth = isOauth && !(user?.email ?? "").toLowerCase().endsWith("@calpoly.edu");
  useEffect(() => {
    if (nonCalPolyOauth) {
      toast.error("Please sign in with your Cal Poly (@calpoly.edu) Microsoft account.");
      void signOut();
    }
  }, [nonCalPolyOauth, signOut]);

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }

  // Applicants only have a handful of pages; keep them out of member routes
  // entirely rather than showing an empty member page they can't use.
  if (highestRole === "applicant" && !isApplicantAllowed(location.pathname)) {
    return <Navigate to="/app" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopBar />

          <main id="app-main-content" className="relative flex-1 overflow-auto bg-grid-animate p-4 sm:p-6">
            {parkedReason(location.pathname) && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border border-warning bg-warning/10 px-4 py-3">
                <p className="text-sm">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-warning">
                    off-season&ensp;
                  </span>
                  This module is parked for the year-one relaunch: {parkedReason(location.pathname)}.
                </p>
                <Link to="/app" className="text-sm font-medium underline underline-offset-4 hover:text-warning">
                  Back to your HQ
                </Link>
              </div>
            )}
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
