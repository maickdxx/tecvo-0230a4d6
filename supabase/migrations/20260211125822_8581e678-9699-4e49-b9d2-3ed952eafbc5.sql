
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to clean up old soft-deleted records
CREATE OR REPLACE FUNCTION public.cleanup_soft_deleted_records()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.service_items WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.transactions WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.services WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.clients WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.suppliers WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.catalog_services WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;

-- Schedule cleanup to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-soft-deleted-records',
  '0 3 * * *',
  'SELECT public.cleanup_soft_deleted_records()'
);
