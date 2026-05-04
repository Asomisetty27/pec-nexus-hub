import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  QUEUES,
  type QueueKey,
  isStale,
  isUnowned,
  needsResearch,
  readyForOutreach,
  isRecentlyChanged,
  fmtRelative,
} from "@/lib/crmQueues";
import {
  QUALIFIED_STATUSES,
  relationshipGoalLabel,
  statusBucket,
  statusBucketTone,
  statusLabel,
} from "@/lib/crmConstants";
import { ClaimButton } from "@/components/crm/ClaimButton";
import { Building2, ChevronRight } from "lucide-react";

export default function CrmQueues() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const active = (params.get("q") as QueueKey) || "mine";
  const [companies, setCompanies] = useState<any[]>([]);
  const [contactCounts, setContactCounts] = useState<Record<string, number>>({});
  const [lastTouches, setLastTouches] = useState<Record<string, { at: string; by: string | null }>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const orgsRes = await supabase
      .from("organizations")
      .select("*")
      .eq("is_company_relation", true)
      .order("updated_at", { ascending: false })
      .limit(500);
    const orgs = orgsRes.data || [];
    setCompanies(orgs);

    const ids = orgs.map((o) => o.id);
    const [contactsRes, actsRes, tasksRes] = await Promise.all([
      ids.length
        ? supabase.from("company_contacts").select("organization_id").in("organization_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase
            .from("company_activities")
            .select("organization_id, occurred_at, performed_by")
            .in("organization_id", ids)
            .order("occurred_at", { ascending: false })
            .limit(2000)
        : Promise.resolve({ data: [] as any[] }),
      user
        ? supabase
            .from("company_tasks")
            .select("*, organizations!inner(id, name)")
            .eq("assigned_to", user.id)
            .neq("status", "completed")
            .order("due_at", { ascending: true })
            .limit(100)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const counts: Record<string, number> = {};
    (contactsRes.data || []).forEach((c: any) => {
      counts[c.organization_id] = (counts[c.organization_id] || 0) + 1;
    });
    setContactCounts(counts);

    const touches: Record<string, { at: string; by: string | null }> = {};
    (actsRes.data || []).forEach((a: any) => {
      if (!touches[a.organization_id]) touches[a.organization_id] = { at: a.occurred_at, by: a.performed_by };
    });
    setLastTouches(touches);

    const userIds = Array.from(new Set(Object.values(touches).map((t) => t.by).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: pf } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const map: Record<string, string> = {};
      (pf || []).forEach((p: any) => (map[p.user_id] = p.full_name || "Member"));
      setProfiles(map);
    }
    setTasks(tasksRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    switch (active) {
      case "mine":
        return companies.filter(
          (c) =>
            c.owner_user_id === user?.id ||
            c.secondary_owner_user_id === user?.id ||
            c.overseeing_lead_user_id === user?.id
        );
      case "unowned":
        return companies.filter(isUnowned);
      case "ready":
        return companies.filter((c) => readyForOutreach(c, contactCounts[c.id] || 0));
      case "research":
        return companies.filter((c) => needsResearch(c, contactCounts[c.id] || 0));
      case "stale":
        return companies.filter(isStale);
      case "recent":
        return companies.filter(isRecentlyChanged);
      case "qualified":
        return companies.filter((c) => QUALIFIED_STATUSES.includes(c.crm_status));
      default:
        return [];
    }
  }, [active, companies, contactCounts, user?.id]);

  const counts = useMemo(() => {
    const total = (fn: (c: any) => boolean) => companies.filter(fn).length;
    return {
      mine: companies.filter(
        (c) =>
          c.owner_user_id === user?.id ||
          c.secondary_owner_user_id === user?.id ||
          c.overseeing_lead_user_id === user?.id
      ).length,
      unowned: total(isUnowned),
      ready: companies.filter((c) => readyForOutreach(c, contactCounts[c.id] || 0)).length,
      research: companies.filter((c) => needsResearch(c, contactCounts[c.id] || 0)).length,
      stale: total(isStale),
      recent: total(isRecentlyChanged),
      qualified: companies.filter((c) => QUALIFIED_STATUSES.includes(c.crm_status)).length,
      tasks: tasks.length,
    };
  }, [companies, contactCounts, tasks, user?.id]);

  const activeDef = QUEUES.find((q) => q.key === active)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {QUEUES.map((q) => (
          <button
            key={q.key}
            onClick={() => setParams({ q: q.key })}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
              active === q.key
                ? "bg-accent/15 border-accent/40 text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
          >
            {q.label}
            <Badge variant="outline" className="ml-1.5 text-[9px] font-mono">
              {counts[q.key] ?? 0}
            </Badge>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{activeDef.hint}</p>

      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted/30" />
      ) : active === "tasks" ? (
        tasks.length === 0 ? (
          <EmptyState text="No open tasks assigned to you." />
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <Card
                key={t.id}
                onClick={() => navigate(`/app/crm/c/${t.organization_id}`)}
                className="p-3 cursor-pointer hover:bg-muted/30 flex items-center gap-2"
              >
                <Badge variant="outline" className="text-[9px] font-mono capitalize">
                  {t.status?.replace(/_/g, " ")}
                </Badge>
                <span className="text-sm font-medium flex-1 truncate">{t.title}</span>
                <span className="text-[11px] text-muted-foreground truncate">{t.organizations?.name}</span>
                {t.due_at && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    due {new Date(t.due_at).toLocaleDateString()}
                  </span>
                )}
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState text={emptyHint(active)} action={() => navigate("/app/crm/table")} />
      ) : (
        <div className="space-y-1.5">
          {filtered.slice(0, 100).map((c) => {
            const bucket = statusBucket(c.crm_status);
            const touch = lastTouches[c.id];
            const unowned = isUnowned(c);
            return (
              <Card
                key={c.id}
                onClick={() => navigate(`/app/crm/c/${c.id}`)}
                className="p-3 cursor-pointer hover:bg-muted/30"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      {bucket && (
                        <Badge variant="outline" className={`text-[9px] font-mono ${statusBucketTone(bucket)}`}>
                          {statusLabel(c.crm_status)}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {relationshipGoalLabel(c.relationship_goal)}
                      </Badge>
                      {unowned && (
                        <Badge variant="outline" className="text-[9px] font-mono border-warning/40 text-warning">
                          Unowned
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground">
                      <span>{contactCounts[c.id] || 0} contact{(contactCounts[c.id] || 0) === 1 ? "" : "s"}</span>
                      {touch ? (
                        <span>
                          touched {fmtRelative(touch.at)}
                          {touch.by && profiles[touch.by] ? ` · ${profiles[touch.by]}` : ""}
                        </span>
                      ) : (
                        <span>no activity yet</span>
                      )}
                      {c.next_action_at && <span>next {fmtRelative(c.next_action_at)}</span>}
                    </div>
                  </div>
                  {unowned ? (
                    <ClaimButton organizationId={c.id} unowned onClaimed={load} />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function emptyHint(q: QueueKey): string {
  switch (q) {
    case "mine": return "You don't own any companies yet. Claim one from the Unowned queue.";
    case "unowned": return "Nothing unowned right now. Nice.";
    case "ready": return "Nothing queued for outreach. Move researched companies forward when ready.";
    case "research": return "Every active company has its basics filled in.";
    case "stale": return "No stale relationships.";
    case "recent": return "No changes in the last 7 days.";
    case "qualified": return "No qualified opportunities yet.";
    default: return "Empty.";
  }
}

function EmptyState({ text, action }: { text: string; action?: () => void }) {
  return (
    <Card className="p-8 text-center space-y-2">
      <p className="text-sm">{text}</p>
      {action && (
        <Button size="sm" variant="outline" onClick={action}>
          Browse all companies
        </Button>
      )}
    </Card>
  );
}
