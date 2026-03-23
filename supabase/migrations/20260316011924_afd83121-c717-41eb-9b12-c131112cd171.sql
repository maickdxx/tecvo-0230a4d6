
-- ============================================================
-- Evolução semântica: actor_user_id + subject_user_id
-- ============================================================

-- 1. Adicionar novas colunas (nullable, aditivo, zero risco)
ALTER TABLE public.time_clock_audit_log
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS subject_user_id uuid;

-- 2. Atualizar função de auditoria com semântica clara
CREATE OR REPLACE FUNCTION public.audit_time_clock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor      uuid;
  v_subject    uuid;
  v_org_id     uuid;
  v_record_id  uuid;
BEGIN
  -- Actor é sempre quem está autenticado
  v_actor := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_org_id    := OLD.organization_id;
    v_record_id := OLD.id;

    -- Resolver subject conforme a tabela
    IF TG_TABLE_NAME = 'time_clock_adjustments' THEN
      SELECT user_id INTO v_subject
      FROM public.time_clock_entries
      WHERE id = OLD.entry_id;
      -- Se entry_id não encontrado, subject fica NULL (entry pode ter sido removida por integridade)
    ELSE
      v_subject := OLD.user_id;
    END IF;

    INSERT INTO public.time_clock_audit_log
      (organization_id, user_id, actor_user_id, subject_user_id,
       action, table_name, record_id, old_data)
    VALUES
      (v_org_id, COALESCE(v_actor, v_subject), v_actor, v_subject,
       'DELETE', TG_TABLE_NAME, v_record_id, to_jsonb(OLD));
    RETURN OLD;

  ELSE
    -- INSERT or UPDATE
    v_org_id    := NEW.organization_id;
    v_record_id := NEW.id;

    IF TG_TABLE_NAME = 'time_clock_adjustments' THEN
      SELECT user_id INTO v_subject
      FROM public.time_clock_entries
      WHERE id = NEW.entry_id;
      -- subject_user_id = NULL é aceito: o entry_id tem FK constraint,
      -- então só seria NULL se a entry foi deletada por cascade.
      -- Não bloqueamos com exception para não impedir operações legítimas
      -- de auditoria em cenários de manutenção de dados.
    ELSE
      v_subject := NEW.user_id;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.time_clock_audit_log
        (organization_id, user_id, actor_user_id, subject_user_id,
         action, table_name, record_id, new_data)
      VALUES
        (v_org_id, COALESCE(v_actor, v_subject), v_actor, v_subject,
         'INSERT', TG_TABLE_NAME, v_record_id, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.time_clock_audit_log
        (organization_id, user_id, actor_user_id, subject_user_id,
         action, table_name, record_id, old_data, new_data)
      VALUES
        (v_org_id, COALESCE(v_actor, v_subject), v_actor, v_subject,
         'UPDATE', TG_TABLE_NAME, v_record_id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
