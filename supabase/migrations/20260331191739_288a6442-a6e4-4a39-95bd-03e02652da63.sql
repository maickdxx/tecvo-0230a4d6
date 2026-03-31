CREATE OR REPLACE FUNCTION public.sync_contact_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  msg_time timestamptz;
  current_last_message_at timestamptz;
  preview text;
  clean_content text;
BEGIN
  msg_time := COALESCE(NEW.timestamp, NEW.created_at, now());

  SELECT last_message_at INTO current_last_message_at
  FROM public.whatsapp_contacts
  WHERE id = NEW.contact_id;

  IF current_last_message_at IS NULL OR msg_time >= current_last_message_at THEN
    -- Strip attendant signature pattern "*Name:*\n" from content for preview
    clean_content := NEW.content;
    IF clean_content IS NOT NULL AND clean_content LIKE '*%:*' || chr(10) || '%' THEN
      clean_content := regexp_replace(clean_content, '^\*[^*]+:\*\s*', '');
    END IF;

    preview := CASE
      WHEN clean_content IS NOT NULL AND clean_content != '' THEN LEFT(clean_content, 200)
      WHEN NEW.media_type = 'image' THEN '📷 Imagem'
      WHEN NEW.media_type = 'video' THEN '🎥 Vídeo'
      WHEN NEW.media_type = 'audio' THEN '🎤 Áudio'
      WHEN NEW.media_type = 'document' THEN '📄 Documento'
      WHEN NEW.media_type = 'sticker' THEN '🏷️ Figurinha'
      WHEN NEW.media_type = 'location' THEN '📍 Localização'
      WHEN NEW.media_type = 'contact' THEN '👤 Contato'
      WHEN NEW.media_type IS NOT NULL THEN '[' || NEW.media_type || ']'
      ELSE ''
    END;

    UPDATE public.whatsapp_contacts
    SET
      last_message_at = msg_time,
      last_message_content = preview,
      last_message_is_from_me = NEW.is_from_me
    WHERE id = NEW.contact_id;
  END IF;

  RETURN NEW;
END;
$function$;