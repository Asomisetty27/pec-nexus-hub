import {
  LayoutDashboard, FolderKanban, MessageSquare, Users, CalendarDays,
  Trophy, Briefcase, GraduationCap, FileText, BarChart3, Shield,
  Building2, Megaphone, Settings, LogOut, Beaker, Cpu,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const mainNav = [
  { title: "Mission Control", url: "/app", icon: LayoutDashboard },
  { title: "Cohort Hub", url: "/app/cohort", icon: Cpu },
  { title: "Projects", url: "/app/projects", icon: FolderKanban },
  { title: "Messages", url: "/app/messages", icon: MessageSquare },
  { title: "Events", url: "/app/events", icon: CalendarDays },
  { title: "Academy", url: "/app/academy", icon: GraduationCap },
];

const orgNav = [
  { title: "Members", url: "/app/members", icon: Users },
  { title: "Sponsors & CRM", url: "/app/crm", icon: Building2 },
  { title: "Competitions", url: "/app/competitions", icon: Trophy },
  { title: "Documents", url: "/app/docs", icon: FileText },
];

const adminNav = [
  { title: "Admin Console", url: "/app/admin", icon: Shield },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
  { title: "Announcements", url: "/app/announcements", icon: Megaphone },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, highestRole, signOut, isAdmin, isBoardOrAdmin } = useAuth();

  const isActive = (path: string) =>
    path === "/app" ? location.pathname === "/app" : location.pathname.startsWith(path);

  const renderItems = (items: typeof mainNav) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink to={item.url} end={item.url === "/app"} className="hover:bg-sidebar-accent/50 transition-all duration-150" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/app")} role="button">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary shadow-lg shadow-sidebar-primary/20">
            <span className="font-display text-sm font-bold text-sidebar-primary-foreground">P</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-base font-bold text-sidebar-foreground leading-tight">PEC Nexus</span>
              <span className="text-[10px] text-sidebar-foreground/50 font-mono uppercase tracking-wider">Mission Control</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono">Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isBoardOrAdmin || highestRole !== "applicant") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono">Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(orgNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-mono">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/30">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name || "User"}</span>
              <span className="text-[10px] font-mono text-sidebar-foreground/50 uppercase">{highestRole}</span>
            </div>
          )}
          {!collapsed && (
            <div className="flex gap-1">
              <button onClick={() => navigate("/app/settings")} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1" title="Settings">
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
