import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Send, Hash, AlertTriangle, CheckCircle2,
  Lightbulb, Zap, HelpCircle, Globe, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const typeConfig: Record<string, { icon: any; bg: string; border: string; label: string }> = {
  update: { icon: Zap, bg: "bg-accent/5", border: "border-l-accent", label: "Update" },
  blocker: { icon: AlertTriangle, bg: "bg-destructive/5", border: "border-l-destructive", label: "Blocker" },
  decision: { icon: Lightbulb, bg: "bg-warning/5", border: "border-l-warning", label: "Decision" },
  action: { icon: CheckCircle2, bg: "bg-success/5", border: "border-l-success", label: "Action" },
  review_request: { icon: CheckCircle2, bg: "bg-primary/5", border: "border-l-primary", label: "Review Request" },
  help_request: { icon: HelpCircle, bg: "bg-warning/5", border: "border-l-warning", label: "Help Request" },
  announcement: { icon: Globe, bg: "bg-accent/10", border: "border-l-accent", label: "Announcement" },
  fyi: { icon: Lightbulb, bg: "bg-muted/30", border: "border-l-muted-foreground", label: "FYI" },
  message: { icon: MessageSquare, bg: "", border: "border-l-transparent", label: "Message" },
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
      const { data } = await supabase.from("channels").select("*").order("is_org_wide", { ascending: false }).order("name");
      setChannels(data || []);
      if (data && data.length > 0 && !selectedChannel) setSelectedChannel(data[0].id);
    };
    fetchChannels();
  }, []);

  useEffect(() => {
    if (!selectedChannel) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles:author_id(full_name)")
        .eq("channel_id", selectedChannel)
        .order("created_at")
        .limit(100);
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedChannel}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `channel_id=eq.${selectedChannel}`,
      }, async (payload) => {
        // Resolve author profile so realtime messages don't render as "Unknown".
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", (payload.new as any).author_id)
          .maybeSingle();
        setMessages(prev => [...prev, { ...payload.new, profiles: prof }]);
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

  // Group channels
  const orgWide = channels.filter(c => c.is_org_wide);
  const cohortChannels = channels.filter(c => !c.is_org_wide && c.name.includes("-cohort"));
  const leadershipChannels = channels.filter(c => !c.is_org_wide && !c.name.includes("-cohort") && !c.project_id);
  const projectChannels = channels.filter(c => c.project_id);

  const renderChannelGroup = (label: string, items: any[], icon: any) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground px-2 mb-1 flex items-center gap-1">
          <Icon className="h-2.5 w-2.5" />{label}
        </p>
        {items.map(ch => (
          <motion.button
            key={ch.id}
            whileHover={{ x: 2 }}
            onClick={() => setSelectedChannel(ch.id)}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
              selectedChannel === ch.id
                ? "bg-accent/10 text-foreground border border-accent/20"
                : "hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <Hash className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-xs">{ch.name}</span>
          </motion.button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Channel list */}
      <div className="w-56 shrink-0 space-y-0 hidden md:block overflow-auto pr-1">
        {renderChannelGroup("Global", orgWide, Globe)}
        {renderChannelGroup("Leadership", leadershipChannels, Lock)}
        {renderChannelGroup("Cohorts", cohortChannels, Hash)}
        {renderChannelGroup("Projects", projectChannels, MessageSquare)}
        {channels.length === 0 && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">No channels yet</p>
            <p>You'll be auto-joined to your cohort and announcement channels once an admin matches your account to the roster. Ping <span className="font-mono">somisett@calpoly.edu</span> if this is unexpected.</p>
          </div>
        )}
      </div>

      {/* Messages area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-sans font-semibold flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-accent-foreground" />
              {selectedChannelData?.name || "Select a channel"}
              {selectedChannelData?.is_org_wide && (
                <Badge variant="outline" className="text-[9px] font-mono">org-wide</Badge>
              )}
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
                      <span className="text-xs font-semibold">
                        {(msg.profiles as any)?.full_name
                          || (msg.profiles as any)?.cal_poly_email?.split("@")[0]
                          || "Former member"}
                      </span>
                      {msg.message_type !== "message" && (
                        <Badge variant="outline" className="text-[9px] font-mono gap-1 py-0">
                          <TypeIcon className="h-2.5 w-2.5" />
                          {config.label}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
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
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-1.5">
                      <cfg.icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </SelectItem>
                ))}
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
