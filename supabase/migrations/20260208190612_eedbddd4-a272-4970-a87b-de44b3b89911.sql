-- Step 1: Add super_admin to the existing app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';