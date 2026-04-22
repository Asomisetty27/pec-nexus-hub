import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Search, Users, CheckCircle2, XCircle, AlertTriangle,
  UserCheck, UserX, Eye, Hash, FileText, FolderOpen, Package,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Wand2 } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

interface AccessLine {
  granted: boolean;
  reason: string;
  source: "role" | "cohort" | "project" | "ownership" | "visibility" | "admin";
}

export default function PermissionInspector() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");

  // User inspection
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [userCohorts, setUserCohorts] = useState<any[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [userMockProjects, setUserMockProjects] = useState<any[]>([]);
  const [userChannels, setUserChannels] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [rosterRow, setRosterRow] = useState<any>(null);
  const [repairing, setRepairing] = useState(false);

  // Resource inspection
  const [projects, setProjects] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [resourceType, setResourceType] = useState<string>("");
  const [accessLines, setAccessLines] = useState<AccessLine[]>([]);

  // Identity conflicts
  const [rosterConflicts, setRosterConflicts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [profRes, conflictsRes, projRes, chRes, docRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("cohort_roster").select("*").eq("identity_status", "conflict").order("full_name"),
        supabase.from("projects").select("id, name, status, visibility_scope, project_mode").order("name"),
        supabase.from("channels").select("id, name, is_org_wide, project_id, description").order("name"),
        supabase.from("documents").select("id, title, visibility, project_id, cohort_id, mock_project_id, author_id, doc_type").order("title").limit(200),
      ]);
      setProfiles(profRes.data || []);
      setRosterConflicts((conflictsRes.data as any[]) || []);
      setProjects(projRes.data || []);
      setChannels(chRes.data || []);
      setDocuments(docRes.data || []);
    };
    load();
  }, [isAdmin]);

  const inspectUser = async (profile: any) => {
    setSelectedUser(profile);
    setSelectedResource(null);
    const [rolesRes, cohortsRes, projectsRes, mockProjRes, channelsRes, logsRes, rosterRes] = await Promise.all([
      supabase.from("user_roles").select("*").eq("user_id", profile.user_id),
      supabase.from("cohort_memberships").select("*, cohorts(name)").eq("user_id", profile.user_id),
      supabase.from("project_memberships").select("*, projects(name, status)").eq("user_id", profile.user_id),
      supabase.from("mock_project_memberships").select("*, mock_projects(title, cohort_id)").eq("user_id", profile.user_id),
      supabase.from("channel_members").select("*, channels(name, is_org_wide)").eq("user_id", profile.user_id),
      supabase.from("audit_logs").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(15),
      supabase.from("cohort_roster").select("*").ilike("email", (profile.cal_poly_email || "").trim()).maybeSingle(),
    ]);
    setUserRoles(rolesRes.data || []);
    setUserCohorts(cohortsRes.data || []);
    setUserProjects(projectsRes.data || []);
    setUserMockProjects(mockProjRes.data || []);
    setUserChannels(channelsRes.data || []);
    setAuditLogs(logsRes.data || []);
    setRosterRow(rosterRes.data || null);
  };

  const repairIdentity = async () => {
    if (!selectedUser) return;
    setRepairing(true);
    const { data, error } = await supabase.rpc("resync_user_from_roster" as any, { p_user_id: selectedUser.user_id });
    setRepairing(false);
    if (error) {
      toast.error(`Repair failed: ${error.message}`);
      return;
    }
    const result: any = data;
    if (result?.matched) {
      toast.success(`Resynced from roster: ${result.cohort_name} · ${result.roster_role}`);
    } else {
      toast.warning(`No roster match (${result?.reason || "unknown"})`);
    }
    await inspectUser(selectedUser);
  };

  const inspectProject = async (project: any) => {
    setSelectedResource(project);
    setResourceType("project");
    setSelectedUser(null);
    // Compute access explanation
    const [membersRes] = await Promise.all([
      supabase.from("project_memberships").select("user_id, role_on_project, profiles:user_id(full_name)").eq("project_id", project.id),
    ]);
    const lines: AccessLine[] = [
      { granted: true, reason: `Visibility: ${project.visibility_scope}`, source: "visibility" },
      { granted: true, reason: `Mode: ${project.project_mode}`, source: "visibility" },
      { granted: true, reason: "Admins always have access via is_admin() check", source: "admin" },
      { granted: true, reason: `${(membersRes.data || []).length} project members have access via project_memberships`, source: "project" },
    ];
    (membersRes.data || []).forEach((m: any) => {
      lines.push({ granted: true, reason: `${(m.profiles as any)?.full_name || "?"} — ${m.role_on_project}`, source: "project" });
    });
    setAccessLines(lines);
  };

  const inspectChannel = async (channel: any) => {
    setSelectedResource(channel);
    setResourceType("channel");
    setSelectedUser(null);
    const [membersRes] = await Promise.all([
      supabase.from("channel_members").select("user_id, profiles:user_id(full_name)").eq("channel_id", channel.id),
    ]);
    const lines: AccessLine[] = [];
    if (channel.is_org_wide) {
      lines.push({ granted: true, reason: "Org-wide channel — visible to all authenticated users", source: "visibility" });
    }
    lines.push({ granted: true, reason: "Admins always have access", source: "admin" });
    lines.push({ granted: true, reason: `${(membersRes.data || []).length} explicit channel members`, source: "role" });
    (membersRes.data || []).forEach((m: any) => {
      lines.push({ granted: true, reason: `${(m.profiles as any)?.full_name || "?"}`, source: "project" });
    });
    setAccessLines(lines);
  };

  const inspectDocument = async (doc: any) => {
    setSelectedResource(doc);
    setResourceType("document");
    setSelectedUser(null);
    const lines: AccessLine[] = [
      { granted: true, reason: `Visibility: ${doc.visibility}`, source: "visibility" },
      { granted: true, reason: "Author always has access", source: "ownership" },
      { granted: true, reason: "Admins always have access", source: "admin" },
    ];
    if (doc.project_id) {
      lines.push({ granted: true, reason: "Project members have access via project_id", source: "project" });
    }
    if (doc.cohort_id) {
      lines.push({ granted: true, reason: "Cohort members have access via cohort_id", source: "cohort" });
    }
    if (doc.mock_project_id) {
      lines.push({ granted: true, reason: "Mock project cohort members have access", source: "cohort" });
    }
    if (!doc.project_id && !doc.cohort_id && !doc.mock_project_id) {
      lines.push({ granted: false, reason: "No project/cohort scope — only author and admins can see", source: "visibility" });
    }
    setAccessLines(lines);
  };

  const resolveConflict = async (rosterId: string, action: "matched" | "rejected") => {
    const { error } = await supabase.from("cohort_roster").update({ identity_status: action } as any).eq("id", rosterId);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    setRosterConflicts(prev => prev.filter(r => r.id !== rosterId));
    toast.success(`Identity ${action}`);
    await supabase.from("audit_logs").insert({
      action: `identity_${action}`,
      target_type: "cohort_roster",
      target_id: rosterId,
    });
  };

  const filteredProfiles = profiles.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.cal_poly_email?.toLowerCase().includes(search.toLowerCase())
  );

  const sourceColor: Record<string, string> = {
    role: "bg-primary/10 text-primary",
    cohort: "bg-accent/10 text-accent-foreground",
    project: "bg-success/10 text-success",
    ownership: "bg-warning/10 text-warning",
    visibility: "bg-muted text-muted-foreground",
    admin: "bg-destructive/10 text-destructive",
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center py-20 text-muted-foreground">
      <Shield className="h-12 w-12 mb-3 opacity-30" />
      <p className="text-sm">Admin access required.</p>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl">
      <motion.div variants={item}>
        <h1 className="font-display text-2xl font-bold">Permission Inspector</h1>
        <p className="text-xs text-muted-foreground font-mono">Diagnose access · Inspect resources · Resolve identity conflicts</p>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5"><Package className="h-3 w-3" />Projects</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><Hash className="h-3 w-3" />Channels</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3 w-3" />Documents</TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-1.5">
            Identity Queue
            {rosterConflicts.length > 0 && <Badge className="h-4 min-w-4 p-0 flex items-center justify-center text-[9px]">{rosterConflicts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* USER INSPECTION */}
        <TabsContent value="users" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredProfiles.map(p => (
                  <button key={p.id}
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${selectedUser?.id === p.id ? "bg-accent/10 border border-accent/30" : "hover:bg-muted/40"}`}
                    onClick={() => inspectUser(p)}>
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {p.full_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{p.cal_poly_email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              {!selectedUser ? (
                <Card className="flex flex-col items-center py-16">
                  <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Select a user to inspect</p>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">{selectedUser.full_name?.charAt(0)}</div>
                        <div>
                          <p className="font-medium">{selectedUser.full_name}</p>
                          <p className="text-xs text-muted-foreground">{selectedUser.cal_poly_email}</p>
                        </div>
                        <Badge variant="outline" className="ml-auto text-[9px] font-mono capitalize">{selectedUser.status}</Badge>
                        <Button size="sm" variant="outline" onClick={repairIdentity} disabled={repairing} className="h-7 text-[11px] gap-1">
                          <Wand2 className="h-3 w-3" />
                          {repairing ? "Repairing…" : "Repair from roster"}
                        </Button>
                      </div>

                      {/* Roster expectation vs actual */}
                      <div className="mb-4 rounded-md border bg-muted/20 p-3">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Roster mapping</p>
                        {rosterRow ? (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div className="text-muted-foreground">Roster row</div>
                            <div className="font-mono">{rosterRow.full_name} · {rosterRow.role}</div>
                            <div className="text-muted-foreground">Expected cohort</div>
                            <div className="font-mono">{rosterRow.cohort_name}</div>
                            <div className="text-muted-foreground">Identity status</div>
                            <div className="font-mono">{rosterRow.identity_status}{rosterRow.matched_user_id === selectedUser.user_id ? " ✓" : ""}</div>
                            <div className="text-muted-foreground">Expected app role(s)</div>
                            <div className="font-mono">
                              member{["pm","lead","integration_lead"].includes(rosterRow.role) ? " + project_lead" : ""}
                            </div>
                            {(() => {
                              const expectedCohortMatched = userCohorts.some(c => (c.cohorts as any)?.name === rosterRow.cohort_name);
                              const expectedRoles = ["member", ...(["pm","lead","integration_lead"].includes(rosterRow.role) ? ["project_lead"] : [])];
                              const missingRoles = expectedRoles.filter(r => !userRoles.some(ur => ur.role === r));
                              const issues: string[] = [];
                              if (!expectedCohortMatched) issues.push("missing cohort membership");
                              if (missingRoles.length) issues.push(`missing role(s): ${missingRoles.join(", ")}`);
                              if (userProjects.length === 0) issues.push("no project memberships");
                              if (rosterRow.matched_user_id !== selectedUser.user_id) issues.push("roster not marked matched");
                              return issues.length > 0 ? (
                                <>
                                  <div className="text-muted-foreground">Mismatches</div>
                                  <div className="text-warning font-mono">{issues.join(" · ")}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-muted-foreground">Status</div>
                                  <div className="text-success font-mono">All expected mappings present ✓</div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            No roster row matches <span className="font-mono">{selectedUser.cal_poly_email}</span>.
                            {userRoles.some(r => r.role === "applicant") && userRoles.length === 1
                              ? " User is an applicant fallback — this is expected if not on the roster."
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Section label="App Roles" items={userRoles} render={r => <Badge key={r.id} variant="outline" className="text-[9px] font-mono">{r.role}</Badge>} />
                        <Section label="Cohort Memberships" items={userCohorts} render={c => (
                          <Badge key={c.id} className="text-[9px] font-mono gap-1">{(c.cohorts as any)?.name} <span className="opacity-60">({c.role})</span></Badge>
                        )} />
                        <Section label="Project Memberships" items={userProjects} render={p => (
                          <Badge key={p.id} variant="secondary" className="text-[9px] font-mono">{(p.projects as any)?.name} ({p.role_on_project})</Badge>
                        )} />
                        <Section label="Mock Project Memberships" items={userMockProjects} render={m => (
                          <Badge key={m.id} variant="secondary" className="text-[9px] font-mono">{(m.mock_projects as any)?.title} ({m.role_on_project})</Badge>
                        )} />
                        <Section label={`Channels (${userChannels.length})`} items={userChannels.slice(0, 15)} render={c => (
                          <Badge key={c.id} variant="outline" className="text-[9px] font-mono">
                            #{(c.channels as any)?.name}
                            {(c.channels as any)?.is_org_wide && <span className="ml-1 opacity-50">org</span>}
                          </Badge>
                        )} />

                        {/* Access summary */}
                        <div className="pt-2 border-t">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Access Summary</p>
                          <div className="space-y-1">
                            <AccessRow granted={userRoles.some(r => r.role === "admin" || r.role === "superadmin")} text="Admin/Superadmin — full system access" source="role" />
                            <AccessRow granted={userRoles.some(r => r.role === "member")} text="Member — can access app features" source="role" />
                            <AccessRow granted={userCohorts.length > 0} text={`Cohort access: ${userCohorts.map(c => (c.cohorts as any)?.name).join(", ") || "none"}`} source="cohort" />
                            <AccessRow granted={userProjects.length > 0} text={`Project access: ${userProjects.length} project(s)`} source="project" />
                            <AccessRow granted={userChannels.length > 0} text={`Channel access: ${userChannels.length} channel(s)`} source="role" />
                            {userCohorts.length > 0 && userChannels.length === 0 && (
                              <AccessRow granted={false} text="⚠ Has cohort but no channel memberships — may need channel seeding" source="visibility" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {auditLogs.length > 0 && (
                    <Card>
                      <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-sans">Recent Actions</CardTitle></CardHeader>
                      <CardContent className="pt-0 px-4 pb-3 space-y-1">
                        {auditLogs.map(log => (
                          <div key={log.id} className="flex items-center gap-2 py-1.5 text-[11px]">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-muted-foreground">on {log.target_type}</span>
                            <span className="ml-auto text-[9px] font-mono text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* PROJECT INSPECTION */}
        <TabsContent value="projects" className="mt-4">
          <ResourceInspectionPanel
            items={projects}
            selectedResource={resourceType === "project" ? selectedResource : null}
            onInspect={inspectProject}
            renderItem={(p: any) => ({ name: p.name, sub: `${p.project_mode} · ${p.status}` })}
            accessLines={resourceType === "project" ? accessLines : []}
            sourceColor={sourceColor}
            icon={<Package className="h-3.5 w-3.5" />}
            emptyText="Select a project to inspect access"
          />
        </TabsContent>

        {/* CHANNEL INSPECTION */}
        <TabsContent value="channels" className="mt-4">
          <ResourceInspectionPanel
            items={channels}
            selectedResource={resourceType === "channel" ? selectedResource : null}
            onInspect={inspectChannel}
            renderItem={(c: any) => ({ name: `#${c.name}`, sub: c.is_org_wide ? "org-wide" : (c.description || "private") })}
            accessLines={resourceType === "channel" ? accessLines : []}
            sourceColor={sourceColor}
            icon={<Hash className="h-3.5 w-3.5" />}
            emptyText="Select a channel to inspect access"
          />
        </TabsContent>

        {/* DOCUMENT INSPECTION */}
        <TabsContent value="documents" className="mt-4">
          <ResourceInspectionPanel
            items={documents}
            selectedResource={resourceType === "document" ? selectedResource : null}
            onInspect={inspectDocument}
            renderItem={(d: any) => ({ name: d.title, sub: `${d.doc_type} · ${d.visibility}` })}
            accessLines={resourceType === "document" ? accessLines : []}
            sourceColor={sourceColor}
            icon={<FileText className="h-3.5 w-3.5" />}
            emptyText="Select a document to inspect access"
          />
        </TabsContent>

        {/* IDENTITY CONFLICTS */}
        <TabsContent value="conflicts" className="mt-4 space-y-3">
          {rosterConflicts.length === 0 ? (
            <Card className="flex flex-col items-center py-12">
              <UserCheck className="h-10 w-10 text-success/30 mb-3" />
              <p className="text-sm text-muted-foreground">No identity conflicts to resolve.</p>
            </Card>
          ) : rosterConflicts.map((r: any) => (
            <motion.div key={r.id} variants={item}>
              <Card className="border-warning/30">
                <CardContent className="flex items-center gap-4 p-4">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{r.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.email || "No email"} · {r.cohort_name} · {r.role}</p>
                    <p className="text-[10px] text-warning mt-0.5">Name matched but email did not match signup</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-[10px] h-7" onClick={() => resolveConflict(r.id, "matched")}>
                      <UserCheck className="h-3 w-3" />Match
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-[10px] h-7 text-destructive" onClick={() => resolveConflict(r.id, "rejected")}>
                      <UserX className="h-3 w-3" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function Section({ label, items, render }: { label: string; items: any[]; render: (item: any) => React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-1 flex-wrap">
        {items.map(render)}
        {items.length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
      </div>
    </div>
  );
}

function AccessRow({ granted, text, source }: { granted: boolean; text: string; source: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {granted ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" /> : <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />}
      <span className={granted ? "" : "text-muted-foreground"}>{text}</span>
      <Badge variant="outline" className="text-[8px] font-mono ml-auto shrink-0">{source}</Badge>
    </div>
  );
}

function ResourceInspectionPanel({ items, selectedResource, onInspect, renderItem, accessLines, sourceColor, icon, emptyText }: {
  items: any[];
  selectedResource: any;
  onInspect: (item: any) => void;
  renderItem: (item: any) => { name: string; sub: string };
  accessLines: AccessLine[];
  sourceColor: Record<string, string>;
  icon: React.ReactNode;
  emptyText: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter(i => {
    const r = renderItem(i);
    return r.name.toLowerCase().includes(search.toLowerCase()) || r.sub.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {filtered.map(i => {
            const r = renderItem(i);
            return (
              <button key={i.id}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${selectedResource?.id === i.id ? "bg-accent/10 border border-accent/30" : "hover:bg-muted/40"}`}
                onClick={() => onInspect(i)}>
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{r.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="lg:col-span-8">
        {!selectedResource ? (
          <Card className="flex flex-col items-center py-16">
            <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </Card>
        ) : (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-sans flex items-center gap-2">
                {icon} {renderItem(selectedResource).name}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground font-mono">{renderItem(selectedResource).sub}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Access Rules</p>
              {accessLines.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  {line.granted ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                  <span className={line.granted ? "" : "text-muted-foreground"}>{line.reason}</span>
                  <Badge className={`text-[8px] font-mono ml-auto shrink-0 ${sourceColor[line.source] || ""}`}>{line.source}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
