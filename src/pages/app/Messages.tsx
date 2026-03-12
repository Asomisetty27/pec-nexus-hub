import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Hash, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [msgType, setMsgType] = useState("message");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      const { data } = await supabase.from("channels").select("*").order("created_at");
      setChannels(data || []);
      if (data && data.length > 0 && !selectedChannel) setSelectedChannel(data[0].id);
    };
    fetchChannels();
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    const fetchMessages = async () => {
      const { data } = await supabase.from("messages").select("*, profiles:author_id(full_name)").eq("channel_id", selectedChannel).order("created_at").limit(100);
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${selectedChannel}` }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || !user) return;
    const { error } = await supabase.from("messages").insert({
      channel_id: selectedChannel,
      author_id: user.id,
      content: newMessage,
      message_type: msgType as any,
    });
    if (error) { toast.error(error.message); return; }
    setNewMessage("");
  };

  const typeColors: Record<string, string> = {
    update: "bg-primary/10 border-primary/30",
    blocker: "bg-destructive/10 border-destructive/30",
    decision: "bg-accent/10 border-accent/30",
    action: "bg-success/10 border-success/30",
    message: "",
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Channel list */}
      <div className="w-64 shrink-0 space-y-2 hidden md:block">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-bold">Channels</h2>
        </div>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">No channels yet. Admin can create channels.</p>
        ) : (
          channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedChannel === ch.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Hash className="h-4 w-4 shrink-0" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            {channels.find(c => c.id === selectedChannel)?.name || "Select a channel"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-4 space-y-3">
          {!selectedChannel ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="mr-2 h-5 w-5" /> Select a channel to start messaging
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg: any) => (
              <div key={msg.id} className={`rounded-lg p-3 ${typeColors[msg.message_type] || ""} ${msg.author_id === user?.id ? "ml-8" : "mr-8"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{(msg.profiles as any)?.full_name || "Unknown"}</span>
                  {msg.message_type !== "message" && (
                    <Badge variant="outline" className="text-[10px]">{msg.message_type}</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">{new Date(msg.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        {selectedChannel && (
          <div className="border-t p-3 flex gap-2">
            <Select value={msgType} onValueChange={setMsgType}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="blocker">Blocker</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="action">Action</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 h-9"
              onKeyDown={e => e.key === "Enter" && sendMessage()}
            />
            <Button size="sm" onClick={sendMessage}><Send className="h-4 w-4" /></Button>
          </div>
        )}
      </Card>
    </div>
  );
}
