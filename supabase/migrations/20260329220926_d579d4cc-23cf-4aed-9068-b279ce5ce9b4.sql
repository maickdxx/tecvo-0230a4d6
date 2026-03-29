-- Add whatsapp_signature column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_signature TEXT;

-- Ensure RLS policies are correct for the new column (should be covered by existing policies but let's be explicit if needed)
-- Assuming existing policy "Users can update their own profile" exists and covers all columns.

-- Let's check existing policies just in case
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
