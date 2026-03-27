-- Migrate contacts from disconnected channel to the active connected channel
-- for the Space Ar Condicionado organization
UPDATE whatsapp_contacts 
SET channel_id = '07bd4e8e-ffad-4b90-a6e9-90cde27d5914'
WHERE channel_id = '5e2faa81-d93b-47e5-ae24-e98fd4488208';

-- Also update messages to reference the new channel
UPDATE whatsapp_messages 
SET channel_id = '07bd4e8e-ffad-4b90-a6e9-90cde27d5914'
WHERE channel_id = '5e2faa81-d93b-47e5-ae24-e98fd4488208';