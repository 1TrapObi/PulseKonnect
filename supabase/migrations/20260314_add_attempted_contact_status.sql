-- Adds attempted_contact as a valid lead status for outreach attempts before successful contact.

DO $$
DECLARE
  status_data_type TEXT;
  status_udt_name TEXT;
  c RECORD;
BEGIN
  SELECT data_type, udt_name
  INTO status_data_type, status_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'leads'
    AND column_name = 'status';

  IF status_data_type = 'USER-DEFINED' THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS ''attempted_contact''', status_udt_name);
  ELSE
    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.leads'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
        AND pg_get_constraintdef(oid) ILIKE '%new%'
        AND pg_get_constraintdef(oid) ILIKE '%contacted%'
    LOOP
      EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;

    ALTER TABLE public.leads
      ADD CONSTRAINT leads_status_check
      CHECK (
        status IS NULL
        OR status IN ('new', 'attempted_contact', 'contacted', 'qualified', 'converted', 'lost')
      );
  END IF;
END;
$$;
