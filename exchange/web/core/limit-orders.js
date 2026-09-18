export const ORDER_STATES=Object.freeze(['OPEN','PARTIAL','FILLED','CANCELLED','EXPIRED']);

function positive(value,label){
  const n=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(n)||n<=0) throw new Error(`invalid ${label}`);
  return n;
}
function integer(value,label){
  const n=Number(value);
  if(!Number.isInteger(n)||n<0) throw new Error(`invalid ${label}`);
  return n;
}

export function buildLimitOrderDraft(input){
  const sellAmount=positive(input.sellAmount,'sellAmount');
  const minTotalBuyAmount=positive(input.minTotalBuyAmount,'minTotalBuyAmount');
  const expiry=integer(input.expiry,'expiry');
  const nonce=integer(input.nonce,'nonce');
  if(!input.maker||!input.sellToken||!input.buyToken||!input.recipient||!input.primaryMarket) throw new Error('limit order identity required');
  if(input.sellToken===input.buyToken) throw new Error('sell and buy token must differ');
  return Object.freeze({
    maker:String(input.maker),
    sellToken:String(input.sellToken),
    buyToken:String(input.buyToken),
    sellAmount,
    minTotalBuyAmount,
    recipient:String(input.recipient),
    primaryMarket:String(input.primaryMarket),
    nonce,
    expiry,
    allowPartial:Boolean(input.allowPartial),
  });
}

export function signedPriceFloor(order){
  const draft=buildLimitOrderDraft(order);
  return draft.minTotalBuyAmount/draft.sellAmount;
}

export function minimumBuyForFill(order,fillSellAmount){
  const draft=buildLimitOrderDraft(order);
  const fill=positive(fillSellAmount,'fillSellAmount');
  if(fill>draft.sellAmount) throw new Error('fill exceeds signed sell amount');
  if(!draft.allowPartial&&fill!==draft.sellAmount) throw new Error('partial fill not allowed');
  return Math.ceil((draft.minTotalBuyAmount*fill)/draft.sellAmount*1e12)/1e12;
}

export function normalizeOrderRecord(record){
  const order=buildLimitOrderDraft(record);
  const filledSell=Number(record.filledSellAmount??0);
  const bought=Number(record.boughtAmount??0);
  if(!Number.isFinite(filledSell)||filledSell<0||filledSell>order.sellAmount) throw new Error('invalid filled amount');
  if(!Number.isFinite(bought)||bought<0) throw new Error('invalid bought amount');
  let state=record.state;
  if(!ORDER_STATES.includes(state)){
    if(record.cancelled) state='CANCELLED';
    else if(record.expired) state='EXPIRED';
    else if(filledSell===0) state='OPEN';
    else if(filledSell<order.sellAmount) state='PARTIAL';
    else state='FILLED';
  }
  return {...order,orderHash:String(record.orderHash??''),filledSellAmount:filledSell,boughtAmount:bought,state,txHash:record.txHash??null,active:record.active!==false};
}

export function validateFillPrice(record){
  const order=normalizeOrderRecord(record);
  if(order.filledSellAmount===0) return true;
  return order.boughtAmount+1e-12>=minimumBuyForFill(order,order.filledSellAmount);
}

export function canCancelOrder(record,{walletReady=false,nowSeconds}={}){
  const order=normalizeOrderRecord(record);
  if(!walletReady) return {ok:false,reason:'wallet-unavailable'};
  if(order.state!=='OPEN'&&order.state!=='PARTIAL') return {ok:false,reason:'not-cancellable'};
  if(Number.isFinite(nowSeconds)&&nowSeconds>=order.expiry) return {ok:false,reason:'expired'};
  return {ok:true,reason:null};
}
