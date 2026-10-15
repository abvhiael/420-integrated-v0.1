import {fixture} from './dispatch-fixture.mjs';
import {createFareRulesAdapter,createPickupViabilityAdapter} from '../../src/fare.mjs';
import {createQuoteService} from '../../src/quotes.mjs';
import {createTripService} from '../../src/service.mjs';
import {createHttpHandler} from '../../src/http.mjs';
export function quoteFixture(pool,pairs,controls) {
  const base=fixture(pool,pairs,controls);
  const authenticator={authorize:base.authenticator.authorize};
  // Separate Session authority signs the additional exact rider quote grants.
  // The common dispatch fixture's Session grant vocabulary is extended below.
  const rulesAdapter=createFareRulesAdapter({authority:base.roots[6],clock:base.clock,resolveRules:base.transport(6,'liftd_fare_rules',r=>({
    ...r,riderId:undefined,sub:r.riderId,country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',currency:'CAD',rulesRef:'fare_rules',revision:controls.rulesRevision??1,
    minimumFareCents:controls.minimumFareCents??1000,minimumDriverCentsPerHour:controls.minimumDriverCentsPerHour??2500,minimumAllowanceCentsPerKm:45,
    taxes:controls.taxes??[],passThrough:controls.passThrough??[],...(controls.rulesPatch??{})}))});
  const viabilityAdapter=createPickupViabilityAdapter({pickupAuthority:base.roots[7],subsidyAuthority:base.roots[8],clock:base.clock,
    resolvePickup:base.transport(7,'liftd_pickup_route',r=>({...r,sub:r.driverId,pickupMeters:controls.pickupByDriver?.[r.driverId]?.meters??controls.pickupMeters??500,pickupSeconds:controls.pickupByDriver?.[r.driverId]?.seconds??controls.pickupSeconds??60,...(controls.pickupPatch??{})})),
    resolveSubsidy:base.transport(8,'liftd_driver_subsidy',r=>({...r,requiredSubsidyCents:undefined,sub:r.driverId,amountCents:controls.subsidyCents??0,fundingRef:`funding_${r.tripId}`,reserved:controls.subsidyReserved??false,payer:'liftd-platform',...(controls.subsidyPatch??{})}))});
  const quoteService=createQuoteService({pool,authenticator,locationService:base.locationService,privateStore:base.privateStore,rulesAdapter,viabilityAdapter,quoteSeconds:120,clock:base.clock,isPaused:()=>controls.paused??false});
  const service=createTripService({authenticator,store:base.tripStore,privateLocationStore:base.privateStore,eligibilityAdapter:base.eligibilityAdapter,dispatchAdapter:base.dispatchAdapter,quoteService,clock:base.clock,isPaused:()=>controls.paused??false});
  const handler=createHttpHandler(service,base.locationService,base.dispatchAdapter,quoteService);
  const prepare=async(trip)=>{
    const token=base.token('rider','rider_fare',trip);
    const route=await base.locationService.prepare(token,{riderId:'rider_fare',commandId:base.cid(),passengerCount:2,pickup:{latitude:49.282731,longitude:-123.120739,precision:'exact'},dropoff:{latitude:49.29,longitude:-123.13,precision:'exact'}});
    const quote=await quoteService.issue(token,{riderId:'rider_fare',routeRef:route.routeRef,commandId:base.cid()});return {token,route,quote};
  };
  const consent=(token,quote,extra={})=>quoteService.accept(token,quote.quoteId,{riderId:'rider_fare',commandId:base.cid(),quoteHash:quote.quoteHash,currency:'CAD',totalCents:quote.amounts.totalCents,accepted:true,...extra});
  const create=async(trip)=>{const result=await prepare(trip);await consent(result.token,result.quote);await service.create(result.token,{id:trip,riderId:'rider_fare',routeRef:result.route.routeRef,quoteId:result.quote.quoteId,commandId:base.cid()});return result;};
  const transition=(role,subject,trip,action,revision,commandId=base.cid())=>service.transition(base.token(role,subject,trip),trip,{action,expectedRevision:revision,commandId});
  return {...base,quoteService,service,handler,prepare,consent,create,transition};
}
