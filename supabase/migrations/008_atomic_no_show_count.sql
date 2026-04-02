-- Atomic increment/decrement functions for no_show_count
-- Prevents race condition when multiple attendance records are updated concurrently

CREATE OR REPLACE FUNCTION increment_no_show_count(member_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE members
  SET no_show_count = no_show_count + 1
  WHERE id = member_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_no_show_count(member_id_input UUID)
RETURNS void AS $$
BEGIN
  UPDATE members
  SET no_show_count = GREATEST(no_show_count - 1, 0)
  WHERE id = member_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
