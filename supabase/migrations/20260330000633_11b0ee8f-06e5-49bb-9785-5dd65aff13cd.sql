-- Add theme columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'blue';
