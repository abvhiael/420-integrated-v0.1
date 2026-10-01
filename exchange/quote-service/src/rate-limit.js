export function createFixedWindowRateLimiter({maxRequests=60,windowMs=60_000,now=()=>Date.now()}={}){
  const state=new Map();
  return ({key='anonymous'}={})=>{
    const t=now();let entry=state.get(key);
    if(!entry||t-entry.start>=windowMs||t<entry.start){entry={start:t,count:0};state.set(key,entry);}
    entry.count++;
    return Object.freeze({allowed:entry.count<=maxRequests,remaining:Math.max(0,maxRequests-entry.count),retryAfterMs:Math.max(0,entry.start+windowMs-t)});
  };
}
