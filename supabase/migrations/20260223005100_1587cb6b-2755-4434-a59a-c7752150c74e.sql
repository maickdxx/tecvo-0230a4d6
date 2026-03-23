
ALTER TABLE public.organizations ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';

-- Backfill timezone based on existing state data
UPDATE public.organizations SET timezone = CASE
  WHEN state IN ('AC') THEN 'America/Rio_Branco'
  WHEN state IN ('AM', 'RR', 'RO') THEN 'America/Manaus'
  WHEN state IN ('MT', 'MS') THEN 'America/Cuiaba'
  WHEN state IN ('TO', 'AP', 'PA', 'MA') THEN 'America/Belem'
  WHEN state IN ('FN') THEN 'America/Noronha'
  ELSE 'America/Sao_Paulo'
END
WHERE state IS NOT NULL;
