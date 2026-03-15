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
import { Trophy, Plus, CalendarDays, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Competitions() {
  const { user, isAdmin } = useAuth();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [compRes, appRes] = await Promise.all([
        supabase.from("competitions").select("*").order("created_at", { ascending: false }),
        supabase.from("competition_applications").select("*"),
      ]);
      setCompetitions(compRes.data || []);
      setApplications(appRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("competitions").insert({
      title: f.get("title") as string,
      description: f.get("description") as string,
      created_by: user!.id,
      is_public: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Competition created");
    setDialogOpen(false);
    const { data } = await supabase.from("competitions").select("*").order("created_at", { ascending: false });
    setCompetitions(data || []);
  };

  const getAppCount = (compId: string) => applications.filter(a => a.competition_id === compId).length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-4xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Competitions</h1>
          <p className="text-xs text-muted-foreground font-mono">{competitions.length} competitions</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Competition</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Competition</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea name="description" rows={4} /></div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1,2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}</div>
      ) : competitions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Trophy className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No competitions yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Spring quarter focuses on training — competitions return in Fall.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {competitions.map(comp => (
            <motion.div key={comp.id} variants={item}>
              <Card className="hover:border-accent/40 transition-all group">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-sans flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-accent" />
                      {comp.title}
                    </CardTitle>
                    {comp.is_public && <Badge variant="outline" className="text-[9px] font-mono">Public</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{comp.description || "No description"}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{getAppCount(comp.id)} applications</span>
                    {comp.application_deadline && (
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(comp.application_deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
