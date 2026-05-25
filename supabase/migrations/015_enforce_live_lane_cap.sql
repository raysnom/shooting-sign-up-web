-- ──────────────────────────────────────────────────────────────────────────
-- 015: Enforce the per-session live-fire lane cap at the database level.
--
-- Background: the "claim leftover slot" flow counted current live usage with
-- the RLS-scoped client, which (under allocations_select_own) only sees the
-- caller's own rows. The count came back as ~0, so every claim was granted
-- live fire and sessions blew past their live_lanes cap (e.g. 17 live in a
-- 12-lane session). This trigger makes the cap a hard database invariant so
-- NO code path — claim, draft, auto-upgrade, manual edit — can ever exceed it.
--
-- Safe for the existing flows:
--   * Draft bulk-insert produces <= live_lanes live rows per session, so each
--     row passes (the Nth live insert sees N-1 existing live rows).
--   * Cancelling a live slot sets cancelled = true first (so it is excluded
--     from the count), then the dry->live auto-upgrade sees a freed lane.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_live_lane_cap()
RETURNS TRIGGER AS $$
DECLARE
  cap integer;
  current_live integer;
BEGIN
  -- Only constrain rows that will be active (non-cancelled) live allocations.
  IF NEW.type = 'live' AND NEW.cancelled = false THEN
    SELECT live_lanes INTO cap
    FROM public.sessions
    WHERE id = NEW.session_id;

    -- Count existing active live allocations in this session, excluding the
    -- row being inserted/updated.
    SELECT count(*) INTO current_live
    FROM public.allocations
    WHERE session_id = NEW.session_id
      AND type = 'live'
      AND cancelled = false
      AND id <> NEW.id;

    IF cap IS NOT NULL AND current_live >= cap THEN
      RAISE EXCEPTION
        'Live fire is full for this session (% of % lanes used).', current_live, cap
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_live_lane_cap ON public.allocations;

CREATE TRIGGER trg_enforce_live_lane_cap
  BEFORE INSERT OR UPDATE ON public.allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_live_lane_cap();
