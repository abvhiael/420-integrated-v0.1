// L02.7: display state is a server-confirmed projection, never inferred from a click.
export class DriverOfferError extends Error { constructor(code){super(code);this.name='DriverOfferError';this.code=code;} }
const fail=code=>{throw new DriverOfferError(code);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function availability(row,session,now){
 if(!row||!id(row.driverId)||!(id(row.vehicleId)||(row.vehicleId===null&&row.revision===0&&row.online===false))||!Number.isSafeInteger(row.revision)||row.revision<0||
 typeof row.online!=='boolean'||!Number.isSafeInteger(row.expiresAt)||!session||
 session.status!=='authenticated'||!session.roles?.includes('driver')||row.driverId!==session.subject||
 !Number.isSafeInteger(now)||now<0)fail('INVALID_AVAILABILITY');
 return Object.freeze({...row,active:row.online&&row.expiresAt>now});
}
export function offer(row,session,now){
 if(!row||!id(row.tripId)||!id(row.driverId)||!id(row.vehicleId)||!id(row.offerId)||
 !Number.isSafeInteger(row.revision)||row.revision<0||!Number.isSafeInteger(row.expiresAt)||
 !session||session.status!=='authenticated'||!session.roles?.includes('driver')||
 row.driverId!==session.subject||!Number.isSafeInteger(now)||now<0||
 !['PENDING','ACCEPTED','REJECTED','EXPIRED'].includes(row.status))fail('INVALID_OFFER');
 return Object.freeze({...row,remainingSeconds:Math.max(0,row.expiresAt-now),
 canRespond:row.status==='PENDING'&&row.expiresAt>now});
}
export function capacity(value){
 if(!Number.isSafeInteger(value)||value<1||value>12)fail('INVALID_CAPACITY');
 return value;
}
