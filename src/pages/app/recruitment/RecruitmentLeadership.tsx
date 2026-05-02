import { useEffect, useMemo, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Send, CheckCircle2, UserPlus, ShieldOff, Clock, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";
import { onboardAcceptedApplicant, sendOnboardingInviteEmail, STAGE_LABEL } from "@/lib/recruitment";
import { StageBadge } from "@/components/recruitment/StageBadge";
import type { RecruitmentCtx } from "./RecruitmentLayout";
import PreCyclePoolPanel from "@/components/recruitment/PreCyclePoolPanel";

type Row = {
  id: string;
  full_name: string;
  email: string;
  major: string | null;
  current_stage: string;
  routed_cohort_id: string | null;
  primary_reviewer_user_id: string | null;
  decision_at: string | null;
  submitted_at: string | null;
  onboarding_state: "not_started" | "invite_sent" | "joined";
  onboarding_sent_at: string | null;
  converted_member_user_id: string | null;
};

const ONBOARDING_TONE: Record<Row["onboarding_state"], string> = {
  not_started: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  invite_sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  joined: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const ONBOARDING_LABEL: Record<Row["onboarding_state"], string> = {
  not_started: "Onboarding pending",
  invite_sent: "Invite sent",
  joined: "Joined",
};

export default function RecruitmentLeadership() {
  const ctx = useOutletContext<RecruitmentCtx>();
  const [rows, setRows] = useState<Row[]>([]);
  const [cohorts, setCohorts] = useState<Record<string, string>>({});
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [appRes, cohRes] = await Promise.all([
      supabase
        .from("applicants")
        .select("id,full_name,email,major,current_stage,routed_cohort_id,primary_reviewer_user_id,decision_at,submitted_at,onboarding_state,onboarding_sent_at,converted_member_user_id")
        .in("current_stage", ["decision_pending", "waitlisted", "accepted", "rejected"])
        .order("decision_at", { ascending: false, nullsFirst: false })
        .order("submitted_at", { ascending: false })
        .limit(200),
      supabase.from("cohorts").select("id,name"),
    ]);
    setRows(((appRes.data ?? []) as any) as Row[]);
    const cmap: Record<string, string> = {};
    (cohRes.data ?? []).forEach((c: any) => { cmap[c.id] = c.name; });
    setCohorts(cmap);

    const reviewerIds = Array.from(new Set((appRes.data ?? []).map((r: any) => r.primary_reviewer_user_id).filter(Boolean)));
    if (reviewerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", reviewerIds);
      const rmap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { rmap[p.user_id] = p.full_name; });
      setReviewers(rmap);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const groups = useMemo(() => {
    return {
      decision_pending: rows.filter((r) => r.current_stage === "decision_pending"),
      waitlisted: rows.filter((r) => r.current_stage === "waitlisted"),
      accepted: rows.filter((r) => r.current_stage === "accepted"),
      rejected: rows.filter((r) => r.current_stage === "rejected").slice(0, 25),
    };
  }, [rows]);

  const handleOnboard = async (row: Row) => {
    if (!ctx.access.isLead) { toast.error("Recruitment lead only"); return; }
    setBusy(row.id);
    try {
      const { data, error } = await onboardAcceptedApplicant(row.id);
      if (error) { toast.error(error.message ?? "Onboarding failed"); return; }
      if (!data) { toast.error("No response from onboarding"); return; }

      if (data.state === "joined") {
        toast.success(data.already_member
          ? `${row.full_name} linked to existing member`
          : `${row.full_name} joined`);
      } else if (data.state === "invite_sent" && data.invite_token && data.invite_token_id) {
        // Dispatch the existing invite-email pathway
        const { data: emailRes, error: emailErr } = await sendOnboardingInviteEmail({
          email: data.email,
          fullName: data.full_name,
          token: data.invite_token,
          tokenId: data.invite_token_id,
        });
        if (emailErr || (emailRes as any)?.error) {
          const link = `${window.location.origin}/invite/${data.invite_token}`;
          await navigator.clipboard.writeText(link).catch(() => {});
          toast.warning("Invite created. Email failed — link copied to clipboard.", { duration: 8000 });
        } else {
          toast.success(`Invite sent to ${data.email}`);
        }
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Onboarding failed");
    } finally {
      setBusy(null);
    }
  };

  const copyInviteLink = async (row: Row) => {
    // Refetch token (not stored locally)
    const { data } = await supabase
      .from("applicants")
      .select("onboarding_invite_token_id")
      .eq("id", row.id)
      .maybeSingle();
    const tokenId = (data as any)?.onboarding_invite_token_id;
    if (!tokenId) { toast.error("No invite token on file"); return; }
    const { data: tok } = await supabase
      .from("invite_tokens")
      .select("token")
      .eq("id", tokenId)
      .maybeSingle();
    if (!tok?.token) { toast.error("Token not accessible"); return; }
    const link = `${window.location.origin}/invite/${tok.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  if (!ctx.access.isLead) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <ShieldOff className="h-4 w-4" /> Leadership funnel is restricted to recruitment leads.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading leadership funnel…
      </div>
    );
  }

  const RowItem = ({ row, showOnboard }: { row: Row; showOnboard?: boolean }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-3 py-2 transition-colors hover:bg-muted/30">
      <Link to={`/app/recruitment/c/${row.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{row.full_name}</div>
          <StageBadge stage={row.current_stage as any} className="shrink-0 text-[10px]" />
          {showOnboard && (
            <Badge variant="outline" className={`h-4 shrink-0 px-1 text-[10px] ${ONBOARDING_TONE[row.onboarding_state]}`}>
              {ONBOARDING_LABEL[row.onboarding_state]}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="truncate">{row.email}</span>
          {row.major && <span>· {row.major}</span>}
          {row.routed_cohort_id && cohorts[row.routed_cohort_id] && <span>· {cohorts[row.routed_cohort_id]}</span>}
          {row.primary_reviewer_user_id && reviewers[row.primary_reviewer_user_id] && (
            <span>· reviewer {reviewers[row.primary_reviewer_user_id]}</span>
          )}
          {row.decision_at && (
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(row.decision_at).toLocaleDateString()}</span>
          )}
        </div>
      </Link>

      {showOnboard && (
        <div className="flex shrink-0 items-center gap-1.5">
          {row.onboarding_state === "not_started" && (
            <Button size="sm" disabled={busy === row.id || !row.routed_cohort_id} onClick={() => handleOnboard(row)}>
              {busy === row.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
              Onboard
            </Button>
          )}
          {row.onboarding_state === "invite_sent" && (
            <>
              <Button size="sm" variant="outline" onClick={() => copyInviteLink(row)}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Copy link
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === row.id} onClick={() => handleOnboard(row)} title="Resend invite email">
                {busy === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}
          {row.onboarding_state === "joined" && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Joined
            </Badge>
          )}
        </div>
      )}
    </div>
  );

  const Section = ({
    title,
    description,
    items,
    showOnboard,
    empty,
  }: { title: string; description?: string; items: Row[]; showOnboard?: boolean; empty: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-end justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <Badge variant="secondary" className="font-mono">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-1.5">{items.map((r) => <RowItem key={r.id} row={r} showOnboard={showOnboard} />)}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PreCyclePoolPanel isLead={ctx.access.isLead} />
      <Section
        title="Decision pending"
        description="Awaiting your final call."
        items={groups.decision_pending}
        empty="No applicants awaiting decision."
      />
      <Section
        title="Accepted · onboarding"
        description="One-action onboarding. Linking to an existing member or issuing an invite."
        items={groups.accepted}
        showOnboard
        empty="No accepted applicants in queue."
      />
      <Section
        title="Waitlisted"
        items={groups.waitlisted}
        empty="No waitlisted applicants."
      />
      <Section
        title="Recently rejected"
        description="Last 25 decisions."
        items={groups.rejected}
        empty="No recent rejections."
      />
    </div>
  );
}
