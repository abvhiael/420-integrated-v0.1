// Editorial game catalogue. Planned entries are NOT advertised as functional game engines.
const item=(id,title,players,status='planned',description='')=>Object.freeze({id,title,players,status,description});
export const CLASSIC_COLLECTIONS=Object.freeze([
 Object.freeze({id:'canadian',title:'Canadian Classics',games:Object.freeze([
  item('kaiser','Kaiser','4', 'planned','Saskatchewan partnership trick-taking.'),
  item('tarabish','Tarabish','4','planned','Cape Breton partnership card tradition.'),
  item('45s','Forty-Fives (45s)','2–4','planned','Maritime trick-taking tradition; selectable local rules planned.'),
  item('120s','120s','4','planned','Newfoundland tradition; variant rules to be specified.'),
  item('deux-cents','Deux Cents (200)','4','planned','Quebec and New Brunswick partnership card game.'),
  item('hola','Hola','2 or 4','planned','Ukrainian-Canadian Prairie card tradition.'),
  item('rook','Rook','4','planned','Traditional numbered-deck partnership game.'),
  item('nines','Nines (Le Neuf)','3–4','planned','Regional trick-taking game.'),
  item('cross-country-chaos','Cross-Country Chaos','2–4','local','Three regional races, one national champion. Local pass-and-play.')
 ])}),
 Object.freeze({id:'cards',title:'Card Games',games:Object.freeze([
  item('cribbage','Cribbage','2–4','registry','Canonical two-player session registry only; interactive ruleset not enabled.'),
  item('russian-cribbage','Russian Cribbage','Variant-dependent','registry','Canonical two-player session registry only; interactive ruleset not enabled.'),
  item('crazy-eights','Crazy Eights','2–4'),
  item('euchre','Euchre','4'),
  item('go-fish','Go Fish','2–4'),
  item('hearts','Hearts','3–4'),
  item('spades','Spades','4'),
  item('500','500','3–4'),
  item('canasta','Canasta','2–4'),
  item('rummy','Rummy','2–4'),
  item('asshole','Asshole','4','planned','Four-player climbing/shedding game with President and Asshole exchanges.')
 ])}),
 Object.freeze({id:'board',title:'Boards & Tiles',games:Object.freeze([
  item('chess','Chess','2','registry','Canonical two-player session registry only.'),
  item('checkers','Checkers','2','registry','Canonical two-player session registry only.'),
  item('backgammon','Backgammon','2','registry','Canonical two-player session registry only.'),
  item('dominoes','Dominoes','2–4','registry','Canonical two-player session registry only.'),
  item('go','Go','2','planned','9×9, 13×13 and 19×19 board sizes proposed.'),
  item('mahjong','Four-Player Mahjong','4','planned','Traditional multiplayer Mahjong, not solitaire matching.')
 ])}),
 Object.freeze({id:'dice',title:'Dice Games',games:Object.freeze([
  item('five-dice-one','Five-Dice Scoring — Single Row','2–4','planned','Single-column scorecard.'),
  item('five-dice-six','Five-Dice Scoring — Six Rows','2–4','planned','Six-row variation; scoring to be agreed before implementation.')
 ])})
]);
export const ALL_CLASSICS=Object.freeze(CLASSIC_COLLECTIONS.flatMap(c=>c.games));
