import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { BarChart3, FolderKanban, Users, CalendarDays, Briefcase, CheckCircle2, TrendingUp, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Analytics() {
  const [stats, setStats] = useState({ projects: 0, members: 0, tasks: 0, events: 0, leads: 0, completedTasks: 0, cohorts: 0, submissions: 0 });

  useEffect(() => {
    const fetch = async () => {
      const [p, m, t, e, l, ct, c, s] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }),
        supabase.from("events").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "done"),
        supabase.from("cohorts").select("*", { count: "exact", head: true }),
        supabase.from("submissions").select("*", { count: "exact", head: true }),
      ]);
      setStats({ projects: p.count || 0, members: m.count || 0, tasks: t.count || 0, events: e.count || 0, leads: l.count || 0, completedTasks: ct.count || 0, cohorts: c.count || 0, submissions: s.count || 0 });
    };
    fetch();
  }, []);

  const completionRate = stats.tasks > 0 ? Math.round((stats.completedTasks / stats.tasks) * 100) : 0;

  const tiles = [
    { icon: FolderKanban, label: "Total Projects", value: stats.projects, desc: "All projects in the system", color: "text-accent" },
    { icon: Users, label: "Total Members", value: stats.members, desc: "Registered users", color: "text-accent" },
    { icon: CheckCircle2, label: "Tasks Done", value: stats.completedTasks, desc: `of ${stats.tasks} total`, color: "text-success" },
    { icon: CalendarDays, label: "Events", value: stats.events, desc: "All events", color: "text-accent" },
    { icon: Briefcase, label: "Pipeline Leads", value: stats.leads, desc: "CRM pipeline", color: "text-accent" },
    { icon: Cpu, label: "Cohorts", value: stats.cohorts, desc: "Active cohorts", color: "text-accent" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-xs text-muted-foreground font-mono">Current organization metrics</p>
      </motion.div>

      {/* Completion Rate Hero */}
      <motion.div variants={item}>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
          <CardContent className="relative flex items-center gap-8 p-8">
            <ProgressRing progress={completionRate} size={120} strokeWidth={8}>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono">{completionRate}%</p>
              </div>
            </ProgressRing>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Organization Health</p>
              <h2 className="font-display text-xl font-bold">Task Completion Rate</h2>
              <p className="text-sm text-muted-foreground mt-1">{stats.completedTasks} of {stats.tasks} tasks completed across all projects</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-[10px] font-mono gap-1">
                  <TrendingUp className="h-3 w-3" /> {stats.submissions} lab submissions
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t, i) => (
          <motion.div key={i} variants={item}>
            <Card className="hover:border-accent/30 transition-all">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <t.icon className={`h-6 w-6 ${t.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono">{t.value}</p>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
