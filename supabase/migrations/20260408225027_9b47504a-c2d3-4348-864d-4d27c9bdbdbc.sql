ALTER TABLE public.pending_finance_actions 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 minutes');