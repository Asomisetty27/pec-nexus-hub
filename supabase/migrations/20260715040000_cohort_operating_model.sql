-- Cohort operating model v2: function-based assembly lines.
-- (Vault: "2026-07-15 - Cohort operating model v2".)
--
-- The old structure had a "Ops / PM" dumping ground (business majors, no
-- defined work) and no revenue or brand function at all. New model: every
-- cohort is a production line with named stages, a defined work unit, and a
-- Nexus-taught onboarding track (Orient -> Learn -> Shadow -> First Unit ->
-- Certified). Existing cohort rows are renamed IN PLACE so every FK
-- (cohort_memberships, projects.cohort_id, major_cohort_routing,
-- applicants.routed_cohort_id) is preserved.
--
-- Note: cohort_roster stores cohort_name as text; rows written before this
-- migration keep the old names. Matching there is primarily by email, so this
-- is cosmetic; the onboarding function reads the live cohort name at insert.

alter table public.cohorts add column if not exists function_key text;
alter table public.cohorts add column if not exists charter jsonb not null default '{}'::jsonb;
alter table public.cohorts add column if not exists assembly_line jsonb not null default '[]'::jsonb;
alter table public.cohorts add column if not exists onboarding_track jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 1. Business & Marketing (was "Ops / PM")
-- ---------------------------------------------------------------------------
update public.cohorts set
  name = 'Business & Marketing',
  description = 'Revenue and reach. Company Relations runs the client pipeline; Brand & Fundraising runs content, events, and fundraisers.',
  function_key = 'business_marketing',
  charter = jsonb_build_object(
    'mission', 'Keep the club funded, known, and supplied with signed client work.',
    'sections', jsonb_build_array(
      jsonb_build_object('key','company_relations','name','Company Relations','who','Business Administration, Economics, accounting-track','owns','The client pipeline end to end: sourcing through signed engagement and client care.'),
      jsonb_build_object('key','brand_fundraising','name','Brand & Fundraising','who','Marketing, Comms, Graphic Comm, Design','owns','Social presence, campus events, fundraisers, showcase assets.')
    ),
    'escalates', jsonb_build_array(
      'Fee decisions, contract signature, scope conflicts (president)',
      'External-facing content before certification (president sign-off)',
      'Spend beyond approved budget line'
    )
  ),
  assembly_line = jsonb_build_array(
    jsonb_build_object('section','company_relations','stage','Source','unit','A qualified prospect added to the CRM','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Research','unit','A one-page company brief attached to the org','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Outreach','unit','A first-touch email sent and logged','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Qualify','unit','A discovery call held and triaged','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Scope','unit','A scope one-pager with fee drafted','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Close','unit','A proposal sent; an engagement signed','where','/app/crm'),
    jsonb_build_object('section','company_relations','stage','Nurture','unit','A client check-in logged','where','/app/crm'),
    jsonb_build_object('section','brand_fundraising','stage','Plan','unit','A monthly content calendar drafted','where','/app/events'),
    jsonb_build_object('section','brand_fundraising','stage','Produce','unit','A post or asset finished in the queue','where','/app/qr'),
    jsonb_build_object('section','brand_fundraising','stage','Publish','unit','A post published on cadence','where','social channels'),
    jsonb_build_object('section','brand_fundraising','stage','Events','unit','A fundraiser or campus event run and recapped','where','/app/events'),
    jsonb_build_object('section','brand_fundraising','stage','Report','unit','Reach and funds metrics reported','where','/app/admin?tab=metrics')
  ),
  onboarding_track = jsonb_build_array(
    jsonb_build_object('step','Orient','detail','Read this charter; Role HQ states your week.'),
    jsonb_build_object('step','Learn','detail','Complete the outreach or content training drills.','where','/app/training'),
    jsonb_build_object('step','Shadow','detail','Sit in on one scope call or one post cycle.'),
    jsonb_build_object('step','First Unit','detail','Company Relations: 3 supervised outreach emails. Brand: 1 post from draft to published.'),
    jsonb_build_object('step','Certified','detail','You run the line; the queue feeds you.')
  )
where name = 'Ops / PM';

-- ---------------------------------------------------------------------------
-- 2. Delivery cohorts (shared Engagement OS line, discipline-specific who)
-- ---------------------------------------------------------------------------
with delivery_line as (
  select jsonb_build_array(
    jsonb_build_object('stage','Intake','unit','A signed charter and your named sprint-one artifact','where','/app/projects'),
    jsonb_build_object('stage','Build','unit','Progress on your artifact at the weekly working session','where','/app/projects'),
    jsonb_build_object('stage','Review','unit','Your artifact through peer and lead QA','where','/app/review'),
    jsonb_build_object('stage','Gate','unit','Your artifact demoed at the sprint gate','where','/app/events'),
    jsonb_build_object('stage','Ship','unit','Your piece of the client delivery','where','/app/projects'),
    jsonb_build_object('stage','Archive','unit','Case-study entry and pattern card','where','/app/docs')
  ) as line,
  jsonb_build_array(
    jsonb_build_object('step','Orient','detail','Read this charter; Role HQ states your week.'),
    jsonb_build_object('step','Learn','detail','Complete your discipline''s training drills.','where','/app/training'),
    jsonb_build_object('step','Shadow','detail','Attend one working session before your sprint starts.'),
    jsonb_build_object('step','First Unit','detail','Ship your named sprint-one artifact through gate review.'),
    jsonb_build_object('step','Certified','detail','You run the line; the sprint board feeds you.')
  ) as track
)
update public.cohorts c set
  name = v.new_name,
  description = v.new_desc,
  function_key = v.fkey,
  charter = jsonb_build_object(
    'mission', v.mission,
    'sections', '[]'::jsonb,
    'escalates', jsonb_build_array(
      'Blockers older than 3 days (lead, then VP)',
      'Scope changes a client asks for mid-sprint (VP)',
      'Anything that risks the gate date (VP immediately)'
    )
  ),
  assembly_line = d.line,
  onboarding_track = d.track
from delivery_line d,
(values
  ('Software / Systems', 'Software & AI Delivery',
   'Full-stack, data, automation, AI integration. The highest-demand consulting lane.',
   'software_ai',
   'Ship client software work: automation, AI integration, data, web and apps.'),
  ('Hardware / Systems / Embedded', 'Hardware & Embedded Delivery',
   'EE/CPE hardware, firmware, embedded, IoT. The rarest capability in student consulting.',
   'hardware_embedded',
   'Ship client hardware work: PCB, firmware, sensors, embedded systems.'),
  ('Mechanical / Manufacturing', 'Mechanical & Manufacturing Delivery',
   'CAD, prototyping, DFM. Built for SLO manufacturing and agtech.',
   'mech_manufacturing',
   'Ship client mechanical work: CAD, prototypes, manufacturing readiness.')
) as v(old_name, new_name, new_desc, fkey, mission)
where c.name = v.old_name;

-- ---------------------------------------------------------------------------
-- 3. Routing: business majors stay (row renamed under them); marketing majors
--    get routes; Industrial Technology & Packaging moves to Mechanical.
-- ---------------------------------------------------------------------------
update public.major_cohort_routing r
set cohort_id = (select id from public.cohorts where function_key = 'mech_manufacturing'),
    notes = 'Technical major; moved out of the old Ops bucket 2026-07-15'
where r.major = 'Industrial Technology and Packaging';

insert into public.major_cohort_routing (major, cohort_id, notes)
select m.major, (select id from public.cohorts where function_key = 'business_marketing'),
       'Brand & Fundraising section routing, added 2026-07-15'
from (values
  ('Marketing'),
  ('Communication Studies'),
  ('Journalism'),
  ('Graphic Communication'),
  ('Art and Design')
) as m(major)
where not exists (select 1 from public.major_cohort_routing x where x.major = m.major);
