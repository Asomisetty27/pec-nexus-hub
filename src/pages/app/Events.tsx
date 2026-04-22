import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, MapPin, Plus, Check, Clock, Pencil, Trash2, Ban, Mail, AlertTriangle, Link2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { logAuditAction } from "@/lib/audit";
import { Sparkles } from "lucide-react";
import { MeetingBriefDialog } from "@/components/MeetingBriefDialog";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

const AUDIENCE_OPTIONS = [
  { value: "all_members", label: "All members" },
  { value: "cohort", label: "One cohort" },
  { value: "project", label: "One project team" },
  { value: "pms", label: "PMs only" },
  { value: "tech_leads", label: "Tech Leads only" },
  { value: "leadership", label: "Leadership (PMs + Leads)" },
];

function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Events() {
  const { user, isAdmin } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [audience, setAudience] = useState<string>("all_members");
  const [eventCreatedFlag, setEventCreatedFlag] = useState(false);
  const [audienceTarget, setAudienceTarget] = useState<string>("");
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [briefEvent, setBriefEvent] = useState<any | null>(null);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("start_time", { ascending: true });
    setEvents(data || []);
    if (user) {
      const { data: rsvpData } = await supabase.from("event_rsvps").select("event_id").eq("user_id", user.id);
      const map: Record<string, boolean> = {};
      rsvpData?.forEach(r => { map[r.event_id] = true; });
      setRsvps(map);
    }
  };

  useEffect(() => {
    fetchEvents();
    supabase.from("cohorts").select("id, name").then(({ data }) => setCohorts(data || []));
    supabase.from("projects").select("id, name").eq("status", "active").then(({ data }) => setProjects(data || []));
  }, [user]);

  const canManage = (ev: any) => isAdmin || ev.created_by === user?.id;

  const sendNotification = async (eventId: string, kind: "created" | "updated" | "cancelled", extras: { changesSummary?: string; cancellationReason?: string } = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-event-notification", {
        body: { eventId, kind, ...extras },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.recipientCount === 0) {
        toast.message("Event saved", { description: "No recipients in audience — no email sent." });
      } else if (d?.failed > 0 && d?.sent > 0) {
        toast.warning(`Notification partial: ${d.sent} sent, ${d.failed} failed`);
      } else if (d?.failed > 0) {
        toast.error(`Event saved, but notification email failed for ${d.failed} recipient${d.failed === 1 ? "" : "s"}`);
      } else {
        toast.success(`Notification queued to ${d?.sent ?? 0} recipient${d?.sent === 1 ? "" : "s"}`);
      }
    } catch (e: any) {
      toast.error("Event saved, but notification email failed", { description: e.message });
    }
  };

  const handleRsvp = async (eventId: string) => {
    if (!user) return;
    if (rsvps[eventId]) {
      await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user.id);
    } else {
      await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user.id });
    }
    fetchEvents();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload: any = {
      title: f.get("title") as string,
      description: f.get("description") as string,
      event_type: (f.get("type") as any) || "other",
      location: f.get("location") as string,
      start_time: f.get("start_time") as string,
      meeting_link: (f.get("meeting_link") as string) || null,
      teams_link: (f.get("teams_link") as string) || null,
      audience_scope: audience,
      audience_target_id: (audience === "cohort" || audience === "project") ? (audienceTarget || null) : null,
      notify_on_create: notifyOnCreate,
      is_public: false,
      created_by: user!.id,
    };
    if (editing) {
      // detect changes
      const changes: string[] = [];
      if (editing.title !== payload.title) changes.push("title");
      if (editing.start_time !== payload.start_time) changes.push("date/time");
      if ((editing.location || "") !== (payload.location || "")) changes.push("location");
      if ((editing.meeting_link || "") !== (payload.meeting_link || "")) changes.push("link");
      if ((editing.description || "") !== (payload.description || "")) changes.push("description");
      if (editing.audience_scope !== payload.audience_scope || editing.audience_target_id !== payload.audience_target_id) changes.push("audience");

      const { error } = await supabase.from("events").update({ ...payload, updated_by: user!.id }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await logAuditAction("event.updated", "event", editing.id, { changes });
      toast.success("Event updated");
      setDialogOpen(false);
      const meaningful = changes.some(c => ["title","date/time","location","link","audience"].includes(c));
      if (meaningful) {
        await sendNotification(editing.id, "updated", { changesSummary: changes.join(", ") });
      }
      setEditing(null);
      fetchEvents();
    } else {
      const { data: created, error } = await supabase.from("events").insert([payload]).select("id").single();
      if (error) { toast.error(error.message); return; }
      await logAuditAction("event.created", "event", created.id, { audience_scope: audience });
      toast.success("Event created");
      setDialogOpen(false);
      if (notifyOnCreate) {
        await sendNotification(created.id, "created");
      }
      fetchEvents();
      setEventCreatedFlag(true);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setAudience("all_members");
    setAudienceTarget("");
    setNotifyOnCreate(true);
    setDialogOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditing(ev);
    setAudience(ev.audience_scope || "all_members");
    setAudienceTarget(ev.audience_target_id || "");
    setNotifyOnCreate(false);
    setDialogOpen(true);
  };

  const doCancel = async () => {
    if (!confirmCancel) return;
    const { error } = await supabase.from("events").update({
      cancelled: true,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancelReason || null,
      updated_by: user!.id,
    }).eq("id", confirmCancel.id);
    if (error) { toast.error(error.message); return; }
    await logAuditAction("event.cancelled", "event", confirmCancel.id, { reason: cancelReason });
    toast.success("Event cancelled");
    await sendNotification(confirmCancel.id, "cancelled", { cancellationReason: cancelReason });
    setConfirmCancel(null);
    setCancelReason("");
    fetchEvents();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAuditAction("event.deleted", "event", id);
    toast.success("Event deleted");
    setConfirmDelete(null);
    fetchEvents();
  };

  const upcoming = events.filter(e => new Date(e.start_time) >= new Date());
  const past = events.filter(e => new Date(e.start_time) < new Date());

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Events</h1>
          <p className="text-xs text-muted-foreground font-mono">{upcoming.length} upcoming · {past.length} past</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> New Event</Button>
        )}
      </motion.div>

      {eventCreatedFlag && (
        <FeedbackPrompt
          feature="event_create"
          prompt="Was creating that event quick?"
          options={[
            { label: "Yes", rating: "positive" },
            { label: "Okay", rating: "neutral" },
            { label: "Confusing", rating: "negative" },
          ]}
          onClose={() => setEventCreatedFlag(false)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit event" : "Create event"}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input name="title" required defaultValue={editing?.title || ""} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" defaultValue={editing?.description || ""} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue={editing?.event_type || "other"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input name="start_time" type="datetime-local" required defaultValue={editing ? toLocalInput(editing.start_time) : ""} />
              </div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input name="location" defaultValue={editing?.location || ""} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Meeting link (Zoom, Meet, etc.)</Label><Input name="meeting_link" type="url" placeholder="https://zoom.us/j/..." defaultValue={editing?.meeting_link || ""} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Microsoft Teams link (optional)</Label><Input name="teams_link" type="url" placeholder="https://teams.microsoft.com/l/meetup-join/..." defaultValue={editing?.teams_link || ""} /></div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {audience === "cohort" && (
                <Select value={audienceTarget} onValueChange={setAudienceTarget}>
                  <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                  <SelectContent>{cohorts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {audience === "project" && (
                <Select value={audienceTarget} onValueChange={setAudienceTarget}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>

            {!editing && (
              <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
                <input type="checkbox" checked={notifyOnCreate} onChange={e => setNotifyOnCreate(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Send notification email to audience now</span>
                  <span className="text-muted-foreground">Status reported truthfully — no fake "sent" if delivery fails.</span>
                </span>
              </label>
            )}

            <Button type="submit" className="w-full">{editing ? "Save changes" : "Create event"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No events scheduled</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(ev => {
            const isPast = new Date(ev.start_time) < new Date();
            const isCancelled = ev.cancelled;
            return (
              <motion.div key={ev.id} variants={item}>
                <Card className={`hover:border-accent/40 transition-all ${isPast ? "opacity-60" : ""} ${isCancelled ? "border-destructive/40" : ""}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-sans">{ev.title}</CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[9px] font-mono">{ev.event_type}</Badge>
                        {isCancelled && <Badge variant="destructive" className="text-[9px]">CANCELLED</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{ev.description || "No description"}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(ev.start_time).toLocaleDateString()} at {new Date(ev.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {ev.location && <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{ev.location}</div>}
                    {ev.meeting_link && (
                      <a href={ev.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-primary hover:underline">
                        <Link2 className="h-3 w-3" /> Join meeting
                      </a>
                    )}
                    {ev.teams_link && (
                      <a href={ev.teams_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] text-primary hover:underline">
                        <MessageSquare className="h-3 w-3" /> Open in Teams
                      </a>
                    )}
                    {!isPast && !isCancelled && (
                      <Button variant={rsvps[ev.id] ? "default" : "outline"} size="sm" className="w-full text-xs" onClick={() => handleRsvp(ev.id)}>
                        {rsvps[ev.id] ? <><Check className="mr-1 h-3 w-3" /> RSVP'd</> : "RSVP"}
                      </Button>
                    )}
                    {canManage(ev) && (
                      <div className="flex gap-1 pt-1 border-t border-border/40">
                        <Button variant="ghost" size="sm" className="h-7 flex-1 text-[11px] gap-1" onClick={() => openEdit(ev)}><Pencil className="h-3 w-3" />Edit</Button>
                        {!isCancelled && !isPast && (
                          <Button variant="ghost" size="sm" className="h-7 flex-1 text-[11px] gap-1 text-warning hover:text-warning" onClick={() => setConfirmCancel(ev)}><Ban className="h-3 w-3" />Cancel</Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 flex-1 text-[11px] gap-1 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(ev)}><Trash2 className="h-3 w-3" />Delete</Button>
                      </div>
                    )}
                    {!isCancelled && (
                      <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1" onClick={() => setBriefEvent(ev)}>
                        <Sparkles className="h-3 w-3" /> Pre-meeting brief
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{confirmDelete?.title}" and its RSVPs. Use Cancel instead if the event was already announced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => { if (!o) { setConfirmCancel(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel "{confirmCancel?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The event stays in the audit trail and a cancellation email is sent to the audience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason (optional, included in email)</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="e.g. Speaker had a conflict — rescheduling next week." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} className="bg-warning text-warning-foreground hover:bg-warning/90">Cancel event</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {briefEvent && (
        <MeetingBriefDialog
          open={!!briefEvent}
          onOpenChange={(o) => !o && setBriefEvent(null)}
          eventId={briefEvent.id}
          eventTitle={briefEvent.title}
        />
      )}
    </motion.div>
  );
}
