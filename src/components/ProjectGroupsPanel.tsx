import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Archive, UserPlus, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectName: string;
  members: any[];               // project members [{user_id, profiles:{full_name}, role_on_project}]
  canManage: boolean;           // PM/Lead/Admin
  currentUserId?: string;
}

export function ProjectGroupsPanel({ projectId, projectName, members, canManage }: Props) {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: gs, error } = await supabase
      .from("project_groups")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setGroups(gs || []);
    if (gs && gs.length) {
      const ids = gs.map((g: any) => g.id);
      const { data: gms } = await supabase
        .from("project_group_members")
        .select("group_id, user_id, profiles:user_id(full_name)")
        .in("group_id", ids);
      const map: Record<string, any[]> = {};
      (gms || []).forEach((m: any) => {
        (map[m.group_id] = map[m.group_id] || []).push(m);
      });
      setGroupMembers(map);
    } else {
      setGroupMembers({});
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const createGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string).trim();
    if (!name) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_groups").insert({
      project_id: projectId, name, created_by: user!.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Group created — chat "${projectName} – ${name}" auto-created.`);
    setOpen(false);
    load();
  };

  const addMember = async (groupId: string, userId: string) => {
    const { error } = await supabase.from("project_group_members").insert({ group_id: groupId, user_id: userId });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const removeMember = async (groupId: string, userId: string) => {
    const { error } = await supabase.from("project_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const archiveGroup = async (groupId: string) => {
    const { error } = await supabase.from("project_groups").update({ archived: true }).eq("id", groupId);
    if (error) { toast.error(error.message); return; }
    toast.success("Group archived");
    load();
  };

  const active = groups.filter(g => !g.archived);
  const archived = groups.filter(g => g.archived);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Sub-groups{active.length > 0 && <span className="font-mono">· {active.length}</span>}
        </h3>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> New group</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
              <form onSubmit={createGroup} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Group name</Label>
                  <Input name="name" required placeholder="e.g. Group A, Hardware sub-team" />
                  <p className="text-[10px] text-muted-foreground">A chat channel will be created automatically.</p>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>{creating ? "Creating…" : "Create group"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-3">Loading groups…</p>
      ) : active.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-4 text-center text-xs text-muted-foreground">
          {canManage ? "No groups yet. Create one to organize sub-teams." : "No sub-groups."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map(g => {
            const gm = groupMembers[g.id] || [];
            const memberIds = new Set(gm.map((m: any) => m.user_id));
            const candidates = members.filter(m => !memberIds.has(m.user_id));
            return (
              <Card key={g.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-2.5 w-2.5" /> chat auto-created · {gm.length} member{gm.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => archiveGroup(g.id)} title="Archive group">
                        <Archive className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {gm.map((m: any) => (
                      <Badge key={m.user_id} variant="outline" className="text-[10px] gap-1">
                        {(m.profiles as any)?.full_name || m.user_id.slice(0, 6)}
                        {canManage && (
                          <button type="button" onClick={() => removeMember(g.id, m.user_id)} className="ml-0.5 hover:text-destructive">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {gm.length === 0 && <span className="text-[10px] text-muted-foreground italic">no members yet</span>}
                  </div>
                  {canManage && candidates.length > 0 && (
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <UserPlus className="h-2.5 w-2.5" /> Add member
                      </summary>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {candidates.map(c => (
                          <button
                            key={c.user_id}
                            type="button"
                            onClick={() => addMember(g.id, c.user_id)}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent/10"
                          >
                            + {(c.profiles as any)?.full_name || c.user_id.slice(0, 6)}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="text-[10px] text-muted-foreground cursor-pointer">Archived ({archived.length})</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {archived.map(g => (
              <Badge key={g.id} variant="outline" className="text-[10px] opacity-60">{g.name}</Badge>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}