import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Target, FileText, CheckSquare, ChevronRight, Lock, Unlock, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function MockProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isLeader = membership?.role === "pm" || membership?.role === "lead" || membership?.role === "integration_lead";

  useEffect(() => {
    if (!id || !user) return;
    const load = async () => {
      const [projRes, stagesRes] = await Promise.all([
        supabase.from("mock_projects").select("*, cohorts(name, id)").eq("id", id).single(),
        supabase.from("project_stages").select("*").eq("mock_project_id", id).order("order_index"),
      ]);
      setProject(projRes.data);
      setStages(stagesRes.data || []);

      if (projRes.data) {
        const { data: cm } = await supabase.from("cohort_memberships").select("*")
          .eq("cohort_id", (projRes.data as any).cohorts?.id)
          .eq("user_id", user.id).maybeSingle();
        setMembership(cm);
      }
      setLoading(false);
    };
    load();
  }, [id, user]);

  const advanceStage = async (stageId: string, nextStageId: string) => {
    await supabase.from("project_stages").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", stageId);
    await supabase.from("project_stages").update({ status: "active", unlocked_at: new Date().toISOString() }).eq("id", nextStageId);
    toast.success("Stage advanced!");
    window.location.reload();
  };

  if (loading) return <Card className="h-48 animate-pulse bg-muted/30" />;
  if (!project) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Target className="h-12 w-12 mb-3 opacity-30" />
      <p>Project not found.</p>
    </div>
  );

  const rubric = Array.isArray(project.rubric) ? project.rubric : [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl space-y-6">
      <motion.div variants={item} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app/cohort")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{(project as any).cohorts?.name} • Mock Project</p>
          <h1 className="font-display text-2xl font-bold">{project.title}</h1>
        </div>
        <Badge variant="outline" className="ml-auto text-xs font-mono">{project.status}</Badge>
      </motion.div>

      {/* Lifecycle Timeline */}
      {stages.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-sans font-semibold">Project Lifecycle</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-1.5">
                {stages.map((stage, i) => {
                  const isActive = stage.status === "active";
                  const isCompleted = stage.status === "completed";
                  const nextStage = stages[i + 1];
                  return (
                    <div key={stage.id} className="flex items-center gap-1.5 flex-1">
                      <div className={`flex-1 rounded-xl p-4 border text-center transition-all ${
                        isCompleted ? "bg-success/10 border-success/30" :
                        isActive ? "bg-accent/10 border-accent/30 glow-accent" :
                        "bg-muted/20 border-border/50"
                      }`}>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          {isCompleted ? <CheckSquare className="h-3.5 w-3.5 text-success" /> :
                           isActive ? <Unlock className="h-3.5 w-3.5 text-accent" /> :
                           <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                        </div>
                        <p className="text-xs font-semibold">{stage.name}</p>
                        <p className="text-[9px] text-muted-foreground capitalize mt-0.5">{stage.status}</p>
                        {isActive && isLeader && nextStage && (
                          <Button size="sm" variant="outline" className="mt-2 text-[10px] h-6" onClick={() => advanceStage(stage.id, nextStage.id)}>
                            Complete & Advance
                          </Button>
                        )}
                      </div>
                      {i < stages.length - 1 && <div className="w-3 h-px bg-border shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" /> Scenario
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.scenario || "No scenario defined yet."}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-accent" /> Objectives
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.objectives || "No objectives defined yet."}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" /> Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.deliverables_desc || "No deliverables defined yet."}</p>
            </CardContent>
          </Card>
        </motion.div>

        {rubric.length > 0 && (
          <motion.div variants={item}>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-sans font-semibold">Rubric</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {rubric.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <span>{r.criteria || r.name || `Criteria ${i + 1}`}</span>
                    <Badge variant="outline" className="text-[10px] font-mono">{r.points || r.weight || "—"} pts</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
