-- Fix: Invites table public exposure (CRITICAL)
-- The current policy "Anyone can read invite by token" exposes ALL pending invites
-- This allows attackers to harvest email addresses

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;

-- Step 2: Add expires_at column for token expiration (7 days)
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days');

-- Update existing invites to have expiration
UPDATE public.invites 
SET expires_at = created_at + interval '7 days' 
WHERE expires_at IS NULL;

-- Step 3: Create a secure function to validate invite tokens
-- This prevents enumeration by only allowing exact token lookups
CREATE OR REPLACE FUNCTION public.get_invite_by_token(invite_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  role app_role,
  token uuid,
  organization_id uuid,
  organization_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id,
    i.email,
    i.role,
    i.token,
    i.organization_id,
    o.name as organization_name
  FROM public.invites i
  LEFT JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = invite_token
    AND i.accepted_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > NOW())
  LIMIT 1;
$$;

-- Step 4: Fix user_roles policy to prevent privilege escalation
-- Admins should not be able to assign/modify owner role

-- Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create separate policies for INSERT, UPDATE, DELETE with owner protection
CREATE POLICY "Admins can insert non-owner roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  AND (role != 'owner' OR has_role(auth.uid(), 'owner'))
);

CREATE POLICY "Admins can update non-owner roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  AND (role != 'owner' OR has_role(auth.uid(), 'owner'))
)
WITH CHECK (
  (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  AND (role != 'owner' OR has_role(auth.uid(), 'owner'))
);

CREATE POLICY "Admins can delete non-owner roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
  AND (role != 'owner' OR has_role(auth.uid(), 'owner'))
);

-- Step 5: Make service-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'service-photos';