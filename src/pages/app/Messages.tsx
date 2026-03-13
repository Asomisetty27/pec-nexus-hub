import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Hash, AlertTriangle, CheckCircle2, Lightbulb, Zap } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const typeConfig: Record<string, { icon: any; bg: string; border: string }> = {
  update: { icon: Zap, bg: "bg-accent/5", border: "border-l-accent" },
  blocker: { icon: AlertTriangle, bg: "bg-destructive/5", border: "border-l-destructive" },
  decision: { icon: Lightbulb, bg: "bg-warning/5", border: "border-l-warning" },
  action: { icon: CheckCircle2, bg: "bg-success/5", border: "border-l-success" },
  message: { icon: MessageSquare, bg: "", border: "border-l-transparent" },
};

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

  const selectedChannelData = channels.find(c => c.id === selectedChannel);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Channel list */}
      <div className="w-56 shrink-0 space-y-1 hidden md:block overflow-auto">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 mb-2">Channels</p>
        {channels.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">No channels yet.</p>
        ) : (
          channels.map(ch => (
            <motion.button
              key={ch.id}
              whileHover={{ x: 2 }}
              onClick={() => setSelectedChannel(ch.id)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                selectedChannel === ch.id ? "bg-accent/10 text-foreground border border-accent/20" : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <Hash className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-xs">{ch.name}</span>
            </motion.button>
          ))
        )}
      </div>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-accent" />
              {selectedChannelData?.name || "Select a channel"}
            </CardTitle>
            {selectedChannelData?.description && (
              <span className="text-[10px] text-muted-foreground truncate max-w-xs">{selectedChannelData.description}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-4 space-y-2">
          {!selectedChannel ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <MessageSquare className="mr-2 h-5 w-5" /> Select a channel
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Start the conversation!</p>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg: any) => {
                const config = typeConfig[msg.message_type] || typeConfig.message;
                const TypeIcon = config.icon;
                const isOwn = msg.author_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`rounded-lg p-3 border-l-2 ${config.bg} ${config.border} ${isOwn ? "ml-12" : "mr-12"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{(msg.profiles as any)?.full_name || "Unknown"}</span>
                      {msg.message_type !== "message" && (
                        <Badge variant="outline" className="text-[9px] font-mono gap-1 py-0">
                          <TypeIcon className="h-2.5 w-2.5" />
                          {msg.message_type}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono ml-auto">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        {selectedChannel && (
          <div className="border-t p-3 flex gap-2 bg-card">
            <Select value={msgType} onValueChange={setMsgType}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
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
              className="flex-1 h-8 text-sm"
              onKeyDown={e => e.key === "Enter" && sendMessage()}
            />
            <Button size="sm" className="h-8 w-8 p-0" onClick={sendMessage}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
