import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquare, Send, Hash, AlertTriangle, CheckCircle2, Lightbulb, Zap,
  HelpCircle, Globe, Lock, SmilePlus, Reply, Pencil, Trash2, X, ArrowLeft, Check,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const typeConfig: Record<string, { icon: any; bar: string; label: string }> = {
  message: { icon: MessageSquare, bar: "", label: "Message" },
  update: { icon: Zap, bar: "border-l-accent", label: "Update" },
  blocker: { icon: AlertTriangle, bar: "border-l-destructive", label: "Blocker" },
  decision: { icon: Lightbulb, bar: "border-l-warning", label: "Decision" },
  action: { icon: CheckCircle2, bar: "border-l-success", label: "Action" },
  review_request: { icon: CheckCircle2, bar: "border-l-primary", label: "Review Request" },
  help_request: { icon: HelpCircle, bar: "border-l-warning", label: "Help Request" },
  announcement: { icon: Globe, bar: "border-l-accent", label: "Announcement" },
  fyi: { icon: Lightbulb, bar: "border-l-muted-foreground", label: "FYI" },
};

const QUICK_EMOJI = ["👍", "❤️", "🎉", "✅", "🚀", "👀", "🙏", "🔥"];
const AVATAR_HUES = [12, 200, 150, 280, 42, 330, 96, 260];

function hueFor(id?: string) {
  if (!id) return AVATAR_HUES[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
function initials(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
function Avatar({ id, name, size = 34 }: { id?: string; name?: string; size?: number }) {
  const hue = hueFor(id);
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 55% 42%)` }}
    >
      {initials(name)}
    </div>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

// Render message content with @mentions highlighted; the current user's own
// mention gets the accent treatment.
function renderContent(content: string, mentionNames: Set<string>, meNames: Set<string>) {
  const parts = content.split(/(@[\w][\w .'-]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const name = part.slice(1).trim();
      // match longest known mention name that this token starts with
      const hit = [...mentionNames].find((n) => name.toLowerCase().startsWith(n.toLowerCase()));
      if (hit) {
        const mine = meNames.has(hit.toLowerCase());
        const rest = part.slice(1 + hit.length);
        return (
          <span key={i}>
            <span className={mine
              ? "rounded bg-accent/20 px-1 font-medium text-accent-foreground"
              : "rounded bg-primary/10 px-1 font-medium text-primary"}>@{hit}</span>
            {rest}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

interface Member { user_id: string; full_name: string | null; }

function ReactionRow({ msg, userId, onToggle }: { msg: any; userId?: string; onToggle: (m: any, e: string) => void }) {
  const reactions = (msg.reactions && typeof msg.reactions === "object") ? msg.reactions : {};
  const entries = (Object.entries(reactions) as [string, string[]][]).filter(([, u]) => Array.isArray(u) && u.length);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {entries.map(([emoji, users]) => {
        const mine = !!userId && users.includes(userId);
        return (
          <button key={emoji} type="button" onClick={() => onToggle(msg, emoji)}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
              mine ? "bg-accent/15 border-accent/40 text-foreground" : "bg-muted/40 border-border hover:bg-muted/70"}`}>
            <span>{emoji}</span><span className="font-mono text-[10px]">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState("");
  const [msgType, setMsgType] = useState("message");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [typers, setTypers] = useState<Record<string, string>>({});
  const [showChannelsMobile, setShowChannelsMobile] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const presenceRef = useRef<any>(null);
  const readAtRef = useRef<Record<string, string>>({});

  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => x.full_name && m.set(x.user_id, x.full_name));
    return m;
  }, [members]);
  const mentionNames = useMemo(() => new Set(members.map((m) => m.full_name || "").filter(Boolean)), [members]);
  const meNames = useMemo(() => {
    const s = new Set<string>();
    const mine = members.find((m) => m.user_id === user?.id)?.full_name;
    if (mine) s.add(mine.toLowerCase());
    return s;
  }, [members, user]);

  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  // ---- initial load: channels, members, read state ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ch }, { data: mem }, { data: reads }] = await Promise.all([
        supabase.from("channels").select("*").order("is_org_wide", { ascending: false }).order("name"),
        supabase.from("profiles").select("user_id, full_name").eq("member_status", "active"),
        supabase.from("channel_read_state" as any).select("channel_id, last_read_at").eq("user_id", user.id),
      ]);
      setChannels(ch || []);
      setMembers((mem as any) || []);
      const map: Record<string, string> = {};
      ((reads as any[]) || []).forEach((r) => { map[r.channel_id] = r.last_read_at; });
      readAtRef.current = map;
      const wanted = params.get("channel");
      const initial = (ch || []).find((c) => c.id === wanted)?.id || (ch || [])[0]?.id || null;
      setSelectedChannel(initial);
      computeUnread(ch || [], map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const computeUnread = useCallback(async (chs: any[], reads: Record<string, string>) => {
    if (!user || chs.length === 0) return;
    const counts: Record<string, number> = {};
    await Promise.all(chs.map(async (c) => {
      const since = reads[c.id];
      let q = supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("channel_id", c.id).neq("author_id", user.id);
      if (since) q = q.gt("created_at", since);
      const { count } = await q;
      if ((count ?? 0) > 0) counts[c.id] = count as number;
    }));
    setUnread(counts);
  }, [user]);

  // ---- global mention ping (fires anywhere in the app-open session) ----
  useEffect(() => {
    if (!user) return;
    const sub = supabase.channel("global-mentions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as any;
        if (m.author_id === user.id) return;
        if (Array.isArray(m.mentions) && m.mentions.includes(user.id) && m.channel_id !== selectedChannel) {
          const who = memberName.get(m.author_id) || "Someone";
          toast(`${who} mentioned you`, { description: (m.content || "").slice(0, 80), icon: "💬" });
          setUnread((u) => ({ ...u, [m.channel_id]: (u[m.channel_id] || 0) + 1 }));
        }
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, selectedChannel, memberName]);

  // ---- per-channel: load messages, realtime, presence, mark read ----
  useEffect(() => {
    if (!selectedChannel || !user) return;
    let active = true;

    (async () => {
      const { data } = await supabase.from("messages")
        .select("*, profiles:author_id(full_name)")
        .eq("channel_id", selectedChannel).order("created_at").limit(200);
      if (!active) return;
      setMessages(data || []);
      scrollDown();
      markRead(selectedChannel);
    })();

    const rt = supabase.channel(`msg-${selectedChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${selectedChannel}` },
        async (payload) => {
          const m = payload.new as any;
          const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", m.author_id).maybeSingle();
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, { ...m, profiles: prof }]);
          scrollDown();
          if (m.author_id !== user.id) markRead(selectedChannel);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${selectedChannel}` },
        (payload) => setMessages((prev) => prev.map((x) => x.id === (payload.new as any).id ? { ...x, ...payload.new } : x)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${selectedChannel}` },
        (payload) => setMessages((prev) => prev.filter((x) => x.id !== (payload.old as any).id)))
      .subscribe();

    // presence-based typing indicator
    const pres = supabase.channel(`typing-${selectedChannel}`, { config: { presence: { key: user.id } } });
    pres.on("presence", { event: "sync" }, () => {
      const state = pres.presenceState() as Record<string, any[]>;
      const t: Record<string, string> = {};
      Object.entries(state).forEach(([uid, metas]) => {
        const meta = metas[0] as any;
        if (uid !== user.id && meta?.typing) t[uid] = meta.name || "Someone";
      });
      setTypers(t);
    }).subscribe();
    presenceRef.current = pres;

    return () => { active = false; supabase.removeChannel(rt); supabase.removeChannel(pres); presenceRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel, user]);

  const markRead = useCallback(async (channelId: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    readAtRef.current[channelId] = now;
    setUnread((u) => { const c = { ...u }; delete c[channelId]; return c; });
    await supabase.from("channel_read_state" as any).upsert(
      { user_id: user.id, channel_id: channelId, last_read_at: now }, { onConflict: "user_id,channel_id" });
  }, [user]);

  // ---- typing broadcast (throttled) ----
  const typingTimer = useRef<any>(null);
  const signalTyping = () => {
    const p = presenceRef.current; if (!p) return;
    const name = memberName.get(user!.id) || "Someone";
    p.track({ typing: true, name });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => p.track({ typing: false, name }), 2500);
  };

  // ---- mention autocomplete detection ----
  const onInput = (val: string) => {
    setNewMessage(val);
    signalTyping();
    const caret = inputRef.current?.selectionStart ?? val.length;
    const upto = val.slice(0, caret);
    const m = upto.match(/@([\w .'-]*)$/);
    setMentionQuery(m ? m[1] : null);
  };
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.full_name && m.user_id !== user?.id
      && m.full_name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, members, user]);

  const insertMention = (m: Member) => {
    const caret = inputRef.current?.selectionStart ?? newMessage.length;
    const before = newMessage.slice(0, caret).replace(/@([\w .'-]*)$/, `@${m.full_name} `);
    const after = newMessage.slice(caret);
    setNewMessage(before + after);
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // resolve @Names in the text to member ids for the mentions[] column
  const resolveMentions = (text: string): string[] => {
    const ids = new Set<string>();
    for (const m of members) {
      if (m.full_name && text.includes(`@${m.full_name}`)) ids.add(m.user_id);
    }
    return [...ids];
  };

  const send = async () => {
    const content = newMessage.trim();
    if (!content || !selectedChannel || !user) return;

    if (editing) {
      const mentions = resolveMentions(content);
      const { error } = await supabase.from("messages")
        .update({ content, mentions, updated_at: new Date().toISOString() }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      setEditing(null); setNewMessage(""); setMentionQuery(null);
      return;
    }

    const mentions = resolveMentions(content);
    const { error } = await supabase.from("messages").insert({
      channel_id: selectedChannel, author_id: user.id, content,
      message_type: msgType as any, mentions, parent_id: replyTo?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setNewMessage(""); setReplyTo(null); setMentionQuery(null);
    presenceRef.current?.track({ typing: false, name: memberName.get(user.id) || "" });
  };

  const toggleReaction = async (msg: any, emoji: string) => {
    if (!user) return;
    const current = (msg.reactions && typeof msg.reactions === "object") ? { ...msg.reactions } : {};
    const list: string[] = Array.isArray(current[emoji]) ? [...current[emoji]] : [];
    const i = list.indexOf(user.id);
    if (i >= 0) list.splice(i, 1); else list.push(user.id);
    if (list.length === 0) delete current[emoji]; else current[emoji] = list;
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, reactions: current } : m));
    const { error } = await supabase.from("messages").update({ reactions: current }).eq("id", msg.id);
    if (error) setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
  };

  const del = async (msg: any) => {
    if (!confirm("Delete this message?")) return;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    const { error } = await supabase.from("messages").delete().eq("id", msg.id);
    if (error) toast.error(error.message);
  };
  const startEdit = (msg: any) => {
    setEditing(msg); setReplyTo(null); setNewMessage(msg.content);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectChannel = (id: string) => {
    setSelectedChannel(id); setShowChannelsMobile(false); setEditing(null); setReplyTo(null);
    setParams((p) => { p.set("channel", id); return p; }, { replace: true });
  };

  const selectedData = channels.find((c) => c.id === selectedChannel);
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  // channel grouping
  const orgWide = channels.filter((c) => c.is_org_wide);
  const cohortCh = channels.filter((c) => !c.is_org_wide && /-general|-help/.test(c.name) && !c.project_id);
  const leadershipCh = channels.filter((c) => !c.is_org_wide && !/-general|-help/.test(c.name) && !c.project_id);
  const projectCh = channels.filter((c) => c.project_id);

  const ChannelBtn = ({ ch }: { ch: any }) => {
    const n = unread[ch.id] || 0;
    const active = selectedChannel === ch.id;
    return (
      <button onClick={() => selectChannel(ch.id)}
        className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-all ${
          active ? "bg-accent/10 text-foreground" : n > 0 ? "text-foreground hover:bg-muted/50" : "text-muted-foreground hover:bg-muted/50"}`}>
        <Hash className={`h-3.5 w-3.5 shrink-0 ${active ? "text-accent-foreground" : ""}`} />
        <span className={`truncate text-xs flex-1 text-left ${n > 0 && !active ? "font-semibold" : ""}`}>{ch.name}</span>
        {n > 0 && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-mono font-semibold text-accent-foreground leading-4">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
    );
  };
  const Group = ({ label, items, icon: Icon }: { label: string; items: any[]; icon: any }) =>
    items.length === 0 ? null : (
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground px-2 mb-1 flex items-center gap-1">
          <Icon className="h-2.5 w-2.5" />{label}
        </p>
        {items.map((ch) => <ChannelBtn key={ch.id} ch={ch} />)}
      </div>
    );

  const Sidebar = (
    <div className="space-y-0 overflow-auto pr-1 h-full">
      <Group label="Global" items={orgWide} icon={Globe} />
      <Group label="Leadership" items={leadershipCh} icon={Lock} />
      <Group label="Cohorts" items={cohortCh} icon={Hash} />
      <Group label="Projects" items={projectCh} icon={MessageSquare} />
      {channels.length === 0 && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">No channels yet</p>
          <p>You are auto-joined to your cohort and announcement channels once your account is matched to the roster.</p>
        </div>
      )}
    </div>
  );

  const typingLabel = Object.values(typers);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="w-56 shrink-0 hidden md:block">{Sidebar}</div>

      {/* mobile channel drawer */}
      <AnimatePresence>
        {showChannelsMobile && (
          <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            className="fixed inset-y-0 left-0 z-40 w-64 bg-card border-r p-3 md:hidden overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Channels</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowChannelsMobile(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {Sidebar}
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* header */}
        <div className="border-b py-2.5 px-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden relative" onClick={() => setShowChannelsMobile(true)}>
            <MessageSquare className="h-4 w-4" />
            {totalUnread > 0 && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent" />}
          </Button>
          <Hash className="h-4 w-4 text-accent-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{selectedData?.name || "Select a channel"}</span>
          {selectedData?.is_org_wide && <Badge variant="outline" className="text-[9px] font-mono">org-wide</Badge>}
          {selectedData?.description && (
            <span className="text-[10px] text-muted-foreground truncate ml-2 hidden sm:inline">{selectedData.description}</span>
          )}
        </div>

        {/* messages */}
        <div className="flex-1 overflow-auto px-2 py-3">
          {!selectedChannel ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <MessageSquare className="mr-2 h-5 w-5" /> Select a channel
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">No messages yet. Start the conversation.</p>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const cfg = typeConfig[msg.message_type] || typeConfig.message;
                const TypeIcon = cfg.icon;
                const isOwn = msg.author_id === user?.id;
                const authorName = (msg.profiles as any)?.full_name || memberName.get(msg.author_id) || "Former member";
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                const grouped = !newDay && prev && prev.author_id === msg.author_id && !prev.parent_id
                  && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000)
                  && msg.message_type === "message";
                const parent = msg.parent_id ? messages.find((m) => m.id === msg.parent_id) : null;
                const edited = msg.updated_at && new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 2000;

                return (
                  <div key={msg.id}>
                    {newDay && (
                      <div className="flex items-center gap-3 my-3 px-2">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{dayLabel(msg.created_at)}</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}
                      className={`group relative flex gap-2.5 rounded-md px-2 hover:bg-muted/30 ${grouped ? "py-0.5" : "pt-1.5 pb-0.5 mt-1"} ${cfg.bar ? "border-l-2 " + cfg.bar : ""}`}>
                      <div className="w-[34px] shrink-0 pt-0.5">
                        {!grouped && <Avatar id={msg.author_id} name={authorName} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold">{authorName}</span>
                            {msg.message_type !== "message" && (
                              <Badge variant="outline" className="text-[9px] font-mono gap-1 py-0"><TypeIcon className="h-2.5 w-2.5" />{cfg.label}</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        {parent && (
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground border-l-2 border-border pl-2">
                            <Reply className="h-3 w-3" />
                            <span className="font-medium">{(parent.profiles as any)?.full_name || memberName.get(parent.author_id) || "?"}</span>
                            <span className="truncate max-w-[240px] opacity-80">{parent.content}</span>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {renderContent(msg.content, mentionNames, meNames)}
                          {edited && <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>}
                        </p>
                        <ReactionRow msg={msg} userId={user?.id} onToggle={toggleReaction} />
                      </div>

                      {/* hover action bar */}
                      <div className="absolute -top-3 right-2 hidden group-hover:flex items-center gap-0.5 rounded-md border bg-card px-1 py-0.5 shadow-sm">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="rounded p-1 hover:bg-muted/70 text-muted-foreground" aria-label="React"><SmilePlus className="h-3.5 w-3.5" /></button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1.5"><div className="flex gap-0.5">
                            {QUICK_EMOJI.map((e) => (
                              <button key={e} onClick={() => toggleReaction(msg, e)} className="rounded p-1 text-base hover:bg-muted/70">{e}</button>
                            ))}
                          </div></PopoverContent>
                        </Popover>
                        <button onClick={() => { setReplyTo(msg); setEditing(null); inputRef.current?.focus(); }}
                          className="rounded p-1 hover:bg-muted/70 text-muted-foreground" aria-label="Reply"><Reply className="h-3.5 w-3.5" /></button>
                        {isOwn && <button onClick={() => startEdit(msg)} className="rounded p-1 hover:bg-muted/70 text-muted-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                        {isOwn && <button onClick={() => del(msg)} className="rounded p-1 hover:bg-muted/70 text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={endRef} />
        </div>

        {/* typing indicator */}
        {typingLabel.length > 0 && (
          <div className="px-4 py-0.5 text-[11px] text-muted-foreground italic">
            {typingLabel.length === 1 ? `${typingLabel[0]} is typing` : `${typingLabel.length} people are typing`}
            <span className="ml-0.5 animate-pulse">…</span>
          </div>
        )}

        {/* composer */}
        {selectedChannel && (
          <div className="border-t bg-card">
            {(replyTo || editing) && (
              <div className="flex items-center gap-2 px-3 pt-2 text-[11px] text-muted-foreground">
                {editing ? <Pencil className="h-3 w-3" /> : <Reply className="h-3 w-3" />}
                <span>{editing ? "Editing message" : `Replying to ${(replyTo.profiles as any)?.full_name || memberName.get(replyTo.author_id) || "?"}`}</span>
                <span className="truncate max-w-[280px] opacity-70">{(editing || replyTo).content}</span>
                <button className="ml-auto rounded p-0.5 hover:bg-muted/70" onClick={() => { setReplyTo(null); setEditing(null); setNewMessage(""); }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="relative p-3 flex items-end gap-2">
              {/* mention autocomplete */}
              {mentionMatches.length > 0 && (
                <div className="absolute bottom-full left-3 mb-1 w-64 rounded-lg border bg-card shadow-lg overflow-hidden z-10">
                  {mentionMatches.map((m) => (
                    <button key={m.user_id} onClick={() => insertMention(m)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-muted/60 text-left">
                      <Avatar id={m.user_id} name={m.full_name || ""} size={22} />
                      <span className="truncate">{m.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {!editing && (
                <Select value={msgType} onValueChange={setMsgType}>
                  <SelectTrigger className="w-[38px] h-9 px-0 justify-center shrink-0" aria-label="Message type">
                    {(() => { const I = (typeConfig[msgType] || typeConfig.message).icon; return <I className="h-3.5 w-3.5" />; })()}
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}><span className="flex items-center gap-1.5"><cfg.icon className="h-3 w-3" />{cfg.label}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => onInput(e.target.value)}
                placeholder={editing ? "Edit your message…" : `Message #${selectedData?.name || ""}   ·   @ to mention`}
                rows={1}
                className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm leading-relaxed max-h-32 focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setMentionQuery(null); setEditing(null); setReplyTo(null); }
                  if (e.key === "Enter" && !e.shiftKey && mentionMatches.length === 0) { e.preventDefault(); send(); }
                  if (e.key === "Enter" && mentionMatches.length > 0) { e.preventDefault(); insertMention(mentionMatches[0]); }
                }}
              />
              <Button size="sm" className="h-9 w-9 p-0 shrink-0" onClick={send} disabled={!newMessage.trim()}>
                {editing ? <Check className="h-4 w-4" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
