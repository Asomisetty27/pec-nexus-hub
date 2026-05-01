import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCrmAccess } from "@/hooks/useCrmAccess";
import {
  LayoutDashboard,
  Columns3,
  UserSquare,
  Table as TableIcon,
  Users,
  CheckCircle2,
  BarChart3,
  Inbox,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface NavTab {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  leadershipOnly?: boolean;
}

const TABS: NavTab[] = [
  { to: "/app/crm/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/crm/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/app/crm/my", label: "My Companies", icon: UserSquare },
  { to: "/app/crm/table", label: "Table", icon: TableIcon },
  { to: "/app/crm/contacts", label: "Contacts", icon: Users },
  { to: "/app/crm/qualified", label: "Qualified", icon: CheckCircle2 },
  { to: "/app/crm/analytics", label: "Analytics", icon: BarChart3, leadershipOnly: true },
  { to: "/app/crm/legacy", label: "Legacy Inbound", icon: Inbox, leadershipOnly: true },
];

export default function CrmLayout() {
  const { loading, canAccess, isLeadership } = useCrmAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-64 animate-pulse rounded bg-muted/40" />
        <div className="h-32 animate-pulse rounded-lg bg-muted/30" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-lg font-semibold mb-1">Company Relations</h2>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to this surface. Contact an admin if you believe this is an error.
        </p>
      </Card>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.leadershipOnly || isLeadership);

  // Hide subnav on company detail pages so the focus stays on the company.
  const isDetail = /^\/app\/crm\/c\//.test(location.pathname);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div>
        <h1 className="font-display text-2xl font-bold">Company Relations</h1>
        <p className="text-sm text-muted-foreground">
          Organizational pipeline — projects, sponsors, speakers, judges, recruiting, and partnerships.
        </p>
      </div>

      {!isDetail && (
        <nav className="flex flex-wrap gap-1 border-b border-border/60">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[12px] font-medium transition-colors -mb-px border-b-2 ${
                    isActive
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      )}

      <Outlet />
    </div>
  );
}