
-- Trigger function: sync contact summary fields whenever a message is inserted
CREATE OR REPLACE FUNCTION public.sync_contact_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  msg_time timestamptz;
  current_last_message_at timestamptz;
  preview text;
BEGIN
  -- Determine message time
  msg_time := COALESCE(NEW.timestamp, NEW.created_at, now());

  -- Get current last_message_at for comparison
  SELECT last_message_at INTO current_last_message_at
  FROM public.whatsapp_contacts
  WHERE id = NEW.contact_id;

  -- Only update if this message is newer or equal
  IF current_last_message_at IS NULL OR msg_time >= current_last_message_at THEN
    -- Build preview content
    preview := CASE
      WHEN NEW.content IS NOT NULL AND NEW.content != '' THEN LEFT(NEW.content, 200)
      WHEN NEW.media_type = 'image' THEN '📷 Imagem'
      WHEN NEW.media_type = 'video' THEN '🎥 Vídeo'
      WHEN NEW.media_type = 'audio' THEN '🎤 Áudio'
      WHEN NEW.media_type = 'document' THEN '📄 Documento'
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
$$;

-- Create the trigger
CREATE TRIGGER trg_sync_contact_last_message
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_contact_last_message();

-- ONE-TIME FIX: Update all contacts with their actual latest message data
WITH latest_msgs AS (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    COALESCE(timestamp, created_at) as msg_time,
    content,
    media_type,
    is_from_me
  FROM public.whatsapp_messages
  ORDER BY contact_id, COALESCE(timestamp, created_at) DESC
)
UPDATE public.whatsapp_contacts c
SET
  last_message_at = lm.msg_time,
  last_message_content = CASE
    WHEN lm.content IS NOT NULL AND lm.content != '' THEN LEFT(lm.content, 200)
    WHEN lm.media_type = 'image' THEN '📷 Imagem'
    WHEN lm.media_type = 'video' THEN '🎥 Vídeo'
    WHEN lm.media_type = 'audio' THEN '🎤 Áudio'
    WHEN lm.media_type = 'document' THEN '📄 Documento'
    WHEN lm.media_type IS NOT NULL THEN '[' || lm.media_type || ']'
    ELSE ''
  END,
  last_message_is_from_me = lm.is_from_me
FROM latest_msgs lm
WHERE c.id = lm.contact_id;
