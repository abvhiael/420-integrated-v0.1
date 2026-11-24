-- Untimed sessions may omit a deadline only for the Chess catalogue entry.
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
