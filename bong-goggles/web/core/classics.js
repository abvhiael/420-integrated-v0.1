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
  item('nines','Nines','3–4','planned','Also called Le Neuf; regional trick-taking game.'),
  item('cross-country-chaos','Cross-Country Chaos','2–4','account','Three regional races, one champion. Separate 420ID accounts.')
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
  item('scrabble','Scrabble','2–4','planned','Word tile board, dictionary and scoring; branding and word-list rights must be resolved before play.'),
  item('checkers','Checkers','2','registry','Canonical two-player session registry only.'),
  item('backgammon','Backgammon','2','registry','Canonical two-player session registry only.'),
  item('dominoes','Dominoes','2–4','registry','Canonical two-player session registry only.'),
  item('go','Go','2','planned','9×9, 13×13 and 19×19 board sizes proposed.'),
  item('mahjong','Four-Player Mahjong','4','planned','Traditional multiplayer Mahjong, not solitaire matching.')
 ])}),
 Object.freeze({id:'dice',title:'Dice Games',games:Object.freeze([
  item('yahtzee','Yahtzee','2–4','planned','Full five-dice scorecards with 1, 2, 3 or 6 rows; scoring and branding qualification pending.'),
  item('five-dice-one','Five-Dice Scoring — Single Row','2–4','planned','Single-column scorecard.'),
  item('five-dice-six','Five-Dice Scoring — Six Rows','2–4','planned','Six-row variation; scoring to be agreed before implementation.')
 ])})
]);
export const ALL_CLASSICS=Object.freeze(CLASSIC_COLLECTIONS.flatMap(c=>c.games));

const ROADMAP_IDS=Object.freeze(["cribbage","russian-cribbage","chess","scrabble","checkers","backgammon","dominoes","crazy-eights","euchre","yahtzee","go-fish","hearts","go","mahjong","spades","500","canasta","tarabish","45s","120s","deux-cents","hola","rook","nines","kaiser"]);
const BY_ID=new Map(ALL_CLASSICS.map(game=>[game.id,game]));
if(BY_ID.size!==ALL_CLASSICS.length||ROADMAP_IDS.length!==25||
   new Set(ROADMAP_IDS).size!==25||ROADMAP_IDS.some(id=>!BY_ID.has(id)))
 throw new Error('Invalid BongGoggles Classics catalogue');
export const CLASSIC_ROADMAP=Object.freeze(ROADMAP_IDS.map((id,index)=>
 Object.freeze({...BY_ID.get(id),milestone:'BC-'+(index+1),
 collection:index<17?'main':'canadian',href:'/games/'+id})));
export function classicGameById(id){return typeof id==='string'?BY_ID.get(id)??null:null;}
