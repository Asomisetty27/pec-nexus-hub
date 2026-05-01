import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, Loader2, MessageSquare, RefreshCw, Send, Star, UserCheck, UserCog, Route as RouteIcon,
} from "lucide-react";
import {
  ALL_STAGES, RECOMMENDATIONS, STAGE_LABEL, STAGE_TONE,
  TERMINAL_STAGES, advanceStage, assignPrimaryReviewer, canReviewerDoTransition, fetchSignedResumeUrl,
  loadRecruitmentAccess, nextStage, rerouteApplicant, submitReview,
  type ApplicantStage, type ApplicantDecision,
} from "@/lib/recruitment";
import { StageBadge } from "@/components/recruitment/StageBadge";
import { cn } from "@/lib/utils";

type Applicant = {
  id: string;
  cycle_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  major: string | null;
  graduation_year: number | null;
  experience: string | null;
  why_join: string | null;
  links: any;
  source: string | null;
  source_detail: string | null;
  routed_cohort_id: string | null;
  routing_resolved: boolean;
  primary_reviewer_user_id: string | null;
  current_stage: ApplicantStage;
  final_decision: ApplicantDecision | null;
  resume_storage_path: string | null;
  submitted_at: string | null;
  created_at: string;
};

type Review = {
  id: string;
  reviewer_user_id: string;
  recommendation: ApplicantDecision;
  rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
type Note = {
  id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};
type Hist = {
  id: string;
  from_stage: ApplicantStage | null;
  to_stage: ApplicantStage;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
};
type Cohort = { id: string; name: string };
type Profile = { user_id: string; full_name: string | null };

export default function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, string>>(new Map());
  const [isLead, setIsLead] = useState(false);

  // form state
  const [recommendation, setRecommendation] = useState<ApplicantDecision>("advance");
  const [rating, setRating] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [advancing, setAdvancing] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [a, r, n, h] = await Promise.all([
        supabase.from("applicants").select("*").eq("id", id).maybeSingle(),
        supabase.from("applicant_reviews").select("*").eq("applicant_id", id).order("created_at", { ascending: false }),
        supabase.from("applicant_notes").select("*").eq("applicant_id", id).order("created_at", { ascending: false }),
        supabase.from("applicant_stage_history").select("*").eq("applicant_id", id).order("created_at", { ascending: true }),
      ]);
      if (a.error) throw a.error;
      if (!a.data) { setError("Applicant not found or you don't have access."); setApplicant(null); return; }
      setApplicant(a.data as any);
      setReviews((r.data ?? []) as any);
      setNotes((n.data ?? []) as any);
      setHistory((h.data ?? []) as any);

      // load referenced names
      const ids = new Set<string>();
      ((r.data ?? []) as any[]).forEach((x) => x.reviewer_user_id && ids.add(x.reviewer_user_id));
      ((n.data ?? []) as any[]).forEach((x) => x.author_user_id && ids.add(x.author_user_id));
      ((h.data ?? []) as any[]).forEach((x) => x.changed_by && ids.add(x.changed_by));
      if ((a.data as any).primary_reviewer_user_id) ids.add((a.data as any).primary_reviewer_user_id);
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,full_name")
          .in("user_id", Array.from(ids));
        const m = new Map<string, string>();
        ((profs ?? []) as Profile[]).forEach((p) => m.set(p.user_id, p.full_name ?? "—"));
        setProfilesById(m);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load applicant");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Applicant | PEC Recruitment";
    void reload();
    (async () => {
      const { data: c } = await supabase.from("cohorts").select("id,name").order("name");
      setCohorts((c ?? []) as Cohort[]);
      if (user) {
        const a = await loadRecruitmentAccess(user.id, isAdmin);
        setIsLead(a.isLead);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cohortName = useMemo(
    () => cohorts.find((c) => c.id === applicant?.routed_cohort_id)?.name ?? null,
    [cohorts, applicant?.routed_cohort_id]
  );

  const myReview = useMemo(
    () => reviews.find((r) => r.reviewer_user_id === user?.id) ?? null,
    [reviews, user?.id]
  );

  useEffect(() => {
    if (myReview) {
      setRecommendation(myReview.recommendation);
      setRating(myReview.rating?.toString() ?? "");
      setReviewNotes(myReview.notes ?? "");
    }
  }, [myReview]);

  const handleSubmitReview = async () => {
    if (!applicant) return;
    setSubmitting(true);
    const { error } = await submitReview({
      applicantId: applicant.id,
      recommendation,
      rating: rating ? parseInt(rating, 10) : null,
      notes: reviewNotes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(myReview ? "Review updated" : "Review submitted");
      void reload();
    }
  };

  const handleAddNote = async () => {
    if (!applicant || !user) return;
    const body = noteBody.trim();
    if (!body) return;
    setSavingNote(true);
    const { error } = await supabase.from("applicant_notes").insert({
      applicant_id: applicant.id,
      author_user_id: user.id,
      body,
    });
    setSavingNote(false);
    if (error) toast.error(error.message);
    else { setNoteBody(""); void reload(); }
  };

  const handleResume = async () => {
    if (!applicant) return;
    setResumeBusy(true);
    const url = await fetchSignedResumeUrl(applicant.id);
    setResumeBusy(false);
    if (!url) { toast.error("Couldn't generate resume link"); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading applicant…
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className="container max-w-md py-12 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Applicant not found."}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/recruitment/inbox"><ArrowLeft className="mr-2 h-4 w-4" /> Back to inbox</Link>
        </Button>
      </div>
    );
  }

  const stage = applicant.current_stage;
  const next = nextStage(stage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/recruitment/inbox"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void reload()}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold">{applicant.full_name}</h2>
              <p className="text-sm text-muted-foreground">{applicant.email}{applicant.phone ? ` · ${applicant.phone}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={stage} />
              {applicant.routing_resolved ? (
                cohortName && <Badge variant="secondary">Cohort: {cohortName}</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600">Needs routing</Badge>
              )}
              {applicant.primary_reviewer_user_id && (
                <Badge variant="outline" className="gap-1">
                  <UserCheck className="h-3 w-3" />
                  {profilesById.get(applicant.primary_reviewer_user_id) ?? "Reviewer assigned"}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 md:grid-cols-3">
            <div><span className="font-medium text-foreground">Major:</span> {applicant.major ?? "—"}</div>
            <div><span className="font-medium text-foreground">Source:</span> {applicant.source ?? "—"}{applicant.source_detail ? ` (${applicant.source_detail})` : ""}</div>
            <div><span className="font-medium text-foreground">Submitted:</span> {applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleString() : "—"}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleResume} disabled={resumeBusy} variant="outline" size="sm">
              <FileText className="mr-1 h-4 w-4" /> {resumeBusy ? "Generating…" : "View resume"}
            </Button>
            {applicant.links?.portfolio && (
              <Button asChild variant="outline" size="sm">
                <a href={applicant.links.portfolio} target="_blank" rel="noreferrer">Portfolio</a>
              </Button>
            )}
            {applicant.links?.linkedin && (
              <Button asChild variant="outline" size="sm">
                <a href={applicant.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              </Button>
            )}

            {/* Stage actions */}
            {next && canReviewerDoTransition(stage, next) && (
              <AdvanceButton
                label={`Advance to ${STAGE_LABEL[next]}`}
                onConfirm={async (reason) => {
                  setAdvancing(true);
                  const { error } = await advanceStage({ applicantId: applicant.id, toStage: next });
                  setAdvancing(false);
                  if (error) toast.error(error.message);
                  else { toast.success(`Advanced to ${STAGE_LABEL[next]}`); void reload(); }
                }}
                requireReason={false}
                busy={advancing}
              />
            )}

            {isLead && <LeadStageDialog stage={stage} onAdvance={async (to, reason) => {
              setAdvancing(true);
              const { error } = await advanceStage({ applicantId: applicant.id, toStage: to, reason });
              setAdvancing(false);
              if (error) toast.error(error.message);
              else { toast.success(`Stage updated to ${STAGE_LABEL[to]}`); void reload(); }
            }} />}

            {isLead && <ReassignDialog
              applicantId={applicant.id}
              cohortId={applicant.routed_cohort_id}
              currentReviewerId={applicant.primary_reviewer_user_id}
              onDone={reload}
            />}

            {isLead && <RerouteDialog
              applicantId={applicant.id}
              currentCohortId={applicant.routed_cohort_id}
              cohorts={cohorts}
              onDone={reload}
            />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Application</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section label="Why PEC" body={applicant.why_join} />
            <Section label="Relevant experience" body={applicant.experience} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Your review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rec">Recommendation</Label>
                <Select value={recommendation} onValueChange={(v) => setRecommendation(v as ApplicantDecision)}>
                  <SelectTrigger id="rec"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECOMMENDATIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rating">Rating (1–5)</Label>
                <Input id="rating" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rnotes">Notes</Label>
              <Textarea id="rnotes" rows={4} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Strengths, concerns, fit." />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSubmitReview} disabled={submitting}>
                {submitting ? "Saving…" : myReview ? "Update review" : "Submit review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Reviews ({reviews.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reviews yet.</p>
          ) : reviews.map((r) => (
            <div key={r.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{profilesById.get(r.reviewer_user_id) ?? "Reviewer"}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-[10px]">{r.recommendation.replace(/_/g, " ")}</Badge>
                  {r.rating && (
                    <span className="inline-flex items-center gap-0.5 text-xs">
                      <Star className="h-3 w-3 text-amber-500" /> {r.rating}/5
                    </span>
                  )}
                </div>
              </div>
              {r.notes && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{r.notes}</p>}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {new Date(r.updated_at).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Notes ({notes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <Textarea rows={2} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Internal note (visible to all reviewers on this applicant)." />
            <Button size="sm" onClick={handleAddNote} disabled={savingNote || !noteBody.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{profilesById.get(n.author_user_id) ?? "—"}</span>
                <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Stage history</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-xs">
                <span className={cn("mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full", "bg-primary")} />
                <div className="flex-1">
                  <div>
                    {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : ""}
                    <span className="font-medium">{STAGE_LABEL[h.to_stage]}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                    {h.changed_by ? ` · ${profilesById.get(h.changed_by) ?? "user"}` : " · system"}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ label, body }: { label: string; body: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{body || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function AdvanceButton({
  label, onConfirm, requireReason, busy,
}: { label: string; onConfirm: (reason: string) => void | Promise<void>; requireReason: boolean; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handle = async () => {
    if (requireReason && reason.trim().length < 3) return;
    await onConfirm(reason);
    setOpen(false);
    setReason("");
  };

  if (!requireReason) {
    return <Button size="sm" disabled={busy} onClick={() => onConfirm("")}>{label}</Button>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>This action requires a written reason.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter>
          <Button onClick={handle} disabled={busy || reason.trim().length < 3}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadStageDialog({ stage, onAdvance }: {
  stage: ApplicantStage;
  onAdvance: (to: ApplicantStage, reason: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<ApplicantStage>(stage);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const willTerminal = TERMINAL_STAGES.includes(to);
  const needsReason = to !== stage; // Lead path always sends reason; backend allows forward-by-one without reason but our gate is leadership

  const handle = async () => {
    if (to === stage) return;
    if (reason.trim().length < 3) return;
    setBusy(true);
    await onAdvance(to, reason);
    setBusy(false);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserCog className="mr-1 h-4 w-4" /> Lead: change stage</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change stage</DialogTitle>
          <DialogDescription>
            Skips, backward moves, and terminal decisions all require a reason and are logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Target stage</Label>
            <Select value={to} onValueChange={(v) => setTo(v as ApplicantStage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reason {willTerminal && <span className="text-destructive">*</span>}</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this transition?" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handle} disabled={busy || to === stage || reason.trim().length < 3}>
            {busy ? "Updating…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReassignDialog({
  applicantId, cohortId, currentReviewerId, onDone,
}: {
  applicantId: string;
  cohortId: string | null;
  currentReviewerId: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [pick, setPick] = useState<string>(currentReviewerId ?? "none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !cohortId) return;
    (async () => {
      const { data: memb } = await supabase
        .from("cohort_memberships")
        .select("user_id")
        .eq("cohort_id", cohortId)
        .in("role", ["lead", "pm", "integration_lead"]);
      const ids = ((memb ?? []) as any[]).map((m) => m.user_id);
      if (ids.length === 0) { setUsers([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", ids);
      setUsers((profs ?? []) as any);
    })();
  }, [open, cohortId]);

  const handle = async () => {
    setBusy(true);
    const { error } = await assignPrimaryReviewer({
      applicantId,
      userId: pick === "none" ? null : pick,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Reviewer updated"); setOpen(false); onDone(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!cohortId}><UserCheck className="mr-1 h-4 w-4" /> Assign reviewer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign primary reviewer</DialogTitle>
          <DialogDescription>Eligible reviewers in the routed cohort.</DialogDescription>
        </DialogHeader>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible reviewers in this cohort.</p>
        ) : (
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Unassigned —</SelectItem>
              {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name ?? u.user_id.slice(0, 8)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <DialogFooter><Button onClick={handle} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RerouteDialog({
  applicantId, currentCohortId, cohorts, onDone,
}: {
  applicantId: string;
  currentCohortId: string | null;
  cohorts: Cohort[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>(currentCohortId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!pick || reason.trim().length < 3) return;
    setBusy(true);
    const { error } = await rerouteApplicant({ applicantId, cohortId: pick, reason });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Applicant rerouted"); setOpen(false); onDone(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><RouteIcon className="mr-1 h-4 w-4" /> Reroute</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reroute applicant</DialogTitle>
          <DialogDescription>
            Move this applicant to a different cohort. Current reviewer is kept only if they're eligible in the new cohort.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Target cohort</Label>
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger><SelectValue placeholder="Pick a cohort" /></SelectTrigger>
              <SelectContent>
                {cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handle} disabled={busy || !pick || reason.trim().length < 3}>
            {busy ? "Routing…" : "Confirm reroute"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}