-- Found by the lifecycle simulation (2026-07-17): the apply form and the
-- submit-application zod schema offer ten source options, but the DB enum
-- had seven. Selecting "Club fair", "Search engine", or "Professor / advisor"
-- made the edge function 500 on insert ("invalid input value for enum
-- applicant_source"), burning the exact applicants WOW week produces.
-- Applied to staging and prod 2026-07-17.

alter type public.applicant_source add value if not exists 'search';
alter type public.applicant_source add value if not exists 'professor';
alter type public.applicant_source add value if not exists 'club_fair';
