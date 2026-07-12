-- Company join code system
-- Run this in Supabase SQL Editor

-- 1. Company settings table (single row per instance)
CREATE TABLE IF NOT EXISTS company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'My Company',
  join_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT single_company CHECK (id = 1)
);

-- 2. Update the handle_new_user trigger to:
--    a) Generate company + join code when first user registers
--    b) Set subsequent users as pending employees
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count integer := 0;
  assigned_role text := 'employee';
  assigned_status text := 'pending';
  new_code text;
BEGIN
  BEGIN
    SELECT count(*) INTO user_count FROM public.profiles;

    IF user_count = 0 THEN
      -- First user = Company Admin
      assigned_role := 'admin';
      assigned_status := 'active';

      -- Generate a unique 6-char alphanumeric join code
      new_code := UPPER(
        TRANSLATE(ENCODE(GEN_RANDOM_BYTES(4), 'base64'), '+/=', 'XYZ')
      );
      new_code := SUBSTRING(new_code FROM 1 FOR 6);

      -- Create company settings row
      INSERT INTO company_settings (id, join_code)
      VALUES (1, new_code)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'employee';
    assigned_status := 'pending';
  END;

  BEGIN
    INSERT INTO public.profiles (id, name, email, role, status)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      assigned_role,
      assigned_status
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      email = EXCLUDED.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'profile insert failed for %: %', new.email, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. RLS for company_settings — everyone can read (to validate join code on signup)
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_settings_read" ON company_settings FOR SELECT USING (true);
CREATE POLICY "company_settings_admin_update" ON company_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. If you already have a company admin, manually insert a join code:
-- INSERT INTO company_settings (id, join_code) VALUES (1, 'AF2026') ON CONFLICT (id) DO NOTHING;

SELECT 'Company join code system ready' as result;
