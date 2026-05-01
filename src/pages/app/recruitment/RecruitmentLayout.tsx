import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { loadRecruitmentAccess, type RecruitmentAccess } from "@/lib/recruitment";
import { Loader2, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecruitmentCtx = {
  access: RecruitmentAccess;
  userId: string;
};

export default function RecruitmentLayout() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [access, setAccess] = useState<RecruitmentAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAccess({ canSeeRecruitment: false, isLead: false }); return; }
    (async () => {
      const a = await loadRecruitmentAccess(user.id, isAdmin);
      if (!cancelled) setAccess(a);
    })();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  const tabs = useMemo(() => [
    { to: "/app/recruitment", label: "Overview", end: true },
    { to: "/app/recruitment/inbox", label: "Inbox" },
    { to: "/app/recruitment/pipeline", label: "Pipeline" },
    ...(access?.isLead ? [{ to: "/app/recruitment/leadership", label: "Leadership" }] : []),
    { to: "/app/recruitment/talent", label: "Talent" },
  ], [access?.isLead]);

  if (!access) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading recruitment workspace…
      </div>
    );
  }

  if (!access.canSeeRecruitment) {
    return (
      <div className="container max-w-md py-20 text-center">
        <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 font-display text-xl font-semibold">Recruitment workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have access to the recruitment workflow.
        </p>
      </div>
    );
  }

  const ctx: RecruitmentCtx = { access, userId: user!.id };

  return (
    <div className="container max-w-7xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Recruitment</h1>
          <p className="text-xs text-muted-foreground">
            {access.isLead ? "Recruitment leadership" : "Cohort reviewer"}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={ctx} />
    </div>
  );
}