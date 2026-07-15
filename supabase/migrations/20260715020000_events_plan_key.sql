-- events.plan_key: tags events created by the season calendar generator
-- (plan-season edge function) so a re-plan can cleanly replace a prior run and
-- an admin can unplan a whole season. Null for all hand-created events, so this
-- is inert for everything outside the generator.

alter table public.events add column if not exists plan_key text;

create index if not exists events_plan_key_idx
  on public.events (plan_key) where plan_key is not null;
