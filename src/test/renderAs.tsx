// Test harness: render real pages as any role, with no credentials and no
// production data. Mocks the auth context and the Supabase client so page
// components run their true code paths (guards, queries, buttons) offline.
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

export type TestRole =
  | "applicant"
  | "member"
  | "project_consultant"
  | "project_lead"
  | "board_member"
  | "admin"
  | "superadmin"
  | "advisor";

export interface AuthShape {
  user: { id: string; email: string } | null;
  profile: Record<string, unknown> | null;
  roles: TestRole[];
  loading: boolean;
  highestRole: TestRole;
  isAdmin: boolean;
  isBoardOrAdmin: boolean;
  isAdvisor: boolean;
  hasRole: (r: string) => boolean;
  signOut: () => Promise<void>;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
}

export function authFor(role: TestRole, memberStatus = "active"): AuthShape {
  const isAdmin = role === "admin" || role === "superadmin";
  return {
    user: { id: `test-${role}`, email: `${role}@test.local` },
    profile: { user_id: `test-${role}`, full_name: `Test ${role}`, member_status: memberStatus, status: "active" },
    roles: [role],
    loading: false,
    highestRole: role,
    isAdmin,
    isBoardOrAdmin: isAdmin || role === "board_member",
    isAdvisor: role === "advisor",
    hasRole: (r: string) => r === role,
    signOut: async () => {},
    signIn: async () => {},
    signUp: async () => {},
  };
}

/** Chainable Supabase query stub: every terminal call resolves empty. */
export function supabaseStub(rows: unknown[] = []) {
  const result = { data: rows, error: null, count: rows.length };
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "update", "upsert", "delete", "eq", "neq", "in", "is", "not",
    "ilike", "like", "gt", "gte", "lt", "lte", "or", "order", "limit", "range", "filter",
  ];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: rows[0] ?? null, error: null }));
  chain.maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }));
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => result),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
  };
}

export function renderAt(ui: ReactElement, route = "/app") {
  // Mirror the app root: pages may use react-query (e.g. useClubStage), so the
  // harness must provide a QueryClient. Retries off so failed queries don't loop.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}
