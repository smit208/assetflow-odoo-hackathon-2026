-- Run this in Supabase SQL Editor to add missing columns
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE)

-- 1. Departments: add head, parent hierarchy, status
ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- 2. Categories: add flexible custom field columns
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS custom_field_name text;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS custom_field_value text;

-- 3. Allocations: overdue status support (add to check constraint)
-- Already handled by status field — no change needed

-- 4. Verify
SELECT 'Schema migration complete' as result;
