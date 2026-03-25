-- 1. Remover trigger que depende do enum
DROP TRIGGER IF EXISTS trg_auto_recurrence_entry_insert ON public.services;

-- 2. Converter coluna service_type para text
ALTER TABLE public.services ALTER COLUMN service_type TYPE text USING service_type::text;

-- 3. Normalizar slugs para o padrão usado no frontend e catálogos
UPDATE public.services SET service_type = 'instalacao' WHERE service_type = 'installation';
UPDATE public.services SET service_type = 'manutencao' WHERE service_type = 'maintenance';
UPDATE public.services SET service_type = 'limpeza' WHERE service_type = 'cleaning';
UPDATE public.services SET service_type = 'reparo' WHERE service_type = 'repair';
UPDATE public.services SET service_type = 'contratos' WHERE service_type = 'maintenance_contract';
UPDATE public.services SET service_type = 'visita' WHERE service_type = 'visit';
UPDATE public.services SET service_type = 'orcamento' WHERE service_type = 'quote';
UPDATE public.services SET service_type = 'desinstalacao' WHERE service_type = 'uninstallation';
UPDATE public.services SET service_type = 'outros' WHERE service_type = 'other';

-- 4. Atualizar função de recorrência
CREATE OR REPLACE FUNCTION public.auto_create_recurrence_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text = 'completed' AND (OLD IS NULL OR OLD.status::text IS DISTINCT FROM 'completed')
     AND NEW.service_type IN ('cleaning', 'installation', 'limpeza', 'instalacao')
     AND NEW.client_id IS NOT NULL
     AND NEW.completed_date IS NOT NULL
  THEN
    -- Close all previous active entries
    UPDATE public.recurrence_entries
    SET is_active = false,
        closed_reason = 'reiniciado',
        closed_at = now(),
        stage = 'reiniciado',
        updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id
      AND is_active = true;

    -- Create new cycle
    INSERT INTO public.recurrence_entries (
      organization_id, client_id, source_service_id, source_service_type,
      source_completed_date, source_value, stage, next_action_date
    ) VALUES (
      NEW.organization_id, NEW.client_id, NEW.id, NEW.service_type,
      NEW.completed_date, NEW.value, 'aguardando',
      (NEW.completed_date + interval '2 months')::date
    )
    ON CONFLICT (organization_id, client_id, source_service_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Re-criar o trigger
CREATE TRIGGER trg_auto_recurrence_entry_insert 
AFTER INSERT OR UPDATE OF status ON public.services 
FOR EACH ROW 
WHEN (
    (new.status::text = 'completed'::text) 
    AND (new.service_type = ANY (ARRAY['cleaning', 'installation', 'limpeza', 'instalacao'])) 
    AND (new.client_id IS NOT NULL)
) 
EXECUTE FUNCTION auto_create_recurrence_entry();
