ALTER TABLE whatsapp_contacts 
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);