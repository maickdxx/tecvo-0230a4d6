-- Make service_items.description nullable
ALTER TABLE public.service_items 
ALTER COLUMN description DROP NOT NULL;
