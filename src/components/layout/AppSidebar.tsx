import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  Compass,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth";
import { useCrmAccess } from "@/hooks/useCrmAccess";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Role = "superadmin" | "admin" | "board_member" | "project_lead" | "member" | "applicant" | string;

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  requiresAdmin?: boolean;
  requiresBoardOrAdmin?: boolean;
  requiresLeadAccess?: boolean;
  requiresAdvisorAccess?: boolean;
  requiresCrmAccess?: boolean;
  hideForApplicants?: boolean;
}

const GROUP_LABEL_CLASS = "font-mono text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/40";

const mainNav: NavItem[] = [
  { title: "Mission Control", url: "/app", icon: LayoutDashboard },
  { title: "Advisor Portal", url: "/app/advisor", icon: ShieldCheck, requiresAdvisorAccess: true },
  { title: "Purpose Track", url: "/app/purpose", icon: Compass, hideForApplicants: true },
  { title: "Projects", url: "/app/projects", icon: FolderKanban, hideForApplicants: true },
  { title: "Messages", url: "/app/messages", icon: MessageSquare, hideForApplicants: true },
  { title: "Events", url: "/app/events", icon: CalendarDays },
  { title: "Scheduling", url: "/app/scheduling", icon: CalendarDays, hideForApplicants: true },
  { title: "Training", url: "/app/training", icon: GraduationCap, hideForApplicants: true },
  { title: "Ask Nexus", url: "/app/ask", icon: Sparkles, hideForApplicants: true },
  {
    title: "Lead Workspace",
    url: "/app/lead",
    icon: Briefcase,
    requiresLeadAccess: true,
  },
];

const orgNav: NavItem[] = [
  { title: "Members", url: "/app/members", icon: Users, hideForApplicants: true },
  { title: "Company Relations", url: "/app/crm", icon: Building2, requiresCrmAccess: true },
  { title: "Documents", url: "/app/docs", icon: FileText, hideForApplicants: true },
];

const adminNav: NavItem[] = [
  { title: "Command Center", url: "/app/command", icon: Shield, requiresAdmin: true },
  { title: "Admin Console", url: "/app/admin", icon: Shield, requiresAdmin: true },
  { title: "Grind Admin", url: "/app/grind/admin", icon: Sparkles, requiresAdmin: true },
  { title: "Announcements", url: "/app/announcements", icon: Megaphone, requiresAdmin: true },
];

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  board_member: "Board",
  project_lead: "Project Lead",
  member: "Member",
  applicant: "Applicant",
};

function getInitials(fullName?: string | null): string {
  if (!fullName?.trim()) return "?";

  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRoleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, highestRole, signOut, isAdmin, isBoardOrAdmin } = useAuth();
  const { hasRole } = useAuth();
  const { canAccess: hasCrmAccess } = useCrmAccess();

  const initials = getInitials(profile?.full_name);

  const hasLeadAccess = isAdmin || isBoardOrAdmin || highestRole === "project_lead";
  const hasAdvisorAccess = isAdmin || hasRole("advisor");

  const isApplicant = highestRole === "applicant";

  const isActive = (path: string) => {
    if (path === "/app") return location.pathname === "/app";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const canViewItem = (item: NavItem) => {
    if (item.requiresAdmin && !isAdmin) return false;
    if (item.requiresBoardOrAdmin && !isBoardOrAdmin && !isAdmin) return false;
    if (item.requiresLeadAccess && !hasLeadAccess) return false;
    if (item.requiresAdvisorAccess && !hasAdvisorAccess) return false;
    if (item.requiresCrmAccess && !hasCrmAccess) return false;
    if (item.hideForApplicants && isApplicant) return false;
    return true;
  };

  const renderItems = (items: NavItem[]) =>
    items.filter(canViewItem).map((item) => {
      const Icon = item.icon;

      return (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild isActive={isActive(item.url)}>
            <NavLink
              to={item.url}
              end={item.url === "/app"}
              className="transition-all duration-150 hover:bg-sidebar-accent/50"
              activeClassName="bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-[13px]">{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const showOrganizationSection = orgNav.some(canViewItem) && (isBoardOrAdmin || !isApplicant);

  const showAdminSection = isAdmin && adminNav.some(canViewItem);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="flex w-full items-center gap-2.5 rounded-lg text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Go to Mission Control"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary shadow-lg shadow-sidebar-primary/20">
            <span className="font-display text-sm font-bold text-sidebar-primary-foreground">P</span>
          </div>

          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-display text-base font-bold leading-tight text-sidebar-foreground">
                PEC Nexus
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/40">
                Operating System
              </span>
            </div>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={GROUP_LABEL_CLASS}>Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showOrganizationSection && (
          <SidebarGroup>
            <SidebarGroupLabel className={GROUP_LABEL_CLASS}>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(orgNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showAdminSection && (
          <SidebarGroup>
            <SidebarGroupLabel className={GROUP_LABEL_CLASS}>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(adminNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/20">
            <AvatarFallback className="bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {profile?.full_name || "User"}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-sidebar-foreground/40">
                  {formatRoleLabel(highestRole)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigate("/app/settings")}
                  className="rounded-md p-1 text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  title="Settings"
                  aria-label="Open settings"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded-md p-1 text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
