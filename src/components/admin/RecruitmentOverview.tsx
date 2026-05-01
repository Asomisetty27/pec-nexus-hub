import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, FileText, AlertCircle } from "lucide-react";

type Cycle = {
  id: string;
  season: string;
  year: number;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
};

type Applicant = {
  id: string;
  full_name: string;
  email: string;
  major: string | null;
  current_stage: string;
  routing_resolved: boolean;
  primary_reviewer_user_id: string | null;
  submitted_at: string | null;
  created_at: string;
  cycle_id: string | null;
};

export default function RecruitmentOverview() {
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [recent, setRecent] = useState<Applicant[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cyclesRes, recentRes] = await Promise.all([
          supabase.from("application_cycles").select("*").order("opens_at", { ascending: false }),
          supabase
            .from("applicants")
            .select("id,full_name,email,major,current_stage,routing_resolved,primary_reviewer_user_id,submitted_at,created_at,cycle_id")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
        if (cyclesRes.error) throw cyclesRes.error;
        if (recentRes.error) throw recentRes.error;
        setCycles(cyclesRes.data ?? []);
        setRecent(recentRes.data ?? []);

        // Per-cycle counts
        const c: Record<string, number> = {};
        for (const cy of cyclesRes.data ?? []) {
          const { count } = await supabase
            .from("applicants")
            .select("id", { count: "exact", head: true })
            .eq("cycle_id", cy.id);
          c[cy.id] = count ?? 0;
        }
        setCounts(c);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load recruitment overview");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    );
  }

  const now = new Date();
  const isOpen = (c: Cycle) =>
    c.is_active && new Date(c.opens_at) <= now && new Date(c.closes_at) >= now;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Application cycles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cycles defined yet.</p>
          ) : (
            <div className="space-y-2">
              {cycles.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{c.season} {c.year}</span>
                      {isOpen(c) ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Open</Badge>
                      ) : c.is_active ? (
                        <Badge variant="outline">Active (out of window)</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(c.opens_at).toLocaleDateString()} → {new Date(c.closes_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold">{counts[c.id] ?? 0}</div>
                    <div className="text-xs text-muted-foreground">applicants</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Latest submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applicants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2">Name</th>
                    <th>Major</th>
                    <th>Stage</th>
                    <th>Routed</th>
                    <th>Reviewer</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((a) => (
                    <tr key={a.id} className="border-t border-border/60">
                      <td className="py-2">
                        <div className="font-medium">{a.full_name}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="text-muted-foreground">{a.major ?? "—"}</td>
                      <td><Badge variant="outline" className="capitalize">{a.current_stage.replace(/_/g, " ")}</Badge></td>
                      <td>{a.routing_resolved ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">Needs routing</Badge>}</td>
                      <td className="text-xs text-muted-foreground">{a.primary_reviewer_user_id ? "Assigned" : "—"}</td>
                      <td className="text-xs text-muted-foreground">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Full reviewer pipeline ships in Phase 6B.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}