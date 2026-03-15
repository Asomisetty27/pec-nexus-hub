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
import { CalendarDays, MapPin, Users, Plus, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function Events() {
  const { user, isAdmin } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

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

  useEffect(() => { fetchEvents(); }, [user]);

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
    const { error } = await supabase.from("events").insert([{
      title: f.get("title") as string,
      description: f.get("description") as string,
      event_type: (f.get("type") as any) || "other",
      location: f.get("location") as string,
      start_time: f.get("start_time") as string,
      is_public: false,
      created_by: user!.id,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Event created");
    setDialogOpen(false);
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea name="description" /></div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select name="type" defaultValue="other">
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
                <div className="space-y-2"><Label>Location</Label><Input name="location" /></div>
                <div className="space-y-2"><Label>Start Time</Label><Input name="start_time" type="datetime-local" required /></div>
                <Button type="submit" className="w-full">Create Event</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      {events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No events scheduled</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(ev => {
            const isPast = new Date(ev.start_time) < new Date();
            return (
              <motion.div key={ev.id} variants={item}>
                <Card className={`hover:border-accent/40 transition-all ${isPast ? "opacity-60" : ""}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-sans">{ev.title}</CardTitle>
                      <Badge variant="outline" className="text-[9px] font-mono">{ev.event_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{ev.description || "No description"}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(ev.start_time).toLocaleDateString()} at {new Date(ev.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {ev.location && <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{ev.location}</div>}
                    {!isPast && (
                      <Button variant={rsvps[ev.id] ? "default" : "outline"} size="sm" className="w-full text-xs" onClick={() => handleRsvp(ev.id)}>
                        {rsvps[ev.id] ? <><Check className="mr-1 h-3 w-3" /> RSVP'd</> : "RSVP"}
                      </Button>
                    )}
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
