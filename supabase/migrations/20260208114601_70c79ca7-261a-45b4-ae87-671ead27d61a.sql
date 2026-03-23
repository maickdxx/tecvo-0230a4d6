-- Criar tabela de canais WhatsApp
CREATE TABLE public.whatsapp_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#10B981',
  phone_number TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para canais
CREATE POLICY "Users can view channels in their org"
  ON public.whatsapp_channels FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create channels in their org"
  ON public.whatsapp_channels FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update channels in their org"
  ON public.whatsapp_channels FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete channels in their org"
  ON public.whatsapp_channels FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Adicionar channel_id às tabelas existentes
ALTER TABLE public.whatsapp_contacts 
  ADD COLUMN channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages 
  ADD COLUMN channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE;

-- Remover a tabela whatsapp_sessions antiga (não será mais necessária)
DROP TABLE IF EXISTS public.whatsapp_sessions;

-- Função para verificar limite de canais (máximo 3 por organização)
CREATE OR REPLACE FUNCTION public.check_channel_limit()
RETURNS TRIGGER AS $$
DECLARE
  channel_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO channel_count
  FROM public.whatsapp_channels
  WHERE organization_id = NEW.organization_id;
  
  IF channel_count >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 canais por organização atingido';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para verificar limite antes de inserir
CREATE TRIGGER check_channel_limit_trigger
  BEFORE INSERT ON public.whatsapp_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.check_channel_limit();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_channels_updated_at
  BEFORE UPDATE ON public.whatsapp_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar realtime para a nova tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_channels;