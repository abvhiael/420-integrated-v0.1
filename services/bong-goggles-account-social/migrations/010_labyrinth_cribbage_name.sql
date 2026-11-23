-- BC-2.1: additive canonical game ID; preserve historical room identifiers.
ALTER TABLE bg_account_social.classic_rooms
 DROP CONSTRAINT IF EXISTS classic_rooms_game_id_check;
ALTER TABLE bg_account_social.classic_rooms
 ADD CONSTRAINT classic_rooms_game_id_check
 CHECK (game_id IN ('cribbage','russian-cribbage','chess','scrabble','checkers','backgammon','dominoes','crazy-eights','euchre','yahtzee','go-fish','hearts','go','mahjong','spades','500','canasta','tarabish','45s','120s','deux-cents','hola','rook','nines','kaiser','labyrinth-cribbage'));
