
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending_send',
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_provider_id text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

ALTER TABLE public.invite_tokens
  ADD CONSTRAINT invite_tokens_email_status_check
  CHECK (email_status IN ('pending_send', 'sent', 'failed', 'manual_only'));
