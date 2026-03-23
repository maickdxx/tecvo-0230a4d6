-- Add document_type column to differentiate quotes from service orders
ALTER TABLE services 
ADD COLUMN document_type TEXT DEFAULT 'quote' 
CHECK (document_type IN ('quote', 'service_order'));

-- Index for better query performance
CREATE INDEX idx_services_document_type ON services(document_type);