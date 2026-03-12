import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Users, Mail } from "lucide-react";

export default function Members() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from("profiles").select("*, user_roles(role)").order("full_name");
      setMembers(data || []);
    };
    fetchMembers();
  }, []);

  const filtered = members.filter(m =>
    m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.major?.toLowerCase().includes(search.toLowerCase()) ||
    m.skills?.some((s: string) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">{members.length} members</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, major, or skill..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No members found</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium shrink-0">
                    {m.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.full_name || "Unknown"}</p>
                    {m.major && <p className="text-xs text-muted-foreground">{m.major}{m.graduation_year ? ` '${String(m.graduation_year).slice(2)}` : ""}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(m.user_roles || []).map((r: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{r.role}</Badge>
                      ))}
                    </div>
                    {m.skills && m.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.skills.slice(0, 4).map((s: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
