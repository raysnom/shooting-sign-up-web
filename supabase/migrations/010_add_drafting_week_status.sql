-- Add 'drafting' value to week_status enum.
-- The runDraft server action atomically locks the week by transitioning
-- status closed → drafting before running the algorithm. The initial
-- enum (001_initial_schema.sql) omitted this value.

ALTER TYPE week_status ADD VALUE IF NOT EXISTS 'drafting';
