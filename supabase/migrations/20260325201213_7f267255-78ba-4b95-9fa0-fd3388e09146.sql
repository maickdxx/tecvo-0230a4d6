-- 1. Normalize existing service types to known slugs
UPDATE public.services SET service_type = 'limpeza' WHERE service_type IN ('cleaning', 'Limpeza');
UPDATE public.services SET service_type = 'instalacao' WHERE service_type IN ('installation', 'Instalação');
UPDATE public.services SET service_type = 'manutencao' WHERE service_type IN ('maintenance', 'Manutenção');
UPDATE public.services SET service_type = 'reparo' WHERE service_type IN ('repair', 'Reparo');
UPDATE public.services SET service_type = 'outros' WHERE service_type IN ('other', 'Outros');
UPDATE public.services SET service_type = 'contratos' WHERE service_type IN ('maintenance_contract', 'Contratos');
UPDATE public.services SET service_type = 'visita' WHERE service_type IN ('Visita Técnica', 'visita');

-- 2. Add recurrence flag to service_types
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS generates_recurrence BOOLEAN DEFAULT false;

-- 3. Set default recurrence for common types
UPDATE public.service_types SET generates_recurrence = true WHERE slug IN ('limpeza', 'instalacao');

-- 4. Ensure all used service types exist in the table for each organization
INSERT INTO public.service_types (organization_id, name, slug, is_default, generates_recurrence)
SELECT DISTINCT s.organization_id, INITCAP(s.service_type), s.service_type, false, (s.service_type IN ('limpeza', 'instalacao'))
FROM public.services s
LEFT JOIN public.service_types st ON s.organization_id = st.organization_id AND s.service_type = st.slug
WHERE st.id IS NULL AND s.service_type IS NOT NULL
ON CONFLICT (organization_id, slug) DO NOTHING;

-- 5. Add constraints for governance
-- Remove duplicates first if any (per org/slug)
DELETE FROM public.service_types a USING public.service_types b
WHERE a.id > b.id AND a.organization_id = b.organization_id AND a.slug = b.slug;

-- Make sure slugs are unique per organization
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_slug') THEN
    ALTER TABLE public.service_types ADD CONSTRAINT unique_org_slug UNIQUE (organization_id, slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_name') THEN
    ALTER TABLE public.service_types ADD CONSTRAINT unique_org_name UNIQUE (organization_id, name);
  END IF;
END $$;

-- 6. Update recurrence trigger to use the new flag
CREATE OR REPLACE FUNCTION public.auto_create_recurrence_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_generates_recurrence BOOLEAN;
BEGIN
  -- Check if this service type generates recurrence for this organization
  SELECT generates_recurrence INTO v_generates_recurrence
  FROM public.service_types
  WHERE organization_id = NEW.organization_id AND slug = NEW.service_type;

  IF NEW.status::text = 'completed' AND (OLD IS NULL OR OLD.status::text IS DISTINCT FROM 'completed')
     AND v_generates_recurrence = true
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
      (NEW.completed_date + interval '6 months')::date
    )
    ON CONFLICT (organization_id, client_id, source_service_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Add validation to services to prevent invalid types
CREATE OR REPLACE FUNCTION public.validate_service_type()
RETURNS trigger AS $$
BEGIN
  IF NEW.service_type IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_types 
    WHERE organization_id = NEW.organization_id AND slug = NEW.service_type
  ) THEN
    -- Fallback: If it's a new service and type is not in DB, try to find/create it or just fail
    -- For now, let's just fail to enforce governance
    RAISE EXCEPTION 'Tipo de serviço "%" não cadastrado para esta organização.', NEW.service_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_service_type ON public.services;
CREATE TRIGGER trigger_validate_service_type
BEFORE INSERT OR UPDATE OF service_type ON public.services
FOR EACH ROW EXECUTE FUNCTION public.validate_service_type();