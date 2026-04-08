-- Multiply all existing balances by 10 for new credit scale
UPDATE public.ai_credits SET balance = balance * 10, updated_at = now();

-- Scale up credit costs proportionally (1→10, 3→30, 0 stays 0)
UPDATE public.ai_credit_config SET credits_cost = credits_cost * 10, updated_at = now() WHERE credits_cost > 0;