
-- Fix existing orgs without an owner: promote earliest admin by id
WITH orgs_without_owner AS (
  SELECT o.id AS org_id
  FROM public.organizations o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.organization_id = o.id AND ur.role = 'owner'
  )
),
earliest_admin AS (
  SELECT DISTINCT ON (ur.organization_id) ur.id AS role_id
  FROM public.user_roles ur
  JOIN orgs_without_owner owo ON owo.org_id = ur.organization_id
  WHERE ur.role = 'admin'
  ORDER BY ur.organization_id, ur.id ASC
)
UPDATE public.user_roles
SET role = 'owner'
FROM earliest_admin ea
WHERE public.user_roles.id = ea.role_id;
