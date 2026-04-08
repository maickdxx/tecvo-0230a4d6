-- Drop the OLD overload that has _request_id as uuid with defaults
DROP FUNCTION IF EXISTS public.consume_ai_credits_with_log(
  uuid, uuid, text, uuid, text, integer, integer, integer, integer, text
);