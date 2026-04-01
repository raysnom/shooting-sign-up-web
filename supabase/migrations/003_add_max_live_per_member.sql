-- Add max_live_per_member column to weeks table
-- This allows the President to optionally set a maximum number of live fire slots
-- each member can receive per week. NULL = no limit.

ALTER TABLE weeks ADD COLUMN max_live_per_member INTEGER;

COMMENT ON COLUMN weeks.max_live_per_member IS 'Optional maximum number of live fire slots each member can receive this week. NULL = no limit.';
