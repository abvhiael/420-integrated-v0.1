// R03.3: no locally authenticated consumer account; integration stays disabled.
export const ACCOUNT_STATUS=Object.freeze({state:'UNAVAILABLE',reason:'Verified 420Identity consumer sessions are not connected to this website.'});
export const WALLET_STATUS=Object.freeze({state:'NOT_CONNECTED',reason:'Wallet connection is optional and does not prove age or delivery eligibility.'});
export const ORDER_STATUS=Object.freeze({state:'UNAVAILABLE',reason:'Signed-in consumer order history is unavailable.'});
export const RECEIPT_STATUS=Object.freeze({state:'NOT_VERIFIED',reason:'Receipts require independently verified retailer and 420Pay evidence.'});
export function consumerSnapshot(input=null){
  // Caller-supplied state, wallet hints or fabricated receipts may never become authority.
  void input;
  return Object.freeze({account:ACCOUNT_STATUS,wallet:WALLET_STATUS,orders:ORDER_STATUS,receipts:RECEIPT_STATUS});
}
