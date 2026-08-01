-- Migration: Ensure ledger_logs amount is always absolute/positive before insert
-- Solves check_ledger_amount_non_negative violation when negative amounts are passed.

CREATE OR REPLACE FUNCTION public.ensure_ledger_amount_positive()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
    NEW.amount := ABS(NEW.amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_ledger_amount_positive ON public.ledger_logs;
CREATE TRIGGER trg_ensure_ledger_amount_positive
BEFORE INSERT ON public.ledger_logs
FOR EACH ROW EXECUTE FUNCTION public.ensure_ledger_amount_positive();
