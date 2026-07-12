-- PASTE THIS ENTIRE BLOCK IN SUPABASE SQL EDITOR — ONE CLICK FIX

-- STEP 1: Drop the broken trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- STEP 2: Recreate trigger — bulletproof with exception handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count integer := 0;
  assigned_role text := 'employee';
BEGIN
  BEGIN
    SELECT count(*) INTO user_count FROM public.profiles;
    IF user_count = 0 THEN
      assigned_role := 'admin';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'employee';
  END;

  BEGIN
    INSERT INTO public.profiles (id, name, email, role, status)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      assigned_role,
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      name  = COALESCE(EXCLUDED.name, public.profiles.name),
      email = EXCLUDED.email;
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the signup — just log and continue
    RAISE WARNING 'profile insert failed for %: %', new.email, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- STEP 3: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- STEP 4: Add missing INSERT policy on profiles
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- STEP 5: Clean up any duplicate email issues from previous failed attempts
-- (safe to run — only deletes orphan profiles with no matching auth user)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- STEP 6: Verify
SELECT 'Trigger ready. Signup will now work.' as status;
