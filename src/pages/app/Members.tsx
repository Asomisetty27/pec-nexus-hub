import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users, Cpu, Shield, Mail } from "lucide-react";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [cohortMap, setCohortMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filterCohort, setFilterCohort] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      // No FK between profiles.user_id and user_roles.user_id, so PostgREST embed fails.
      // Fetch roles separately and stitch on the client.
      const [profRes, rolesRes, cmRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("cohort_memberships").select("user_id, role, cohorts(name)"),
      ]);
      const rolesByUser: Record<string, { role: string }[]> = {};
      (rolesRes.data || []).forEach((r: any) => {
        (rolesByUser[r.user_id] ||= []).push({ role: r.role });
      });
      setMembers((profRes.data || []).map((p: any) => ({ ...p, user_roles: rolesByUser[p.user_id] || [] })));
      const map: Record<string, string> = {};
      (cmRes.data || []).forEach((cm: any) => {
        map[cm.user_id] = (cm.cohorts as any)?.name || "";
      });
      setCohortMap(map);
    };
    load();
  }, []);

  const cohorts = [...new Set(Object.values(cohortMap))].filter(Boolean).sort();

  const filtered = members.filter(m => {
    const matchesSearch = m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.major?.toLowerCase().includes(search.toLowerCase()) ||
      m.cal_poly_email?.toLowerCase().includes(search.toLowerCase()) ||
      m.skills?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesCohort = filterCohort === "all" || cohortMap[m.user_id] === filterCohort;
    return matchesSearch && matchesCohort;
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-xs text-muted-foreground font-mono">{members.length} members</p>
      </motion.div>

      <motion.div variants={item} className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, major, email, or skill..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={filterCohort === "all" ? "default" : "outline"}
            className="cursor-pointer text-[10px] font-mono"
            onClick={() => setFilterCohort("all")}
          >All</Badge>
          {cohorts.map(c => (
            <Badge
              key={c}
              variant={filterCohort === c ? "default" : "outline"}
              className="cursor-pointer text-[10px] font-mono"
              onClick={() => setFilterCohort(c)}
            >{c}</Badge>
          ))}
        </div>
      </motion.div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No members found</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const memberCohort = cohortMap[m.user_id];
            return (
              <motion.div key={m.id} variants={item}>
                <Card className="hover:border-accent/30 transition-all card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent-foreground shrink-0">
                        {m.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {m.full_name || m.cal_poly_email?.split("@")[0] || "Former member"}
                        </p>
                        {m.cal_poly_email && (
                          <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />{m.cal_poly_email}
                          </p>
                        )}
                        {m.major && <p className="text-xs text-muted-foreground mt-0.5">{m.major}{m.graduation_year ? ` '${String(m.graduation_year).slice(2)}` : ""}</p>}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {memberCohort && (
                            <Badge variant="secondary" className="text-[9px] font-mono gap-1">
                              <Cpu className="h-2.5 w-2.5" />{memberCohort}
                            </Badge>
                          )}
                          {(m.user_roles || []).filter((r: any) => r.role !== "applicant").map((r: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[9px] font-mono">{r.role}</Badge>
                          ))}
                        </div>
                        {m.skills && m.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.skills.slice(0, 4).map((s: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[9px]">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
