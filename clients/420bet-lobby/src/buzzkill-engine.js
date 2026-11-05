// BUZZKILL! — standalone practice-only Crash model. Never connected to wallet/chain.
export const BUZZ_RULES=Object.freeze({rtp:0.96,minBet:1,maxBet:100,defaultBalance:1000,rate:0.115,minAuto:1.01,maxAuto:100000});
const cents=x=>Math.round((x+Number.EPSILON)*100)/100;
const valid=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function secureUniform(){
  if(!globalThis.crypto?.getRandomValues)throw new Error('Secure random source unavailable');
  const bytes=new Uint32Array(2);globalThis.crypto.getRandomValues(bytes);
  const bits=bytes[0]*0x200000+Math.floor(bytes[1]/2048);
  return (bits+0.5)/9007199254740992;
}
// 4% instant bust, otherwise survival P(C >= m) = 0.96/m (m>1).
// Keep the true continuous crash point for exact crossing; round only the display.
export function sampleCrashPoint(rng=secureUniform){
  const u=rng();
  if(!valid(u,0,1)||u===1)throw new RangeError('Entropy must be in [0,1)');
  if(u>=BUZZ_RULES.rtp)return 1;
  return Math.min(1000000,BUZZ_RULES.rtp/Math.max(u,Number.EPSILON/2));
}
export function multiplierAt(ms){if(!Number.isFinite(ms)||ms<0)throw new RangeError('Invalid elapsed time');return Math.max(1,Math.exp(BUZZ_RULES.rate*ms/1000));}
export function tickDuration(target){if(!Number.isFinite(target)||target<1)throw new RangeError('Invalid target');return Math.log(target)/BUZZ_RULES.rate*1000;}
export function createBuzzkill({balance=BUZZ_RULES.defaultBalance,bet=10,autoTarget=4.20,rng=secureUniform}={}){
  if(!valid(balance,0,1e9)||!valid(bet,BUZZ_RULES.minBet,BUZZ_RULES.maxBet)||!valid(autoTarget,BUZZ_RULES.minAuto,BUZZ_RULES.maxAuto)||typeof rng!=='function')throw new RangeError('Invalid initial practice settings');
  return {phase:'ready',balance:cents(balance),bet:cents(bet),autoTarget:cents(autoTarget),autoEnabled:false,round:0,elapsed:0,multiplier:1,crashPoint:null,cashedAt:null,return:0,settled:false,history:[],rng,notice:'How high can Kevin get before Mom finds out?'};
}
export function buzzAction(s,action,value){
  if(action==='bet'&&s.phase!=='running'&&valid(value,BUZZ_RULES.minBet,BUZZ_RULES.maxBet)){s.bet=cents(value);return true;}
  if(action==='auto-target'&&s.phase!=='running'&&valid(value,BUZZ_RULES.minAuto,BUZZ_RULES.maxAuto)){s.autoTarget=cents(value);return true;}
  if(action==='auto-enabled'&&s.phase!=='running'){s.autoEnabled=!!value;return true;}
  if(action==='refill'&&s.phase!=='running'){s.balance=cents(s.balance+1000);return true;}
  if(action==='start'&&s.phase!=='running'&&s.balance>=s.bet){
    s.balance=cents(s.balance-s.bet);s.round++;s.phase='running';s.elapsed=0;s.multiplier=1;s.cashedAt=null;s.return=0;s.settled=false;
    s.crashPoint=sampleCrashPoint(s.rng);s.notice='Kevin is feeling groovy…';return true;
  }
  if(action==='cashout'&&s.phase==='running'&&!s.settled){
    // A cashout is allowed only while the visual/current multiplier is below the hidden crash point.
    if(s.crashPoint<=1||s.multiplier>=s.crashPoint)return buzzAction(s,'tick',s.elapsed);
    s.cashedAt=s.multiplier;s.return=cents(s.bet*s.multiplier);s.balance=cents(s.balance+s.return);s.settled=true;
    s.notice='Peace, love and perfect timing! Kevin stays groovy.';return true;
  }
  if(action==='tick'&&s.phase==='running'&&Number.isFinite(value)&&value>=s.elapsed){
    s.elapsed=value;
    const raw=multiplierAt(value);
    // Auto-target crossing happens at its exact threshold even if a slow frame skips past both
    // target and crash. A target at/above crash is never eligible.
    if(s.autoEnabled&&!s.settled&&s.autoTarget<s.crashPoint&&raw>=s.autoTarget){
      s.cashedAt=s.autoTarget;s.return=cents(s.bet*s.autoTarget);s.balance=cents(s.balance+s.return);s.settled=true;
      s.notice='Auto cash-out secured at '+s.autoTarget.toFixed(2)+'×.';
    }
    if(raw>=s.crashPoint){
      s.multiplier=s.crashPoint;s.phase='bust';s.notice='BUZZKILL! Mom opened the door.';
      s.history.unshift({round:s.round,crash:s.crashPoint,cashedAt:s.cashedAt,return:s.return});
      s.history.length=Math.min(s.history.length,12);return true;
    }
    // The floor-to-cent display never indicates a value beyond the hidden boundary.
    s.multiplier=Math.max(1,Math.floor(raw*100)/100);
    return true;
  }
  return false;
}
