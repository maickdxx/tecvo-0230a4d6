
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET times_used = times_used + 1
  WHERE code = coupon_code_param;
END;
$$;
