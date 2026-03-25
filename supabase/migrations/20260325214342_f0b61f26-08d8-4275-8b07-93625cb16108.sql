-- 1. Merge duplicated contacts by whatsapp_id
DO $$
DECLARE
    r RECORD;
    target_id UUID;
BEGIN
    FOR r IN 
        SELECT organization_id, whatsapp_id, COUNT(*)
        FROM public.whatsapp_contacts
        WHERE whatsapp_id IS NOT NULL
        GROUP BY organization_id, whatsapp_id
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO target_id
        FROM public.whatsapp_contacts
        WHERE organization_id = r.organization_id AND whatsapp_id = r.whatsapp_id
        ORDER BY last_message_at DESC NULLS LAST, created_at DESC
        LIMIT 1;

        UPDATE public.whatsapp_messages
        SET contact_id = target_id
        WHERE contact_id IN (
            SELECT id FROM public.whatsapp_contacts
            WHERE organization_id = r.organization_id AND whatsapp_id = r.whatsapp_id AND id != target_id
        );

        DELETE FROM public.whatsapp_contacts
        WHERE organization_id = r.organization_id AND whatsapp_id = r.whatsapp_id AND id != target_id;
    END LOOP;
END $$;

-- 2. Merge duplicated contacts by normalized_phone (for non-groups)
DO $$
DECLARE
    r RECORD;
    target_id UUID;
BEGIN
    FOR r IN 
        SELECT organization_id, normalized_phone, COUNT(*)
        FROM public.whatsapp_contacts
        WHERE normalized_phone IS NOT NULL AND COALESCE(is_group, false) = false
        GROUP BY organization_id, normalized_phone
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO target_id
        FROM public.whatsapp_contacts
        WHERE organization_id = r.organization_id AND normalized_phone = r.normalized_phone
        ORDER BY last_message_at DESC NULLS LAST, created_at DESC
        LIMIT 1;

        UPDATE public.whatsapp_messages
        SET contact_id = target_id
        WHERE contact_id IN (
            SELECT id FROM public.whatsapp_contacts
            WHERE organization_id = r.organization_id AND normalized_phone = r.normalized_phone AND id != target_id
        );

        DELETE FROM public.whatsapp_contacts
        WHERE organization_id = r.organization_id AND normalized_phone = r.normalized_phone AND id != target_id;
    END LOOP;
END $$;

-- 3. Now apply the unique indexes
DROP INDEX IF EXISTS idx_whatsapp_contacts_org_channel_whatsapp_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_whatsapp_id_unique 
ON public.whatsapp_contacts (organization_id, whatsapp_id) 
WHERE (whatsapp_id IS NOT NULL);

DROP INDEX IF EXISTS idx_whatsapp_contacts_org_channel_normalized_phone_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_normalized_phone_unique 
ON public.whatsapp_contacts (organization_id, normalized_phone) 
WHERE ((normalized_phone IS NOT NULL) AND (COALESCE(is_group, false) = false));

-- 4. Ensure FKs are SET NULL on channel deletion
ALTER TABLE public.whatsapp_contacts 
DROP CONSTRAINT IF EXISTS whatsapp_contacts_channel_id_fkey;

ALTER TABLE public.whatsapp_contacts 
ADD CONSTRAINT whatsapp_contacts_channel_id_fkey 
FOREIGN KEY (channel_id) REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_channel_id_fkey;

ALTER TABLE public.whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_channel_id_fkey 
FOREIGN KEY (channel_id) REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL;

-- 5. Transitions table
CREATE TABLE IF NOT EXISTS public.whatsapp_channel_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
    previous_channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    new_channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Trigger for transition tracking
CREATE OR REPLACE FUNCTION public.track_whatsapp_channel_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.channel_id IS DISTINCT FROM NEW.channel_id) THEN
        INSERT INTO public.whatsapp_channel_transitions (
            organization_id,
            contact_id,
            previous_channel_id,
            new_channel_id,
            reason
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            OLD.channel_id,
            NEW.channel_id,
            'channel_changed'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_track_whatsapp_channel_transition ON public.whatsapp_contacts;
CREATE TRIGGER tr_track_whatsapp_channel_transition
AFTER UPDATE OF channel_id ON public.whatsapp_contacts
FOR EACH ROW
EXECUTE FUNCTION public.track_whatsapp_channel_transition();
