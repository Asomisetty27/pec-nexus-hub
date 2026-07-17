-- Messaging suite: unread tracking + @mention pinging.
-- The messages table already carries mentions (uuid[]), parent_id (replies),
-- reactions (jsonb), and updated_at (edits); this adds the two server-side
-- pieces the client cannot do alone.

-- 1. Per-user, per-channel read cursor. Drives unread badges. A user marks a
--    channel read (upsert last_read_at = now()) when they open it; unread =
--    messages in that channel newer than last_read_at, authored by others.
create table if not exists public.channel_read_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

alter table public.channel_read_state enable row level security;

drop policy if exists crs_own on public.channel_read_state;
create policy crs_own on public.channel_read_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Mention pinging: when a message lands with mentions, notify each
--    mentioned user (except the author). One notification per mention, deduped
--    per message+user so a client retry cannot double-ping.
create or replace function public.notify_message_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid;
  _author_name text;
  _channel_name text;
begin
  if new.mentions is null or array_length(new.mentions, 1) is null then
    return new;
  end if;

  select full_name into _author_name from public.profiles where user_id = new.author_id;
  select name into _channel_name from public.channels where id = new.channel_id;

  foreach _uid in array new.mentions loop
    if _uid is distinct from new.author_id then
      perform public.create_notification(
        _uid,
        'mention',
        coalesce(_author_name, 'Someone') || ' mentioned you in #' || coalesce(_channel_name, 'a channel'),
        left(new.content, 160),
        '/app/messages?channel=' || new.channel_id::text,
        new.author_id,
        'message',
        new.id,
        'normal',
        'mention-' || new.id::text || '-' || _uid::text,
        jsonb_build_object('channel_id', new.channel_id)
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_message_mentions on public.messages;
create trigger trg_notify_message_mentions
after insert on public.messages
for each row execute function public.notify_message_mentions();

-- Ensure channel_read_state changes stream over realtime (so unread badges
-- clear on other tabs/devices when a channel is read).
alter publication supabase_realtime add table public.channel_read_state;
