// R03.5 public client must not accept or manufacture regulated courier journeys.
export function courierJourney(_untrusted=null){
  return Object.freeze({offers:'UNAVAILABLE',navigation:'AUTHORIZATION_REQUIRED',
    custody:'SERVER_VERIFIED_ONLY',proofOfDelivery:'NOT_AVAILABLE',
    reason:'Courier journeys require independently authorized sessions, offers and custody evidence.'});
}
