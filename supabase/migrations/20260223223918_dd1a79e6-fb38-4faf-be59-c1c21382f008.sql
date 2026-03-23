
-- Create notification_tokens table
CREATE TABLE public.notification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_tokens_user_endpoint_unique UNIQUE (user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.notification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own notification tokens"
ON public.notification_tokens
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own tokens
CREATE POLICY "Users can create their own notification tokens"
ON public.notification_tokens
FOR INSERT
WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id());

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own notification tokens"
ON public.notification_tokens
FOR DELETE
USING (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "Users can update their own notification tokens"
ON public.notification_tokens
FOR UPDATE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_notification_tokens_updated_at
BEFORE UPDATE ON public.notification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
