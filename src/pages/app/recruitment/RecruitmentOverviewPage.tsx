import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, AlertTriangle, Hourglass, Clock, CalendarRange, Layers } from "lucide-react";
import type { RecruitmentCtx } from "./RecruitmentLayout";
import { ApplicantCard, type ApplicantCardData } from "@/components/recruitment/ApplicantCard";

type Cycle = {
  id: string;
  season: string;
  year: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
};

export default function RecruitmentOverviewPage() {
  const ctx = useOutletContext<RecruitmentCtx>();
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [assignedToMe, setAssignedToMe] = useState<ApplicantCardData[]>([]);
  const [needsRouting, setNeedsRouting] = useState<ApplicantCardData[]>([]);
  const [decisionPending, setDecisionPending] = useState<ApplicantCardData[]>([]);
  const [recent, setRecent] = useState<ApplicantCardData[]>([]);
  const [poolCount, setPoolCount] = useState<number>(0);

  useEffect(() => {
    document.title = "Recruitment | PEC";
    (async () => {
      try {
        const { data: cycleData } = await supabase
          .from("application_cycles")
          .select("*")
          .eq("is_active", true)
          .order("opens_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setCycle(cycleData as any);

        const select =
          "id,full_name,email,major,current_stage,routing_resolved,primary_reviewer_user_id,routed_cohort_id,submitted_at,created_at";

        const [a1, a2, a3, a4, poolRes] = await Promise.all([
          supabase.from("applicants").select(select)
            .eq("primary_reviewer_user_id", ctx.userId)
            .not("current_stage", "in", "(accepted,rejected,withdrawn)")
            .order("created_at", { ascending: false }).limit(20),
          ctx.access.isLead
            ? supabase.from("applicants").select(select)
                .eq("routing_resolved", false)
                .order("created_at", { ascending: false }).limit(20)
            : Promise.resolve({ data: [] as any[], error: null } as any),
          supabase.from("applicants").select(select)
            .eq("current_stage", "decision_pending")
            .order("created_at", { ascending: false }).limit(20),
          supabase.from("applicants").select(select)
            .in("current_stage", ["applied", "under_review", "resume_screen", "interview", "decision_pending"])
            .order("created_at", { ascending: false }).limit(10),
          ctx.access.isLead
            ? supabase.from("applicants").select("id", { count: "exact", head: true })
                .eq("current_stage", "pre_cycle_pool")
                .is("archived_at", null)
            : Promise.resolve({ count: 0 } as any),
        ]);

        setAssignedToMe(((a1 as any).data ?? []) as ApplicantCardData[]);
        setNeedsRouting(((a2 as any).data ?? []) as ApplicantCardData[]);
        setDecisionPending(((a3 as any).data ?? []) as ApplicantCardData[]);
        setRecent(((a4 as any).data ?? []) as ApplicantCardData[]);
        setPoolCount(((poolRes as any).count ?? 0) as number);
      } finally {
        setLoading(false);
      }
    })();
  }, [ctx.userId, ctx.access.isLead]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const now = new Date();
  const cycleOpen = !!cycle && new Date(cycle.opens_at) <= now && new Date(cycle.closes_at) >= now;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <CalendarRange className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">
                {cycle ? `${cycle.season[0].toUpperCase()}${cycle.season.slice(1)} ${cycle.year}` : "No active cycle"}
              </div>
              <div className="text-xs text-muted-foreground">
                {cycle
                  ? `${new Date(cycle.opens_at).toLocaleDateString()} → ${new Date(cycle.closes_at).toLocaleDateString()}`
                  : "Recruitment leads can activate a cycle from the admin console."}
              </div>
            </div>
          </div>
          {cycle && (cycleOpen
            ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Open</Badge>
            : <Badge variant="outline">Out of window</Badge>)}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {ctx.access.isLead && (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-cyan-600" />
                <div>
                  <div className="text-sm font-medium">Pre-cycle pool</div>
                  <div className="text-xs text-muted-foreground">
                    Applications collected outside an active cycle. Review begins when promoted.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono">{poolCount}</Badge>
                <Link to="/app/recruitment/leadership" className="text-xs text-primary hover:underline">Manage →</Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4" /> Assigned to me
              <Badge variant="secondary" className="ml-auto">{assignedToMe.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignedToMe.length === 0
              ? <p className="text-xs text-muted-foreground">Nothing waiting on you.</p>
              : assignedToMe.slice(0, 6).map((a) => <ApplicantCard key={a.id} applicant={a} highlight />)}
            {assignedToMe.length > 6 && (
              <Link to="/app/recruitment/inbox?view=mine" className="text-xs text-primary hover:underline">View all →</Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hourglass className="h-4 w-4" /> Decision pending
              <Badge variant="secondary" className="ml-auto">{decisionPending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {decisionPending.length === 0
              ? <p className="text-xs text-muted-foreground">No applicants awaiting final decision.</p>
              : decisionPending.slice(0, 6).map((a) => <ApplicantCard key={a.id} applicant={a} />)}
          </CardContent>
        </Card>

        {ctx.access.isLead && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs routing
                <Badge variant="secondary" className="ml-auto">{needsRouting.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {needsRouting.length === 0
                ? <p className="text-xs text-muted-foreground">All applicants are routed to a cohort.</p>
                : needsRouting.slice(0, 6).map((a) => <ApplicantCard key={a.id} applicant={a} />)}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" /> Recently submitted
              <Badge variant="secondary" className="ml-auto">{recent.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0
              ? <p className="text-xs text-muted-foreground">No applicants visible.</p>
              : recent.map((a) => <ApplicantCard key={a.id} applicant={a} />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}