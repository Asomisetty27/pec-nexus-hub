import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FolderKanban, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SectionExplainer } from "@/components/ui/SectionExplainer";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Projects() {
  const { user, isAdmin } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*, project_memberships(user_id, role_on_project), organizations(name)").order("created_at", { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
    supabase.from("project_templates").select("*").eq("is_active", true).order("name").then(({ data }) => setTemplates(data || []));
    supabase.from("cohorts").select("*").order("name").then(({ data }) => setCohorts(data || []));
  }, []);

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const description = (form.get("description") as string) || "";

    if (useTemplate) {
      const templateId = form.get("template_id") as string;
      const cohortId = (form.get("cohort_id") as string) || null;
      if (!templateId) { toast.error("Pick a template"); setCreating(false); return; }
      const { data, error } = await supabase.rpc("create_project_from_template" as any, {
        p_template_id: templateId,
        p_name: name,
        p_cohort_id: cohortId,
        p_description: description,
      });
      setCreating(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Project created from template — stages and deliverables auto-generated.");
      setDialogOpen(false);
      fetchProjects();
      if (data) navigate(`/app/projects/${data}`);
      return;
    }

    const { error } = await supabase.from("projects").insert({
      name, description, status: "draft", created_by: user!.id,
      project_mode: (form.get("project_mode") as any) || "training_mock",
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setDialogOpen(false);
    fetchProjects();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Projects</h1>
          <SectionExplainer text="All active and past projects. Click any project to see stages, deliverables, and team." />
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
              </DialogHeader>
              <div className="flex gap-1 p-1 rounded-lg bg-muted/40 mb-1">
                <button type="button" onClick={() => setUseTemplate(true)} className={`flex-1 text-xs py-1.5 rounded ${useTemplate ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>From template</button>
                <button type="button" onClick={() => setUseTemplate(false)} className={`flex-1 text-xs py-1.5 rounded ${!useTemplate ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>Blank</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                {useTemplate ? (
                  <>
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select name="template_id" required>
                        <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
                        <SelectContent>
                          {templates.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} <span className="text-muted-foreground ml-1">· {t.engagement_type}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">Stages and deliverables are auto-generated. You can edit them after.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Cohort (optional)</Label>
                      <Select name="cohort_id">
                        <SelectTrigger><SelectValue placeholder="No cohort — solo project" /></SelectTrigger>
                        <SelectContent>
                          {cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">All cohort members will be auto-added.</p>
                    </div>
                    <div className="space-y-2"><Label>Project Name</Label><Input name="name" required placeholder="Q4 Battery Pack Redesign" /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea name="description" rows={2} placeholder="Optional context..." /></div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2"><Label>Project Name</Label><Input name="name" required placeholder="Website Redesign" /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea name="description" placeholder="Project scope and objectives..." /></div>
                    <div className="space-y-2">
                      <Label>Project Mode</Label>
                      <Select name="project_mode" defaultValue="training_mock">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="training_mock">Training / Mock</SelectItem>
                          <SelectItem value="internal_initiative">Internal Initiative</SelectItem>
                          <SelectItem value="competition">Competition</SelectItem>
                          <SelectItem value="client_engagement">Client Engagement</SelectItem>
                          <SelectItem value="sponsor_deliverable">Sponsor Deliverable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : useTemplate ? "Create from Template" : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search projects..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Card key={i} className="h-36 animate-pulse bg-muted/30" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FolderKanban className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No projects found.</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Projects will appear here once created by leadership.</p>
        </Card>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <motion.div key={p.id} variants={item}>
              <Card
                className="cursor-pointer hover:border-accent/40 transition-all duration-200 group"
                onClick={() => navigate(`/app/projects/${p.id}`)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-sans">{p.name}</CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[8px] font-mono">{(p.project_mode || "training_mock").replace("_", " ")}</Badge>
                      <Badge variant="outline" className="text-[9px] font-mono">{p.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description || "No description"}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono">{p.project_memberships?.length || 0} members</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
