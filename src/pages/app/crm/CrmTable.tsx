import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CRM_STATUS_BUCKET,
  CRM_STATUS_LABEL,
  INACTIVE_STATUSES,
  RELATIONSHIP_GOAL_OPTIONS,
  fitScoreTone,
  relationshipGoalLabel,
  statusBucketTone,
  statusLabel,
} from "@/lib/crmConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCrmAccess } from "@/hooks/useCrmAccess";

const STALE_DAYS = 14;

export default function CrmTable() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isLeadership } = useCrmAccess();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>(params.get("filter") || "all");
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("is_company_relation", true)
      .order("updated_at", { ascending: false });
    setCompanies(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return companies.filter((c) => {
      if (filter === "unclassified" && c.relationship_goal) return false;
      if (filter === "stale") {
        if (INACTIVE_STATUSES.includes(c.crm_status)) return false;
        const ms = c.last_contacted_at ? Date.now() - new Date(c.last_contacted_at).getTime() : Infinity;
        if (ms < STALE_DAYS * 86400000) return false;
      }
      if (goalFilter !== "all") {
        if (goalFilter === "unset" && c.relationship_goal) return false;
        if (goalFilter !== "unset" && c.relationship_goal !== goalFilter) return false;
      }
      if (statusFilter === "active" && INACTIVE_STATUSES.includes(c.crm_status)) return false;
      if (statusFilter === "inactive" && !INACTIVE_STATUSES.includes(c.crm_status)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !(c.industry || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [companies, search, filter, goalFilter, statusFilter]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = (f.get("name") as string).trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    const { data, error } = await supabase
      .from("organizations")
      .insert({
        name,
        type: "company",
        is_company_relation: true,
        industry: (f.get("industry") as string) || null,
        hq_location: (f.get("hq") as string) || null,
        website_url: (f.get("website") as string) || null,
        relationship_goal: ((f.get("goal") as string) || null) as any,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Company added");
    setCreateOpen(false);
    if (data) navigate(`/app/crm/c/${data.id}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name or industry…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v);
            if (v === "all") {
              params.delete("filter");
            } else {
              params.set("filter", v);
            }
            setParams(params);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            <SelectItem value="unclassified">Unclassified goal</SelectItem>
            <SelectItem value="stale">Going stale</SelectItem>
          </SelectContent>
        </Select>
        <Select value={goalFilter} onValueChange={setGoalFilter}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <SelectValue placeholder="Goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All goals</SelectItem>
            <SelectItem value="unset">Unset</SelectItem>
            {RELATIONSHIP_GOAL_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-auto">{rows.length} shown</span>
        {isLeadership && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add company</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Input name="industry" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>HQ location</Label>
                    <Input name="hq" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input name="website" type="url" placeholder="https://" />
                </div>
                <div className="space-y-1.5">
                  <Label>Relationship goal</Label>
                  <Select name="goal" defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Optional — classify later" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_GOAL_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Add company
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted/30" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium mb-1">No companies match these filters</p>
          <p className="text-[12px] text-muted-foreground">Adjust filters or add a new company.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Company</th>
                  <th className="text-left px-3 py-2 font-semibold">Goal</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Warmth</th>
                  <th className="text-left px-3 py-2 font-semibold">Fit</th>
                  <th className="text-left px-3 py-2 font-semibold">Last</th>
                  <th className="text-left px-3 py-2 font-semibold">Next</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const bucket = CRM_STATUS_BUCKET[c.crm_status as keyof typeof CRM_STATUS_BUCKET];
                  const fit =
                    c.relationship_goal === "sponsorship" ? c.sponsor_fit_score : c.project_fit_score;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/app/crm/c/${c.id}`)}
                      className="border-t border-border/40 hover:bg-muted/20 cursor-pointer"
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium leading-tight">{c.name}</p>
                        {c.industry && (
                          <p className="text-[10px] text-muted-foreground">{c.industry}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {relationshipGoalLabel(c.relationship_goal)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {bucket && (
                          <Badge variant="outline" className={`text-[9px] font-mono ${statusBucketTone(bucket)}`}>
                            {statusLabel(c.crm_status)}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] capitalize">{c.warmth_score}</td>
                      <td className={`px-3 py-2 text-[11px] font-mono font-semibold ${fitScoreTone(fit)}`}>
                        {fit ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">
                        {c.last_contacted_at
                          ? `${Math.round((Date.now() - new Date(c.last_contacted_at).getTime()) / 86400000)}d`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">
                        {c.next_action_at
                          ? new Date(c.next_action_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}