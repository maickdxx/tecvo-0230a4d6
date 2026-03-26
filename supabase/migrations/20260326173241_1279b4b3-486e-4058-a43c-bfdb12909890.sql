-- Add onboarding_completed field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);

-- Update existing profiles that had dismissed the banner in localStorage (we can't easily, but we can assume if they have many services they might have finished onboarding)
-- But the user wants a clean slate with this new flag.
