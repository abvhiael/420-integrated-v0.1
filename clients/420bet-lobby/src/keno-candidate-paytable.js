// Exact candidate from contracts/config/420bet-keno-v1-paytable-candidate.json.
// NOT independent approval, not allowed for live wagering or stake settlement.
export const KENO_CANDIDATE_STATUS='PROPOSED · NOT APPROVED FOR WAGERING';
export const KENO_CANDIDATE_GROSS_MULTIPLIERS=Object.freeze({
  1:{1:'3.6'},2:{2:'15'},3:{2:'2',3:'45'},4:{2:'1',3:'9',4:'100'},
  5:{3:'3',4:'25',5:'550'},6:{3:'2',4:'8',5:'80',6:'1200'},
  7:{4:'3',5:'25',6:'450',7:'8000'},
  8:{4:'2',5:'12',6:'100',7:'1400',8:'14000'},
  9:{4:'2',5:'8',6:'30',7:'260',8:'2200',9:'20000'},
  10:{5:'3',6:'27',7:'130',8:'1200',9:'10000',10:'20000'}
});
export function proposedGrossMultiplier(picks,hits){
 if(!Number.isInteger(picks)||picks<1||picks>10||!Number.isInteger(hits)||hits<0||hits>picks)throw Error('Invalid Keno payout row');
 return KENO_CANDIDATE_GROSS_MULTIPLIERS[picks][hits]??'0';
}
