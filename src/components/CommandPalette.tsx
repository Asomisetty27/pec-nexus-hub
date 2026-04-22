import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, FolderKanban, MessageSquare, Users, CalendarDays,
  Trophy, GraduationCap, FileText, BarChart3, Shield, Building2,
  Megaphone, Settings, Cpu, BookOpen, Target, Search, Zap, Clock, Pin,
} from "lucide-react";
import { useRecentItems } from "@/hooks/useRecentItems";

const staticPages = [
  { label: "Mission Control", path: "/app", icon: LayoutDashboard, group: "Navigate" },
  { label: "Cohort Hub", path: "/app/cohort", icon: Cpu, group: "Navigate" },
  { label: "Projects", path: "/app/projects", icon: FolderKanban, group: "Navigate" },
  { label: "Messages", path: "/app/messages", icon: MessageSquare, group: "Navigate" },
  { label: "Scheduling", path: "/app/scheduling", icon: CalendarDays, group: "Navigate" },
  { label: "Events", path: "/app/events", icon: CalendarDays, group: "Navigate" },
  { label: "Academy", path: "/app/academy", icon: GraduationCap, group: "Navigate" },
  { label: "Members", path: "/app/members", icon: Users, group: "Navigate" },
  { label: "Ops Command", path: "/app/ops", icon: Target, group: "Navigate" },
  { label: "Sponsors & CRM", path: "/app/crm", icon: Building2, group: "Navigate" },
  { label: "Competitions", path: "/app/competitions", icon: Trophy, group: "Navigate" },
  { label: "Documents", path: "/app/docs", icon: FileText, group: "Navigate" },
  { label: "Admin Console", path: "/app/admin", icon: Shield, group: "Navigate" },
  { label: "Permission Inspector", path: "/app/permissions", icon: Shield, group: "Navigate" },
  { label: "Analytics", path: "/app/analytics", icon: BarChart3, group: "Navigate" },
  { label: "Announcements", path: "/app/announcements", icon: Megaphone, group: "Navigate" },
  { label: "Settings", path: "/app/settings", icon: Settings, group: "Navigate" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [manuals, setManuals] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [knowledgeCards, setKnowledgeCards] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: recents, pinned } = useRecentItems(8);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    const openHandler = () => setOpen(true);
    window.addEventListener("pec:command-palette:open", openHandler);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("pec:command-palette:open", openHandler);
    };
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const [p, m, mem, kc] = await Promise.all([
        supabase.from("projects").select("id, name").order("name").limit(20),
        supabase.from("lab_manuals").select("id, title").limit(20),
        supabase.from("profiles").select("user_id, full_name").order("full_name").limit(30),
        supabase.from("knowledge_cards").select("id, title").order("created_at", { ascending: false }).limit(20),
      ]);
      setProjects(p.data || []);
      setManuals(m.data || []);
      setMembers(mem.data || []);
      setKnowledgeCards(kc.data || []);
    };
    load();
  }, [open, user]);

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
  }, [navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search everything... projects, manuals, members, pages" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {pinned.length > 0 && (
          <CommandGroup heading="Pinned">
            {pinned.map(p => (
              <CommandItem key={`pin-${p.id}`} onSelect={() => go(p.link)} className="gap-3">
                <Pin className="h-4 w-4 text-accent-foreground" />
                <span>{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {recents.length > 0 && (
          <>
            {pinned.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Recent">
              {recents.map(r => (
                <CommandItem key={`recent-${r.id}`} onSelect={() => go(r.link)} className="gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Pages">
          {staticPages.map(p => (
            <CommandItem key={p.path} onSelect={() => go(p.path)} className="gap-3">
              <p.icon className="h-4 w-4 text-muted-foreground" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map(p => (
                <CommandItem key={p.id} onSelect={() => go(`/app/projects/${p.id}`)} className="gap-3">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <span>{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {manuals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Lab Manuals">
              {manuals.map(m => (
                <CommandItem key={m.id} onSelect={() => go(`/app/lab/${m.id}`)} className="gap-3">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{m.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {knowledgeCards.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Knowledge Base">
              {knowledgeCards.map(k => (
                <CommandItem key={k.id} onSelect={() => go("/app/docs")} className="gap-3">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span>{k.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {members.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Members">
              {members.map(m => (
                <CommandItem key={m.user_id} onSelect={() => go("/app/members")} className="gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{m.full_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
