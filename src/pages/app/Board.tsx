// Board: the competitive leadership process. Every seat except President
// (Amogh) and VP Delivery (Sam) is an open position that current members and
// last year's board apply for. Members apply here; the guaranteed board (admins)
// review and decide, and acceptance grants the role automatically via the
// decide_board_application RPC. Backed by src/lib/boardApplications.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getActiveCycle, getPositions, getMyApplications, getAllApplications,
  submitApplication, withdrawApplication, decideApplication,
  type BoardPosition, type BoardApplication,
} from "@/lib/boardApplications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Award, Lock, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { SectionExplainer } from "@/components/ui/SectionExplainer";

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  under_review: { label: "Under review", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "outline" },
};

export default function Board() {
  const { user, isAdmin } = useAuth();
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [cycle, setCycle] = useState<{ id: string; name: string; closes_at: string | null } | null>(null);
  const [myApps, setMyApps] = useState<BoardApplication[]>([]);
  const [allApps, setAllApps] = useState<(BoardApplication & { applicant_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyFor, setApplyFor] = useState<BoardPosition | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [pos, cyc, mine] = await Promise.all([getPositions(), getActiveCycle(), getMyApplications(user.id)]);
    setPositions(pos);
    setCycle(cyc);
    setMyApps(mine);
    if (isAdmin) setAllApps(await getAllApplications());
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openPositions = useMemo(() => positions.filter((p) => p.is_open), [positions]);
  const guaranteed = useMemo(() => positions.filter((p) => !p.is_open), [positions]);
  const appliedKeys = useMemo(() => new Set(myApps.map((a) => a.position_key)), [myApps]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading the board…</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Award className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Board</h1>
          <p className="text-sm text-muted-foreground">
            Leadership is earned, not inherited. Every seat but President and VP Delivery is open.
          </p>
        </div>
      </div>

      <SectionExplainer text="President (Amogh) and VP Delivery (Sam) are the two guaranteed seats. Every other seat, the two open VP roles and the four Cohort Leads, is applied for by current members and last year's board. Amogh and Sam review each application; when they accept one, the role is granted automatically." />

      {!cycle && (
        <Card><CardContent className="py-5 text-sm text-muted-foreground">
          No board application cycle is open right now. When one opens, the positions below become applyable.
        </CardContent></Card>
      )}
      {cycle && (
        <p className="text-sm text-muted-foreground">
          Cycle: <span className="font-medium text-foreground">{cycle.name}</span>
          {cycle.closes_at && <> · closes {new Date(cycle.closes_at).toLocaleDateString()}</>}
        </p>
      )}

      {/* Guaranteed seats */}
      <section className="space-y-2">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Guaranteed seats</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {guaranteed.map((p) => (
            <Card key={p.key}><CardContent className="py-4 flex items-start gap-3">
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-muted-foreground">{p.filled_note ?? p.description}</div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </section>

      {/* Open positions */}
      <section className="space-y-2">
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Open seats</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {openPositions.map((p) => {
            const applied = appliedKeys.has(p.key);
            return (
              <Card key={p.key}><CardContent className="py-4 space-y-3">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-muted-foreground">{p.description}</div>
                </div>
                <Button
                  size="sm"
                  variant={applied ? "outline" : "default"}
                  disabled={!cycle || applied}
                  onClick={() => setApplyFor(p)}
                >
                  {applied ? "Applied" : cycle ? "Apply" : "Cycle closed"}
                </Button>
              </CardContent></Card>
            );
          })}
        </div>
      </section>

      {/* My applications */}
      {myApps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Your applications</h2>
          <div className="space-y-2">
            {myApps.map((a) => {
              const pos = positions.find((p) => p.key === a.position_key);
              const meta = STATUS_META[a.status];
              return (
                <Card key={a.id}><CardContent className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">{pos?.title ?? a.position_key}</div>
                    {a.decision_note && <div className="text-xs text-muted-foreground">Note: {a.decision_note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {(a.status === "submitted" || a.status === "under_review") && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const { error } = await withdrawApplication(a.id);
                        if (error) toast.error(error); else { toast.success("Withdrawn"); load(); }
                      }}>Withdraw</Button>
                    )}
                  </div>
                </CardContent></Card>
              );
            })}
          </div>
        </section>
      )}

      {isAdmin && <AdminReview apps={allApps} positions={positions} onDecided={load} />}

      {applyFor && cycle && user && (
        <ApplyDialog
          position={applyFor}
          onClose={() => setApplyFor(null)}
          onSubmit={async (fields) => {
            const { error } = await submitApplication({
              cycleId: cycle.id, userId: user.id, positionKey: applyFor.key,
              preferenceRank: myApps.length + 1, ...fields,
            });
            if (error) { toast.error(error); return; }
            toast.success(`Applied for ${applyFor.title}`);
            setApplyFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ApplyDialog({ position, onClose, onSubmit }: {
  position: BoardPosition;
  onClose: () => void;
  onSubmit: (f: { whyYou: string; vision: string; relevantExperience: string }) => Promise<void>;
}) {
  const [whyYou, setWhyYou] = useState("");
  const [vision, setVision] = useState("");
  const [relevantExperience, setRelevantExperience] = useState("");
  const [saving, setSaving] = useState(false);
  const canSubmit = whyYou.trim().length > 0 && vision.trim().length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Apply: {position.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{position.description}</p>
          <div className="space-y-1.5">
            <Label>Why you for this seat?</Label>
            <Textarea value={whyYou} onChange={(e) => setWhyYou(e.target.value)} rows={3}
              placeholder="What makes you the right person to own this." />
          </div>
          <div className="space-y-1.5">
            <Label>Your vision for the role</Label>
            <Textarea value={vision} onChange={(e) => setVision(e.target.value)} rows={3}
              placeholder="What you would do with it this year." />
          </div>
          <div className="space-y-1.5">
            <Label>Relevant experience <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={relevantExperience} onChange={(e) => setRelevantExperience(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSubmit || saving} onClick={async () => {
            setSaving(true);
            await onSubmit({ whyYou, vision, relevantExperience });
            setSaving(false);
          }}>Submit application</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminReview({ apps, positions, onDecided }: {
  apps: (BoardApplication & { applicant_name: string })[];
  positions: BoardPosition[];
  onDecided: () => void;
}) {
  const pending = apps.filter((a) => a.status === "submitted" || a.status === "under_review");
  const byPosition = useMemo(() => {
    const map = new Map<string, typeof apps>();
    for (const a of pending) {
      const list = map.get(a.position_key) ?? [];
      list.push(a);
      map.set(a.position_key, list);
    }
    return map;
  }, [pending]);

  const decide = async (id: string, decision: "accepted" | "declined") => {
    const { error } = await decideApplication(id, decision, "");
    if (error) toast.error(error);
    else { toast.success(decision === "accepted" ? "Accepted, role granted" : "Declined"); onDecided(); }
  };

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Review queue ({pending.length})</h2>
      {pending.length === 0 && <p className="text-sm text-muted-foreground">No applications waiting on a decision.</p>}
      {[...byPosition.entries()].map(([posKey, list]) => (
        <div key={posKey} className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {positions.find((p) => p.key === posKey)?.title ?? posKey}
          </h3>
          {list.map((a) => (
            <Card key={a.id}><CardContent className="py-3 space-y-2">
              <div className="font-medium text-sm">{a.applicant_name}</div>
              {a.why_you && <p className="text-sm"><span className="text-muted-foreground">Why: </span>{a.why_you}</p>}
              {a.vision && <p className="text-sm"><span className="text-muted-foreground">Vision: </span>{a.vision}</p>}
              {a.relevant_experience && <p className="text-sm"><span className="text-muted-foreground">Experience: </span>{a.relevant_experience}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => decide(a.id, "accepted")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Accept & grant
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(a.id, "declined")}>
                  <XCircle className="h-4 w-4 mr-1" /> Decline
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      ))}
    </section>
  );
}
