import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, FolderKanban, Users, CalendarDays, Briefcase, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Analytics() {
  const [stats, setStats] = useState({ projects: 0, members: 0, tasks: 0, events: 0, leads: 0, completedTasks: 0 });

  useEffect(() => {
    const fetch = async () => {
      const [p, m, t, e, l, ct] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
      ]);
      setStats({ projects: p.count || 0, members: m.count || 0, tasks: t.count || 0, events: e.count || 0, leads: l.count || 0, completedTasks: ct.count || 0 });
    };
    fetch();
  }, []);

  const tiles = [
    { icon: FolderKanban, label: "Total Projects", value: stats.projects, desc: "All projects in the system" },
    { icon: Users, label: "Total Members", value: stats.members, desc: "Registered users" },
    { icon: CheckCircle2, label: "Tasks Completed", value: stats.completedTasks, desc: `of ${stats.tasks} total tasks` },
    { icon: CalendarDays, label: "Events", value: stats.events, desc: "Scheduled events" },
    { icon: Briefcase, label: "Pipeline Leads", value: stats.leads, desc: "CRM pipeline" },
    { icon: BarChart3, label: "Completion Rate", value: stats.tasks > 0 ? Math.round((stats.completedTasks / stats.tasks) * 100) + "%" : "—", desc: "Task completion rate" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Analytics</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <t.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{t.value}</p>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
