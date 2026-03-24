
-- 1. Channel transition audit log
CREATE TABLE public.whatsapp_channel_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  previous_channel_id uuid,
  new_channel_id uuid,
  reason text NOT NULL DEFAULT 'message_received',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by contact or org
CREATE INDEX idx_channel_transitions_contact ON public.whatsapp_channel_transitions(contact_id);
CREATE INDEX idx_channel_transitions_org ON public.whatsapp_channel_transitions(organization_id, created_at DESC);

-- RLS
ALTER TABLE public.whatsapp_channel_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org transitions"
  ON public.whatsapp_channel_transitions
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- 2. Protect whatsapp_messages from cascade deletion when channel is deleted
-- The FK on whatsapp_messages.channel_id should be SET NULL, not CASCADE
-- Check and fix if needed
DO $$
BEGIN
  -- Drop existing FK if it cascades
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'whatsapp_messages' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND rc.delete_rule = 'CASCADE'
      AND EXISTS (
        SELECT 1 FROM information_schema.key_column_usage kcu
        WHERE kcu.constraint_name = tc.constraint_name
          AND kcu.column_name = 'channel_id'
      )
  ) THEN
    -- Find and drop the constraint
    EXECUTE (
      SELECT 'ALTER TABLE public.whatsapp_messages DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'whatsapp_messages' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'channel_id'
      LIMIT 1
    );
    -- Re-add with SET NULL
    ALTER TABLE public.whatsapp_messages 
      ADD CONSTRAINT whatsapp_messages_channel_id_fkey 
      FOREIGN KEY (channel_id) REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Protect whatsapp_contacts from losing messages on contact deletion
-- Add a guard trigger to prevent accidental mass message deletion
CREATE OR REPLACE FUNCTION public.guard_whatsapp_message_deletion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  msg_count integer;
BEGIN
  -- Count messages being deleted in this statement
  SELECT COUNT(*) INTO msg_count
  FROM old_table;
  
  -- Block bulk deletion (more than 500 messages at once) as a safety net
  IF msg_count > 500 THEN
    RAISE EXCEPTION 'Bulk deletion of % WhatsApp messages blocked. Use explicit per-contact deletion.', msg_count;
  END IF;
  
  RETURN NULL;
END;
$$;
