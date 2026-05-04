import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Linkedin,
  Globe,
  MapPin,
  Plus,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  CRM_STATUS_LABEL,
  RELATIONSHIP_GOAL_OPTIONS,
  TIER_LABEL,
  WARMTH_LABEL,
  fitScoreTone,
  relationshipGoalLabel,
  statusBucket,
  statusBucketTone,
  statusLabel,
  type CrmStatus,
} from "@/lib/crmConstants";
import { logAuditAction } from "@/lib/audit";
import { ClaimButton } from "@/components/crm/ClaimButton";
import { LogActivityDialog } from "@/components/crm/LogActivityDialog";
import { isUnowned, fmtRelative } from "@/lib/crmQueues";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [orgRes, contactsRes, tasksRes, convRes, actsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", id).maybeSingle(),
      supabase.from("company_contacts").select("*").eq("organization_id", id).order("is_primary", { ascending: false }),
      supabase.from("company_tasks").select("*").eq("organization_id", id).order("due_at", { ascending: true }),
      supabase.from("company_conversions").select("*").eq("organization_id", id).order("converted_at", { ascending: false }),
      supabase
        .from("company_activities")
        .select("*")
        .eq("organization_id", id)
        .order("occurred_at", { ascending: false })
        .limit(25),
    ]);
    setCompany(orgRes.data);
    setContacts(contactsRes.data || []);
    setTasks(tasksRes.data || []);
    setConversions(convRes.data || []);
    const acts = actsRes.data || [];
    setActivities(acts);
    const userIds = Array.from(
      new Set(
        [
          ...acts.map((a: any) => a.performed_by),
          orgRes.data?.owner_user_id,
          orgRes.data?.secondary_owner_user_id,
          orgRes.data?.overseeing_lead_user_id,
        ].filter(Boolean)
      )
    ) as string[];
    if (userIds.length) {
      const { data: pf } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const m: Record<string, string> = {};
      (pf || []).forEach((p: any) => (m[p.user_id] = p.full_name || "Member"));
      setActorNames(m);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="h-64 animate-pulse rounded-lg bg-muted/30" />;
  if (!company) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-medium mb-1">Company not found</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/app/crm/table")}>
          Back to companies
        </Button>
      </Card>
    );
  }

  const bucket = statusBucket(company.crm_status);
  const fit = company.relationship_goal === "sponsorship" ? company.sponsor_fit_score : company.project_fit_score;

  const updateStatus = async (next: CrmStatus) => {
    setSavingStatus(true);
    const { error } = await supabase
      .from("organizations")
      .update({ crm_status: next as any })
      .eq("id", company.id);
    setSavingStatus(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated");
    logAuditAction("crm.status_changed", "organization", company.id, {
      from: company.crm_status,
      to: next,
    });
    setCompany({ ...company, crm_status: next });
  };

  const updateGoal = async (next: string) => {
    const { error } = await supabase
      .from("organizations")
      .update({ relationship_goal: next as any })
      .eq("id", company.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Goal updated");
    setCompany({ ...company, relationship_goal: next });
  };

  const updateWarmth = async (next: "cold" | "warm" | "hot") => {
    const { error } = await supabase.from("organizations").update({ warmth_score: next as any }).eq("id", company.id);
    if (error) return toast.error(error.message);
    setCompany({ ...company, warmth_score: next });
  };

  return (
    <div className="space-y-4 max-w-[1100px]">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>

      {!company.relationship_goal && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-center gap-3">
            <p className="text-[12px] flex-1">
              Classify this company so it appears correctly in pipeline filters.
            </p>
            <Select onValueChange={updateGoal}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Set relationship goal" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_GOAL_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="font-display text-xl font-bold leading-tight">{company.name}</h1>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                    {company.industry && <span>{company.industry}</span>}
                    {company.hq_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {company.hq_location}
                      </span>
                    )}
                    {company.website_url && (
                      <a
                        href={company.website_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                      </a>
                    )}
                    {company.linkedin_url && (
                      <a
                        href={company.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <Linkedin className="h-3 w-3" />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing((v) => !v)}>
                  {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  {editing ? "Cancel" : "Edit"}
                </Button>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {bucket && (
                  <Badge variant="outline" className={`text-[10px] font-mono ${statusBucketTone(bucket)}`}>
                    {statusLabel(company.crm_status)}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-mono">
                  {relationshipGoalLabel(company.relationship_goal)}
                </Badge>
                {company.tier_priority && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {TIER_LABEL[company.tier_priority as "tier_1" | "tier_2" | "tier_3"]}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] font-mono capitalize">
                  {WARMTH_LABEL[company.warmth_score as "cold" | "warm" | "hot"]}
                </Badge>
                {fit != null && (
                  <span className={`text-[10px] font-mono font-semibold ${fitScoreTone(fit)}`}>
                    Fit {fit}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] font-mono text-muted-foreground">
                <span>
                  Owner:{" "}
                  {company.owner_user_id
                    ? actorNames[company.owner_user_id] || "Member"
                    : "Unowned"}
                </span>
                {company.secondary_owner_user_id && (
                  <span>2nd: {actorNames[company.secondary_owner_user_id] || "Member"}</span>
                )}
                {company.overseeing_lead_user_id && (
                  <span>Lead: {actorNames[company.overseeing_lead_user_id] || "Member"}</span>
                )}
                {activities[0] ? (
                  <span>
                    Last touched {fmtRelative(activities[0].occurred_at)}
                    {activities[0].performed_by
                      ? ` · ${actorNames[activities[0].performed_by] || "Member"}`
                      : ""}
                  </span>
                ) : (
                  <span>No activity logged yet</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <ClaimButton
                  organizationId={company.id}
                  unowned={isUnowned(company)}
                  onClaimed={load}
                />
                <LogActivityDialog organizationId={company.id} onLogged={load} />
              </div>
            </div>
          </div>

          {editing && (
            <EditCompanyForm
              company={company}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setCompany({ ...company, ...updated });
                setEditing(false);
              }}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-semibold">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={company.crm_status} onValueChange={(v) => updateStatus(v as CrmStatus)} disabled={savingStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRM_STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Goal</Label>
                <Select value={company.relationship_goal || ""} onValueChange={updateGoal}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Unset" />
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
              <div className="space-y-1.5">
                <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Warmth</Label>
                <Select value={company.warmth_score} onValueChange={(v) => updateWarmth(v as "cold" | "warm" | "hot")}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-semibold">Notes</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {company.notes ? (
                <p className="text-[12px] whitespace-pre-line text-foreground/90">{company.notes}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">No notes yet. Use Edit to add context.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Activity</CardTitle>
              <LogActivityDialog organizationId={company.id} onLogged={load} triggerLabel="Log" />
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {activities.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">
                  No activity yet. Log outreach so other Ops members can see what's been done.
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div key={a.id} className="text-[12px] border-l-2 border-border/50 pl-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-mono capitalize">
                          {a.activity_type?.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {fmtRelative(a.occurred_at)}
                          {a.performed_by ? ` · ${actorNames[a.performed_by] || "Member"}` : ""}
                        </span>
                      </div>
                      {a.subject && <p className="font-medium mt-0.5">{a.subject}</p>}
                      {a.body && (
                        <p className="text-[11px] text-muted-foreground whitespace-pre-line">{a.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Tasks</CardTitle>
              <Button size="sm" variant="ghost" className="text-[10px] gap-1" onClick={() => toast.info("Task creation coming next phase")}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {tasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">No tasks.</p>
              ) : (
                <div className="space-y-1.5">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[12px]">
                      <Badge variant="outline" className="text-[9px] font-mono capitalize">
                        {t.status?.replace(/_/g, " ")}
                      </Badge>
                      <span className="flex-1 truncate">{t.title}</span>
                      {t.due_at && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(t.due_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3 px-5 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Contacts</CardTitle>
              <Button size="sm" variant="ghost" className="text-[10px] gap-1" onClick={() => setAddContactOpen((v) => !v)}>
                <Plus className="h-3 w-3" /> {addContactOpen ? "Cancel" : "Add"}
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {addContactOpen && (
                <AddContactForm
                  organizationId={company.id}
                  onAdded={() => {
                    setAddContactOpen(false);
                    load();
                  }}
                />
              )}
              {contacts.length === 0 && !addContactOpen ? (
                <p className="text-[11px] text-muted-foreground py-2">No contacts yet.</p>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="text-[12px] border-t border-border/40 pt-2 first:border-0 first:pt-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium truncate">{c.full_name}</p>
                      {c.is_primary && (
                        <Badge variant="outline" className="text-[8px] font-mono">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {c.title && <p className="text-[10px] text-muted-foreground">{c.title}</p>}
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="hover:text-foreground">
                          <Mail className="h-3 w-3" />
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="hover:text-foreground">
                          <Phone className="h-3 w-3" />
                        </a>
                      )}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                          <Linkedin className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-semibold">Conversions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {conversions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2">No conversions yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {conversions.map((c) => (
                    <div key={c.id} className="text-[12px] flex items-center justify-between">
                      <Badge variant="outline" className="text-[9px] font-mono">{c.conversion_type}</Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(c.converted_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EditCompanyForm({
  company,
  onCancel,
  onSaved,
}: {
  company: any;
  onCancel: () => void;
  onSaved: (updated: any) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const patch: any = {
      industry: (f.get("industry") as string) || null,
      hq_location: (f.get("hq") as string) || null,
      website_url: (f.get("website") as string) || null,
      linkedin_url: (f.get("linkedin") as string) || null,
      notes: (f.get("notes") as string) || null,
    };
    const { error } = await supabase.from("organizations").update(patch).eq("id", company.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    onSaved(patch);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 border-t border-border/40 pt-4">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Industry</Label>
        <Input name="industry" defaultValue={company.industry || ""} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">HQ</Label>
        <Input name="hq" defaultValue={company.hq_location || ""} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Website</Label>
        <Input name="website" type="url" defaultValue={company.website_url || ""} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">LinkedIn</Label>
        <Input name="linkedin" type="url" defaultValue={company.linkedin_url || ""} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</Label>
        <Textarea name="notes" rows={3} defaultValue={company.notes || ""} />
      </div>
      <div className="sm:col-span-2 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="gap-1.5" disabled={saving}>
          <Save className="h-3 w-3" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function AddContactForm({
  organizationId,
  onAdded,
}: {
  organizationId: string;
  onAdded: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("company_contacts").insert({
      organization_id: organizationId,
      full_name: (f.get("name") as string).trim(),
      title: (f.get("title") as string) || null,
      email: (f.get("email") as string) || null,
      phone: (f.get("phone") as string) || null,
      linkedin_url: (f.get("linkedin") as string) || null,
      is_primary: f.get("primary") === "on",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contact added");
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border border-border/60 rounded-md p-2.5 mb-2">
      <Input name="name" placeholder="Full name" required className="h-8 text-xs" />
      <Input name="title" placeholder="Title" className="h-8 text-xs" />
      <Input name="email" type="email" placeholder="Email" className="h-8 text-xs" />
      <Input name="phone" placeholder="Phone" className="h-8 text-xs" />
      <Input name="linkedin" type="url" placeholder="LinkedIn URL" className="h-8 text-xs" />
      <label className="flex items-center gap-1.5 text-[11px]">
        <input type="checkbox" name="primary" /> Primary contact
      </label>
      <Button type="submit" size="sm" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Add contact"}
      </Button>
    </form>
  );
}