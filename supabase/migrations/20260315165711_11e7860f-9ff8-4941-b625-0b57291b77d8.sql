
CREATE OR REPLACE FUNCTION public.check_whatsapp_owner_permission()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.whatsapp_owner IS DISTINCT FROM OLD.whatsapp_owner THEN
    IF NOT public.has_role(auth.uid(), 'owner') THEN
      RAISE EXCEPTION 'Apenas o proprietário pode alterar o WhatsApp da IA';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_whatsapp_owner_permission
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_whatsapp_owner_permission();
