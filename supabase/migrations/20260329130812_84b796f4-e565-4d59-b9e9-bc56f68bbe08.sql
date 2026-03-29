-- Step 1: Add columns
ALTER TABLE public.auto_message_log
  ADD COLUMN IF NOT EXISTS sent_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS send_status text NOT NULL DEFAULT 'sent';

-- Step 2: Backfill sent_date from sent_at
UPDATE public.auto_message_log
SET sent_date = (sent_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE sent_at IS NOT NULL;

-- Step 3: Remove duplicates for idempotent types, keeping only the earliest per (org, type, date)
DELETE FROM public.auto_message_log
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY organization_id, message_type, sent_date
      ORDER BY sent_at ASC
    ) AS rn
    FROM public.auto_message_log
    WHERE message_type IN ('weather', 'business_tip', 'broadcast')
  ) sub
  WHERE rn > 1
);

-- Step 4: Create partial unique index for daily-singleton automation types
CREATE UNIQUE INDEX uq_auto_message_idempotent
  ON public.auto_message_log (organization_id, message_type, sent_date)
  WHERE message_type IN ('weather', 'business_tip', 'broadcast');