-- Immutable room format; legacy rows preserve their original defaults.
ALTER TABLE bg_account_social.classic_rooms ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT '';
ALTER TABLE bg_account_social.classic_rooms ADD CONSTRAINT classic_rooms_word_salad_format_check
 CHECK (format='' OR (game_id='scrabble' AND format ~ '^(11|13|15|17|19|21):(classic-salad|extra-dank|straight-greens)(:(live|async|untimed))?$'
 AND (split_part(format,':',1)<>'11' OR seat_count=2)
 AND (split_part(format,':',1)<>'13' OR seat_count<=3)));
ALTER TABLE bg_account_social.classic_sessions DROP CONSTRAINT IF EXISTS classic_sessions_active_state_check;
ALTER TABLE bg_account_social.classic_sessions ADD CONSTRAINT classic_sessions_active_state_check
 CHECK ((status='active' AND turn_seat IS NOT NULL AND (turn_deadline IS NOT NULL OR game_id IN ('chess','scrabble')) AND finished_reason IS NULL AND winner_seat IS NULL)
 OR (status<>'active' AND turn_seat IS NULL AND turn_deadline IS NULL AND finished_reason IS NOT NULL));
