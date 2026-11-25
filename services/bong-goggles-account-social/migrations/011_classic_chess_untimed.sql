-- Untimed Chess sessions were introduced in 011. The migration runner
-- replays the complete sequence at every startup. Once 012 has installed
-- room formats, do not temporarily reinstate the obsolete Chess-only
-- restriction over existing untimed Word Salad sessions.
DO $migration$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='bg_account_social' AND table_name='classic_rooms'
    AND column_name='format'
 ) THEN
  ALTER TABLE bg_account_social.classic_sessions
   DROP CONSTRAINT IF EXISTS classic_sessions_check,
   DROP CONSTRAINT IF EXISTS classic_sessions_active_state_check;
  ALTER TABLE bg_account_social.classic_sessions
   ADD CONSTRAINT classic_sessions_active_state_check
   CHECK ((status='active' AND turn_seat IS NOT NULL
       AND (turn_deadline IS NOT NULL OR game_id='chess')
       AND finished_reason IS NULL AND winner_seat IS NULL)
     OR (status<>'active' AND turn_seat IS NULL AND turn_deadline IS NULL
       AND finished_reason IS NOT NULL));
 END IF;
END;
$migration$;
