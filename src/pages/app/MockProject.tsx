import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, FileText, CheckSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function MockProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("mock_projects").select("*, cohorts(name)").eq("id", id).single().then(({ data }) => {
      setProject(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Card className="h-48 animate-pulse bg-muted/30" />;
  if (!project) return <p className="text-muted-foreground text-center py-20">Project not found.</p>;

  const rubric = Array.isArray(project.rubric) ? project.rubric : [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/app/cohort")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{(project as any).cohorts?.name} • Mock Project</p>
          <h1 className="font-display text-2xl font-bold">{project.title}</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" /> Scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm whitespace-pre-wrap">{project.scenario || "No scenario defined yet."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-accent" /> Objectives
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm whitespace-pre-wrap">{project.objectives || "No objectives defined yet."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" /> Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm whitespace-pre-wrap">{project.deliverables_desc || "No deliverables defined yet."}</p>
          </CardContent>
        </Card>

        {rubric.length > 0 && (
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
        )}
      </div>

      <Badge variant="outline" className="text-xs font-mono">{project.status}</Badge>
    </motion.div>
  );
}
