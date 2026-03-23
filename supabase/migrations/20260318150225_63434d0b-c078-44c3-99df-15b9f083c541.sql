
CREATE OR REPLACE FUNCTION public.validate_entry_sequence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  last_entry_type public.time_clock_entry_type;
BEGIN
  -- Get the last entry type for this user on the same calendar day
  SELECT entry_type INTO last_entry_type
  FROM public.time_clock_entries
  WHERE user_id = NEW.user_id
    AND recorded_at::date = NEW.recorded_at::date
    AND id IS DISTINCT FROM NEW.id
  ORDER BY recorded_at DESC
  LIMIT 1;

  -- If no previous entry today, only clock_in is allowed
  IF last_entry_type IS NULL THEN
    IF NEW.entry_type != 'clock_in' THEN
      RAISE EXCEPTION 'Primeiro registro do dia deve ser uma entrada (clock_in). Tipo recebido: %', NEW.entry_type;
    END IF;
    RETURN NEW;
  END IF;

  -- Block consecutive same-type entries
  IF NEW.entry_type = last_entry_type THEN
    RAISE EXCEPTION 'Registro duplicado: já existe um "%" consecutivo. Solicite ajuste se necessário.', NEW.entry_type;
  END IF;

  -- Validate allowed transitions
  CASE last_entry_type
    WHEN 'clock_in' THEN
      IF NEW.entry_type NOT IN ('break_start', 'clock_out') THEN
        RAISE EXCEPTION 'Após entrada, apenas pausa ou saída são permitidos. Tipo recebido: %', NEW.entry_type;
      END IF;
    WHEN 'break_start' THEN
      IF NEW.entry_type != 'break_end' THEN
        RAISE EXCEPTION 'Após início de pausa, apenas retorno de pausa é permitido. Tipo recebido: %', NEW.entry_type;
      END IF;
    WHEN 'break_end' THEN
      IF NEW.entry_type NOT IN ('break_start', 'clock_out') THEN
        RAISE EXCEPTION 'Após retorno de pausa, apenas nova pausa ou saída são permitidos. Tipo recebido: %', NEW.entry_type;
      END IF;
    WHEN 'clock_out' THEN
      RAISE EXCEPTION 'Jornada já encerrada. Não é possível registrar novos pontos. Solicite ajuste se necessário.';
  END CASE;

  RETURN NEW;
END;
$function$;
