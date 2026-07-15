import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Pin, PinOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Announcements() {
  const { user, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    setAnnouncements(data || []);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const togglePin = async (a: any) => {
    const { error } = await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success(a.pinned ? "Unpinned" : "Pinned to top");
    fetchAnnouncements();
  };

  const remove = async (a: any) => {
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement deleted");
    fetchAnnouncements();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("announcements").insert([{
      title: f.get("title") as string,
      body: f.get("body") as string,
      author_id: user!.id,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted");
    setDialogOpen(false);
    fetchAnnouncements();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Announcements</h1>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                <div className="space-y-2"><Label>Body</Label><Textarea name="body" required rows={4} /></div>
                <Button type="submit" className="w-full">Post</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {announcements.length === 0 ? (
        <Card className="py-12 text-center"><Megaphone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" /><p className="text-muted-foreground">No announcements.</p></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin className="h-4 w-4 text-accent shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(a)} title={a.pinned ? "Unpin" : "Pin to top"}>
                        {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(a)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
