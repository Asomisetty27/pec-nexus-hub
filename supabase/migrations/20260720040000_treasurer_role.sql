-- Treasurer role: the bylaws now define a Treasurer (Krithik) but the app had no
-- such role. Add it to app_role. Enum ADD VALUE must be committed before any
-- migration references the value, so this migration only adds it; the frontend
-- (auth AppRole union + roleHQ playbook) mirrors it, and any treasurer-gated
-- policy/function comes in a later migration.
alter type public.app_role add value if not exists 'treasurer';
