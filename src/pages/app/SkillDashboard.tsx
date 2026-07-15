import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, TrendingUp, TrendingDown, Trophy, Activity, Shield, BarChart3 } from "lucide-react";

type Cohort = "software" | "hardware" | "mechanical" | "ops";

const COHORT_LABELS: Record<Cohort, string> = {
  software: "Software & AI",
  hardware: "Hardware & Embedded",
  mechanical: "Mechanical & Mfg",
  ops: "Business & Marketing",
};

export default function SkillDashboard() {
  const { user, isAdmin, isBoardOrAdmin, hasRole } = useAuth();
  const isLeadership = isBoardOrAdmin || hasRole("project_lead") || hasRole("advisor");

  const [scope, setScope] = useState<Cohort | "all">("all");
  const [userCohort, setUserCohort] = useState<Cohort | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [skillProg, setSkillProg] = useState<any[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, any>>({});
  const [cohortByUser, setCohortByUser] = useState<Record<string, Cohort>>({});
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine viewer's cohort + default scope
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("cohort_memberships")
        .select("cohort:cohort_id(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      const name: string | undefined = (data as any)?.cohort?.name;
      const c = mapCohortName(name);
      setUserCohort(c);
      if (!isAdmin && c) setScope(c);
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isLeadership) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [progRes, skillRes, attemptsRes] = await Promise.all([
        supabase.from("grind_progress").select("*"),
        supabase.from("grind_skill_progress").select("*"),
        supabase.from("drill_attempts")
          .select("user_id, attempted_at, is_correct, xp_earned, drill:drill_id(cohort, category, title)")
          .order("attempted_at", { ascending: false })
          .limit(50),
      ]);
      const prog = progRes.data || [];
      const skill = skillRes.data || [];
      const attempts = attemptsRes.data || [];

      const userIds = Array.from(new Set([
        ...prog.map((p: any) => p.user_id),
        ...skill.map((s: any) => s.user_id),
        ...attempts.map((a: any) => a.user_id),
      ]));
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        const map: Record<string, any> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfilesById(map);

        const { data: cms } = await supabase
          .from("cohort_memberships")
          .select("user_id, cohort:cohort_id(name)")
          .in("user_id", userIds);
        const cmap: Record<string, Cohort> = {};
        (cms || []).forEach((m: any) => {
          const c = mapCohortName(m.cohort?.name);
          if (c) cmap[m.user_id] = c;
        });
        setCohortByUser(cmap);
      }

      setProgress(prog);
      setSkillProg(skill);
      setRecentAttempts(attempts);
      setLoading(false);
    })();
  }, [isLeadership]);

  const filteredUsers = useMemo(() => {
    if (scope === "all") return null;
    return new Set(
      Object.entries(cohortByUser).filter(([, c]) => c === scope).map(([uid]) => uid),
    );
  }, [scope, cohortByUser]);

  const inScope = <T extends { user_id: string }>(rows: T[]) =>
    !filteredUsers ? rows : rows.filter((r) => filteredUsers.has(r.user_id));

  const activeGrinders = useMemo(() => {
    return [...inScope(progress)]
      .sort((a: any, b: any) => (b.drills_completed || 0) - (a.drills_completed || 0))
      .slice(0, 8);
  }, [progress, filteredUsers]);

  const streakLeaders = useMemo(() => {
    return [...inScope(progress)]
      .filter((p: any) => (p.current_streak || 0) > 0)
      .sort((a: any, b: any) => (b.current_streak || 0) - (a.current_streak || 0))
      .slice(0, 8);
  }, [progress, filteredUsers]);

  const skillsByCohortCategory = useMemo(() => {
    const rows = scope === "all" ? skillProg : skillProg.filter((s: any) => s.cohort === scope);
    const agg: Record<string, { cohort: string; category: string; attempts: number; correct: number; users: Set<string> }> = {};
    rows.forEach((r: any) => {
      const key = `${r.cohort}::${r.category}`;
      if (!agg[key]) agg[key] = { cohort: r.cohort, category: r.category, attempts: 0, correct: 0, users: new Set() };
      agg[key].attempts += r.attempts || 0;
      agg[key].correct += r.correct || 0;
      agg[key].users.add(r.user_id);
    });
    return Object.values(agg)
      .filter((a) => a.attempts >= 3)
      .map((a) => ({ ...a, accuracy: Math.round((a.correct / Math.max(1, a.attempts)) * 100), userCount: a.users.size }));
  }, [skillProg, scope]);

  const weakSkills = [...skillsByCohortCategory].sort((a, b) => a.accuracy - b.accuracy).slice(0, 6);
  const strongSkills = [...skillsByCohortCategory].sort((a, b) => b.accuracy - a.accuracy).slice(0, 6);

  // Improvement: compare last 7d vs prior 7d
  const improvement = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;
    const recent7: Record<string, { att: number; correct: number }> = {};
    const prior7: Record<string, { att: number; correct: number }> = {};
    inScope(recentAttempts).forEach((a: any) => {
      const t = new Date(a.attempted_at).getTime();
      const bucket = now - t < week ? recent7 : now - t < 2 * week ? prior7 : null;
      if (!bucket) return;
      if (!bucket[a.user_id]) bucket[a.user_id] = { att: 0, correct: 0 };
      bucket[a.user_id].att += 1;
      if (a.is_correct) bucket[a.user_id].correct += 1;
    });
    const out: { user_id: string; delta: number; recentAcc: number; recentAtt: number }[] = [];
    Object.entries(recent7).forEach(([uid, r]) => {
      if (r.att < 3) return;
      const recentAcc = r.correct / r.att;
      const p = prior7[uid];
      const priorAcc = p && p.att >= 3 ? p.correct / p.att : recentAcc;
      out.push({ user_id: uid, delta: Math.round((recentAcc - priorAcc) * 100), recentAcc: Math.round(recentAcc * 100), recentAtt: r.att });
    });
    return out.sort((a, b) => b.delta - a.delta).slice(0, 5);
  }, [recentAttempts, filteredUsers]);

  if (!isLeadership) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Leadership access required (PM, Lead, Advisor, or Admin).</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Skill Dashboard
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            Training signals from Grind — for staffing, development, and readiness
          </p>
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
        <TabsList>
          {isAdmin && <TabsTrigger value="all">All cohorts</TabsTrigger>}
          {(["software", "hardware", "mechanical", "ops"] as Cohort[]).map((c) => {
            // Non-admins limited to their own cohort
            if (!isAdmin && userCohort && c !== userCohort) return null;
            return <TabsTrigger key={c} value={c}>{COHORT_LABELS[c]}</TabsTrigger>;
          })}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Most Active Grinders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeGrinders.length === 0 && <EmptyRow text="No activity yet." />}
              {activeGrinders.map((p: any, i) => (
                <Row key={p.user_id} rank={i + 1}
                     name={profilesById[p.user_id]?.full_name || "Member"}
                     right={`${p.drills_completed} drills · ${p.total_xp} XP`} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> Streak Leaders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {streakLeaders.length === 0 && <EmptyRow text="No active streaks." />}
              {streakLeaders.map((p: any, i) => (
                <Row key={p.user_id} rank={i + 1}
                     name={profilesById[p.user_id]?.full_name || "Member"}
                     right={`${p.current_streak}-day streak`} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" /> Weakest Skill Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weakSkills.length === 0 && <EmptyRow text="Need more attempts to surface signal." />}
              {weakSkills.map((s) => (
                <SkillRow key={`${s.cohort}-${s.category}`} cohort={s.cohort} category={s.category}
                          accuracy={s.accuracy} attempts={s.attempts} users={s.userCount} negative />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-500" /> Strongest Skill Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {strongSkills.length === 0 && <EmptyRow text="Need more attempts to surface signal." />}
              {strongSkills.map((s) => (
                <SkillRow key={`${s.cohort}-${s.category}`} cohort={s.cohort} category={s.category}
                          accuracy={s.accuracy} attempts={s.attempts} users={s.userCount} />
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Most Improved (last 7d vs prior 7d)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {improvement.length === 0 && <EmptyRow text="Need more recent attempts to compute improvement." />}
              {improvement.map((m, i) => (
                <div key={m.user_id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                    <span>{profilesById[m.user_id]?.full_name || "Member"}</span>
                    <Badge variant="outline" className="text-[10px]">{m.recentAtt} attempts</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{m.recentAcc}% acc</span>
                    <span className={m.delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {m.delta >= 0 ? "+" : ""}{m.delta} pts
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Attempts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {inScope(recentAttempts).slice(0, 12).map((a: any, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(a.attempted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="truncate">{profilesById[a.user_id]?.full_name || "Member"}</span>
                    <span className="text-muted-foreground truncate">· {a.drill?.title}</span>
                  </div>
                  <Badge variant="outline" className={a.is_correct ? "text-emerald-600 border-emerald-500/30" : "text-muted-foreground"}>
                    {a.is_correct ? "✓" : "—"} {a.xp_earned} XP
                  </Badge>
                </div>
              ))}
              {inScope(recentAttempts).length === 0 && <EmptyRow text="No attempts in scope." />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ rank, name, right }: { rank: number; name: string; right: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-border/50">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-5">#{rank}</span>
        <span>{name}</span>
      </div>
      <span className="text-xs text-muted-foreground">{right}</span>
    </div>
  );
}

function SkillRow({
  cohort, category, accuracy, attempts, users, negative,
}: { cohort: string; category: string; accuracy: number; attempts: number; users: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-border/50">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className="text-[10px] capitalize">{cohort}</Badge>
        <span className="truncate">{category}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{users}u · {attempts} att</span>
        <Badge variant="outline" className={negative ? "text-red-600 border-red-500/30" : "text-emerald-600 border-emerald-500/30"}>
          {accuracy}%
        </Badge>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-2">{text}</p>;
}

function mapCohortName(name?: string | null): Cohort | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.startsWith("software")) return "software";
  if (n.startsWith("hardware")) return "hardware";
  if (n.startsWith("mechanical")) return "mechanical";
  if (n.startsWith("ops")) return "ops";
  return null;
}