
CREATE TABLE public.message_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone text NOT NULL,
  message_content text NOT NULL,
  message_type text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  source_function text,
  idempotency_key text,
  instance_name text DEFAULT 'tecvo',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_message_queue_idempotency ON public.message_send_queue (idempotency_key) WHERE idempotency_key IS NOT NULL AND status != 'cancelled';

CREATE INDEX idx_message_queue_pending ON public.message_send_queue (scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_message_queue_org ON public.message_send_queue (organization_id, status);

ALTER TABLE public.message_send_queue ENABLE ROW LEVEL SECURITY;

-- No public access - only service role
CREATE POLICY "Service role only" ON public.message_send_queue FOR ALL USING (false);
