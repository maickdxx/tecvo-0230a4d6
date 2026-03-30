-- Create function to update financial account balance based on transactions
CREATE OR REPLACE FUNCTION public.handle_transaction_balance_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_account_id uuid;
    v_amount_diff numeric;
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'paid' AND NEW.financial_account_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = NEW.financial_account_id;
        END IF;

    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Reverse OLD effect if it was paid and not deleted
        IF OLD.status = 'paid' AND OLD.financial_account_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = OLD.financial_account_id;
        END IF;

        -- Apply NEW effect if it is paid and not deleted
        IF NEW.status = 'paid' AND NEW.financial_account_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = NEW.financial_account_id;
        END IF;

    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'paid' AND OLD.financial_account_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = OLD.financial_account_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS tr_sync_transaction_balance ON public.transactions;
CREATE TRIGGER tr_sync_transaction_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_balance_sync();

-- BACKFILL: Update current balances to match transaction history
-- This is critical to fix the current "incorrect" balances
UPDATE public.financial_accounts fa
SET balance = COALESCE((
    SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END)
    FROM public.transactions t
    WHERE t.financial_account_id = fa.id 
      AND t.status = 'paid' 
      AND t.deleted_at IS NULL
), 0)
WHERE fa.is_active = true;
