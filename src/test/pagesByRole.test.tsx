// Tab-by-tab, role-by-role: render the real page components as each role
// and assert what that person actually sees. No credentials, no prod data.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { authFor, renderAt, supabaseStub, type TestRole } from "./renderAs";

const auth = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => auth.current,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseStub() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const as = (role: TestRole, memberStatus = "active") => {
  auth.current = authFor(role, memberStatus);
};

import { RoleHQ } from "@/components/RoleHQ";
import Admin from "@/pages/app/Admin";
import CommandCenter from "@/pages/app/CommandCenter";
import QrStudio from "@/pages/app/QrStudio";

beforeEach(() => {
  localStorage.clear();
});

describe("Role HQ renders each person's actual job", () => {
  const expectations: [TestRole, RegExp][] = [
    ["applicant", /Applicant/],
    ["member", /Member/],
    ["project_lead", /Tech Lead/],
    ["board_member", /VP/],
    ["admin", /President/],
    ["advisor", /Advisor/],
  ];

  // The role stamp is the authoritative "who am I" element on the page.
  const stampText = (container: HTMLElement) =>
    container.querySelector(".stamp")?.textContent ?? "";

  for (const [role, title] of expectations) {
    it(`${role} sees their own HQ`, () => {
      as(role);
      const { container } = renderAt(<RoleHQ />);
      expect(stampText(container)).toMatch(title);
      // Mission statement and at least one weekly duty must be present.
      expect(screen.getByText(/this week, in order/i)).toBeInTheDocument();
    });
  }

  it("alumni sees the alumni HQ even with a stale lead role", () => {
    as("project_lead", "alumni");
    const { container } = renderAt(<RoleHQ />);
    expect(stampText(container)).toMatch(/Alumni/);
  });

  it("weekly checklist buttons toggle and persist for the week", () => {
    as("member");
    renderAt(<RoleHQ />);
    const first = screen.getAllByRole("button", { pressed: false })[0];
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    // Persisted under a week-scoped key so it survives reloads, resets Monday.
    expect(Object.keys(localStorage).some((k) => k.startsWith("hq-member-"))).toBe(true);
  });

  it("decision rights drawer opens and names the escalation route", () => {
    as("member");
    renderAt(<RoleHQ />);
    fireEvent.click(screen.getByText(/decision rights/i));
    expect(screen.getByText(/you decide alone/i)).toBeInTheDocument();
    expect(screen.getByText(/escalation route/i)).toBeInTheDocument();
  });
});

describe("admin pages deny non-admins (guards, not just hidden nav)", () => {
  for (const role of ["member", "project_lead", "board_member", "applicant"] as TestRole[]) {
    it(`Admin console blocks ${role}`, () => {
      as(role);
      renderAt(<Admin />, "/app/admin");
      // The console's content must not render for a non-admin.
      expect(screen.queryByText(/Role Requests/i)).not.toBeInTheDocument();
    });

    it(`Command Center blocks ${role}`, () => {
      as(role);
      renderAt(<CommandCenter />, "/app/command");
      expect(screen.queryByText(/System Health/i)).not.toBeInTheDocument();
    });
  }

  it("admin reaches the console", () => {
    as("admin");
    const { container } = renderAt(<Admin />, "/app/admin");
    expect(container.textContent).not.toMatch(/don't have permission|not authorized/i);
  });
});

describe("QR Studio (marketing surface)", () => {
  it("renders presets and encodes the canonical domain with a source tag", async () => {
    as("admin");
    renderAt(<QrStudio />, "/app/qr");
    expect(screen.getByText(/WOW showcase flyer/i)).toBeInTheDocument();
    expect(await screen.findByText(/pecnexus\.com.*src=wow-flyer/i)).toBeInTheDocument();
  });

  it("switching preset re-encodes the link", async () => {
    as("admin");
    renderAt(<QrStudio />, "/app/qr");
    fireEvent.click(screen.getByText(/Client one-pager/i));
    expect(await screen.findByText(/\/intake\?src=client-onepager/i)).toBeInTheDocument();
  });
});
