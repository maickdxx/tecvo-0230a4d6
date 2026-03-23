-- Adicionar colunas de vínculo na tabela whatsapp_contacts
ALTER TABLE public.whatsapp_contacts
ADD COLUMN linked_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN linked_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN conversion_status TEXT DEFAULT 'pending',
ADD COLUMN linked_at TIMESTAMPTZ;

-- Índice para performance em queries de leads
CREATE INDEX idx_whatsapp_contacts_linked_service 
ON public.whatsapp_contacts(linked_service_id) 
WHERE linked_service_id IS NOT NULL;

-- Índice para status de conversão
CREATE INDEX idx_whatsapp_contacts_conversion_status
ON public.whatsapp_contacts(conversion_status)
WHERE conversion_status IS NOT NULL;