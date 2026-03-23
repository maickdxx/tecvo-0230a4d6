-- Add onboarding_completed field to organizations
ALTER TABLE organizations 
ADD COLUMN onboarding_completed boolean DEFAULT false;

-- Set existing organizations with catalog_services as completed
UPDATE organizations o
SET onboarding_completed = true
WHERE EXISTS (
  SELECT 1 FROM catalog_services cs 
  WHERE cs.organization_id = o.id
)
OR o.name IS NOT NULL AND o.name != '';