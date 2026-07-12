-- Auto-generating asset tags: AF-YYYY-NNNN format
-- Run in Supabase SQL Editor

-- Create a sequence for asset tag numbers
CREATE SEQUENCE IF NOT EXISTS asset_tag_seq START 1001 INCREMENT 1;

-- Function to auto-generate tag on insert if not provided
CREATE OR REPLACE FUNCTION auto_generate_asset_tag()
RETURNS trigger AS $$
BEGIN
  IF NEW.tag IS NULL OR NEW.tag = '' THEN
    NEW.tag := 'AF-' || EXTRACT(YEAR FROM NOW())::text || '-' || LPAD(nextval('asset_tag_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_tag_assets ON assets;
CREATE TRIGGER auto_tag_assets
  BEFORE INSERT ON assets
  FOR EACH ROW EXECUTE FUNCTION auto_generate_asset_tag();

-- B-Tree index on tag for fast lookups
CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets USING btree (tag);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets USING btree (status);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets USING btree (department_id);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations USING btree (asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON allocations USING btree (to_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_time ON activity_log USING btree (timestamp DESC);

SELECT 'Auto-tag sequence and indexes created' as result;
