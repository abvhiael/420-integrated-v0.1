// Canonical 420Bet Blackjack card artwork paths. Four suits × thirteen ranks.
// Gameplay uses card.rank/card.suit independent of this view-only mapping.
export const CARD_ART_ROOT='/assets/420bet/blackjack/cards';
export const SUIT_ART=Object.freeze({
 '♥':Object.freeze({code:'H',name:'hearts'}),
 '♦':Object.freeze({code:'D',name:'diamonds'}),
 '♣':Object.freeze({code:'C',name:'clubs'}),
 '♠':Object.freeze({code:'S',name:'spades'})
});
export const COURT_ART=Object.freeze({
 'KH':'willie_nelson','QH':'melissa_etheridge','JH':'snoop_dogg',
 'KD':'jim_belushi','QD':'sarah_silverman','JD':'seth_rogen',
 'KC':'tommy_chong','QC':'whoopi_goldberg','JC':'cheech_marin',
 'KS':'mike_tyson','QS':'miley_cyrus','JS':'woody_harrelson'
});
export function blackjackCardArt(card){
 if(!card||!Object.hasOwn(SUIT_ART,card.suit))throw Error('Unknown Blackjack card suit');
 const {code,name}=SUIT_ART[card.suit],rank=String(card.rank);
 if(rank==='A')return `${CARD_ART_ROOT}/aces/A${code}_ace_${name}.png`;
 if(['J','Q','K'].includes(rank))return `${CARD_ART_ROOT}/courts/${rank}${code}_${COURT_ART[rank+code]}.png`;
 if(/^([2-9]|10)$/.test(rank))return `${CARD_ART_ROOT}/numbered/${rank}${code}_${name}.png`;
 throw Error('Unknown Blackjack card rank');
}
export const blackjackCardBack=()=>'/assets/420bet/blackjack/card-back.svg';
