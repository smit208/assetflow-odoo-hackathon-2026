-- Run this in Supabase SQL Editor after signing up in the app

-- 1. Make your account admin
UPDATE profiles SET role = 'admin' WHERE email = 'smitvp2005@gmail.com';

-- 2. Create departments
INSERT INTO departments (name, location) VALUES
  ('Engineering', 'Floor 3'),
  ('Finance', 'Floor 2'),
  ('Operations', 'Floor 1'),
  ('HR', 'Floor 2')
ON CONFLICT (name) DO NOTHING;

-- 3. Create categories
INSERT INTO asset_categories (name, default_depreciation_rate) VALUES
  ('Laptop', 25),
  ('Monitor', 20),
  ('Chair', 10),
  ('Projector', 15),
  ('Phone', 33)
ON CONFLICT (name) DO NOTHING;

-- 4. Check your profile was created
SELECT id, name, email, role FROM profiles;
