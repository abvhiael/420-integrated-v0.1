import {money} from './fare.mjs';
const ceil=(n,d)=>(n+d-1n)/d;
// CAD obligation projection only. Asset conversion/finality belongs to canonical Pay.
export function compensation({fareCents,taxesCents,passThroughCents,tipCents,refunds={fare:0,taxes:0,passThrough:0,tips:0},meter,completed,captured}) {
  for(const v of [fareCents,taxesCents,passThroughCents,tipCents,...Object.values(refunds),meter.engagedMeters,meter.engagedSeconds,meter.onlineSeconds,meter.minimumDriverCentsPerHour,meter.minimumAllowanceCentsPerKm])money(v);
  const F=BigInt(completed?fareCents:0),A=ceil(BigInt(Math.max(45,meter.minimumAllowanceCentsPerKm))*BigInt(meter.engagedMeters),1000n);
  const remainder=F>A?F-A:0n,earnings=ceil(80n*remainder,100n),commission=remainder-earnings;
  const guarantee=ceil(BigInt(Math.max(2500,meter.minimumDriverCentsPerHour))*BigInt(meter.engagedSeconds),3600n),topUp=guarantee>earnings?guarantee-earnings:0n;
  const tips=BigInt(captured?(completed?tipCents:Math.max(0,tipCents-refunds.tips)):0);
  const adjusted=captured?commission-topUp-(A>F?A-F:0n)-BigInt(completed?refunds.fare:0):0n;
  const development=adjusted>0n?20n*adjusted/100n:0n,operating=adjusted>0n?adjusted-development:0n;
  const pass=BigInt(captured?Math.max(0,taxesCents-refunds.taxes)+Math.max(0,passThroughCents-refunds.passThrough):0);
  const driver=A+earnings+topUp+tips;
  const available=BigInt(captured?fareCents+taxesCents+passThroughCents+tipCents-refunds.fare-refunds.taxes-refunds.passThrough-refunds.tips:0);
  const needed=driver+pass+development+operating;
  const platformFunding=needed>available?needed-available:0n;
  return Object.freeze({currency:'CAD',allowanceCents:money(A),earningsCents:money(earnings),guaranteeCents:money(guarantee),topUpCents:money(topUp),tipCents:money(tips),driverCents:money(driver),
    commissionCents:money(commission),developmentCents:money(development),platformCents:money(operating),passThroughCents:money(pass),platformFundingCents:money(platformFunding),
    netCollectedCents:money(available),engagedSeconds:meter.engagedSeconds,onlineSeconds:meter.onlineSeconds,periodId:meter.periodId,
    rounding:'driver-ceil-development-floor-platform-residue',developmentStatus:development>0?'HELD_CANONICAL_10_PERCENT_CEILING':'ZERO',
    conserved:available+platformFunding===needed});
}
export function periodStatement(plans) {
  const sum=field=>money(plans.reduce((n,p)=>n+BigInt(p[field]),0n));
  return Object.freeze({currency:'CAD',trips:plans.length,earningsCents:sum('earningsCents'),allowanceCents:sum('allowanceCents'),tipsCents:sum('tipCents'),topUpsCents:sum('topUpCents'),
    engagedSeconds:sum('engagedSeconds'),onlineSeconds:sum('onlineSeconds'),guaranteeBasis:'per-trip-ceiling-no-period-clawback',onlineTimeGuarantee:false});
}
