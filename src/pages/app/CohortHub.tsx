import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Users, BookOpen, Target, ChevronRight, Cpu, Wrench, Code, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const cohortIcons: Record<string, any> = { cpu: Cpu, wrench: Wrench, code: Code, briefcase: Briefcase };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function CohortHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState<any>(null);
  const [cohort, setCohort] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [mockProjects, setMockProjects] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get user's cohort membership
      const { data: cm } = await supabase.from("cohort_memberships").select("*, cohorts(*)").eq("user_id", user.id).limit(1).maybeSingle();
      if (!cm) { setLoading(false); return; }
      setMembership(cm);
      setCohort((cm as any).cohorts);
      const cohortId = cm.cohort_id;

      const [membersRes, projRes, manualRes] = await Promise.all([
        supabase.from("cohort_memberships").select("*, profiles:user_id(full_name, avatar_url, major)").eq("cohort_id", cohortId).order("role"),
        supabase.from("mock_projects").select("*").eq("cohort_id", cohortId),
        supabase.from("lab_manuals").select("*").eq("cohort_id", cohortId),
      ]);
      setMembers(membersRes.data || []);
      setMockProjects(projRes.data || []);
      setManuals(manualRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Cpu className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">No Cohort Assigned</h2>
        <p className="text-muted-foreground text-sm max-w-sm">You haven't been assigned to a cohort yet. Contact your admin or PM.</p>
      </div>
    );
  }

  const Icon = cohortIcons[cohort.icon] || Cpu;
  const roleOrder = ["pm", "lead", "integration_lead", "member"];
  const sortedMembers = [...members].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      {/* Cohort Header */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl border bg-card p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{cohort.name}</h1>
            <p className="text-sm text-muted-foreground">{cohort.description}</p>
            <Badge variant="outline" className="mt-2 text-[10px] font-mono uppercase">{membership.role}</Badge>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Roster */}
        <motion.div variants={item} className="lg:col-span-1">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" /> Team ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {sortedMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {(m.profiles as any)?.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{(m.profiles as any)?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">{m.role}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Mock Projects + Lab Manuals */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" /> Mock Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {mockProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No mock projects yet. PM/Leads can create them.</p>
                ) : (
                  <div className="space-y-3">
                    {mockProjects.map((p: any) => (
                      <motion.div
                        key={p.id}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border p-4 cursor-pointer hover:border-accent/50 transition-all group"
                        onClick={() => navigate(`/app/mock-project/${p.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">{p.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.scenario || "No scenario defined"}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                        <Badge variant="outline" className="mt-2 text-[9px] font-mono">{p.status}</Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base font-sans font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-accent" /> Lab Manuals
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {manuals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No lab manuals yet.</p>
                ) : (
                  <div className="space-y-3">
                    {manuals.map((m: any) => (
                      <motion.div
                        key={m.id}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border p-4 cursor-pointer hover:border-accent/50 transition-all group"
                        onClick={() => navigate(`/app/lab/${m.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">{m.title}</h3>
                            <p className="text-xs text-muted-foreground">{m.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">v{m.version}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
