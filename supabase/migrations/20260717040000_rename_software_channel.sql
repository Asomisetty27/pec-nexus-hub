-- Lifecycle sim finding (2026-07-17): the software cohort's channels were
-- still named memvis-* (the dead pre-rename project name), but the channel
-- auto-join maps the Software cohort to the 'software' prefix. Result on prod:
-- software members joined announcements but NOT their cohort channel. Rename
-- to match the operating model. (staging seeded fresh with correct names;
-- this rename targets prod's existing memvis-* rows.)
update public.channels set name = 'software-general' where name = 'memvis-general';
update public.channels set name = 'software-help'    where name = 'memvis-help';
