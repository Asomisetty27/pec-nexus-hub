import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("*, user_roles(role)").order("full_name").then(({ data }) => setMembers(data || []));
  }, []);

  const filtered = members.filter(m =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.major?.toLowerCase().includes(search.toLowerCase()) ||
    m.skills?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-xs text-muted-foreground font-mono">{members.length} members</p>
      </motion.div>

      <motion.div variants={item} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, major, or skill..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
      </motion.div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No members found</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => (
            <motion.div key={m.id} variants={item}>
              <Card className="hover:border-accent/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent shrink-0">
                      {m.full_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.full_name || "Unknown"}</p>
                      {m.major && <p className="text-xs text-muted-foreground">{m.major}{m.graduation_year ? ` '${String(m.graduation_year).slice(2)}` : ""}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(m.user_roles || []).map((r: any, i: number) => (
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
          ))}
        </div>
      )}
    </motion.div>
  );
}
