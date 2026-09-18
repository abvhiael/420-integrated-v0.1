import { availability, validateRuntimeConfig } from './core/config.js';
import { createStatusBadge } from './core/design-system.js';
import { ExchangeDataLayer } from './core/exchange-data.js';
import { Watchlist, filterMarkets, freshnessState, normalizeMarket, sortMarkets } from './core/markets.js';
import { aggregateTradesToCandles, bucketSecondsForWindow, candleGeometry, normalizeCandle, normalizeTrade, reconcileHistory } from './core/market-detail.js';
import { ROUTES, routeFor } from './core/router.js';
import { SwapLifecycle, buildSwapIntent, canSubmitSwap, normalizeRouteQuote } from './core/swap.js';
import { buildLimitOrderDraft, canCancelOrder, normalizeOrderRecord, signedPriceFloor, validateFillPrice } from './core/limit-orders.js';
import { bridgeQualification, buildBridgeIntent, canSubmitBridge, normalizeBridgeRoute, normalizeSettlement, settlementProgress } from './core/bridge.js';
import { activityState, explorerHref, mergeActivity, normalizeBalance, portfolioSummary } from './core/portfolio.js';
import { WalletController, WalletSession, buildSigningRequest, signingGate, validateNetwork } from './core/wallet-session.js';
import { classifyApiFailure, focusAfterRender, onlineState } from './core/reliability.js';

const state = {
  config: null,
  route: routeFor(window.location.pathname),
  bootError: null,
  dataLayer: null,
  markets: [],
  marketSource: 'unavailable',
  marketQuery: '',
  marketSort: 'symbol:asc',
  watchOnly: false,
  watchlist: new Watchlist(globalThis.localStorage),
  detailSubjectId: new URLSearchParams(window.location.search).get('subject'),
  detailWindow: '1h',
  detailHistory: null,
  swapQuote: null,
  swapIntent: null,
  swapLifecycle: new SwapLifecycle(),
  swapSlippageBps: 100,
  orders: [],
  orderDraft: null,
  bridgeRoutes: [],
  bridgeSettlements: [],
  bridgeIntent: null,
  bridgeRouteId: null,
  portfolioBalances: [],
  portfolioActivity: [],
  walletController: null,
  walletSession: new WalletSession(),
  swapIntentGeneration: null,
  orderDraftGeneration: null,
  bridgeIntentGeneration: null,
  signingRequest: null,
  online: globalThis.navigator?.onLine !== false,
  reliabilityMessage: '',
};

const $ = (selector) => document.querySelector(selector);
const formatNumber = (value, maximumFractionDigits = 6) =>
  value === null || value === undefined ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits }).format(value);
const formatChange = (value) => value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const appendLabeledCells = (tr, headers, values) => {
  values.forEach((value,index)=>{
    const td=document.createElement('td');
    td.dataset.label=headers[index] ?? '';
    td.textContent=String(value);
    tr.append(td);
  });
};

function navLink(route) {
  const enabled = availability(state.config, route.feature);
  const link = document.createElement('a');
  link.className = `nav-item${state.route.id === route.id ? ' active' : ''}${enabled ? '' : ' unavailable'}`;
  link.href = route.path;
  link.dataset.route = route.path;
  link.textContent = route.label;
  link.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  return link;
}

function renderNavigation() {
  $('#nav').replaceChildren(...ROUTES.map(navLink));
}

function renderRuntime() {
  $('#site-origin').textContent = state.config?.site?.productionOrigin ?? 'unavailable';
  $('#network-name').textContent = state.config?.network?.name ?? 'unavailable';
  $('#api-schema').textContent = state.config ? `v${state.config.api.schemaMajor}.${state.config.api.schemaMinor}` : 'unavailable';
  $('#data-mode').textContent = state.marketSource === 'demo'
    ? 'Demo fixtures · clearly non-live'
    : state.config?.api?.baseUrl ? 'Configured V13 read API' : 'Read-only shell / endpoints unset';
}


function walletReady() {
  return validateNetwork(state.walletSession,state.config?.network?.chainId).ok && state.walletSession.status==='CONNECTED';
}

function invalidateReviewedIntents() {
  state.swapIntent=null;
  state.orderDraft=null;
  state.bridgeIntent=null;
  state.swapIntentGeneration=null;
  state.orderDraftGeneration=null;
  state.bridgeIntentGeneration=null;
  state.signingRequest=null;
  if(state.swapQuote){
    state.swapLifecycle=new SwapLifecycle();
    state.swapLifecycle.quoted();
  }
}

function renderWalletChrome() {
  const button=$('#connect');
  if(!button) return;
  if(!availability(state.config,'walletConnection')){
    button.disabled=true;
    button.textContent='Wallet unavailable';
    return;
  }
  button.disabled=false;
  const session=state.walletSession;
  if(session.status==='CONNECTING') {
    button.disabled=true;
    button.textContent='Connecting wallet…';
  } else if(session.status==='CONNECTED') {
    button.textContent=`${session.account.slice(0,6)}…${session.account.slice(-4)}`;
  } else if(session.status==='WRONG_CHAIN') {
    button.textContent='Switch network';
  } else {
    button.textContent='Connect wallet';
  }
}

async function connectOrSwitchWallet() {
  if(state.walletSession.status==='WRONG_CHAIN' && state.walletController){
    await state.walletController.switchChain();
    invalidateReviewedIntents();
    render();
    return;
  }
  const provider=globalThis.ethereum;
  if(!provider || typeof provider.request!=='function') throw new Error('No EIP-1193 wallet provider detected');
  state.walletController=new WalletController(provider,{expectedChainId:state.config?.network?.chainId});
  state.walletSession=state.walletController.session;
  state.walletController.bind({onInvalidate:()=>{
    invalidateReviewedIntents();
    render();
  }});
  await state.walletController.connect();
  render();
}

function reviewSigningRequest(kind,intent,intentGeneration) {
  state.signingRequest=buildSigningRequest({
    session:state.walletSession,
    expectedChainId:state.config?.network?.chainId,
    intent,
    intentGeneration,
    kind,
  });
  return state.signingRequest;
}


function announce(message,{assertive=false}={}){
  const region=$(assertive?'#status-alert':'#status-live');
  if(region) region.textContent=String(message??'');
}

function renderReliabilityChrome(){
  const network=$('#connectivity-state');
  if(network){
    network.textContent=state.online?'Online':'Offline';
    network.dataset.state=state.online?'ready':'error';
  }
  if(state.reliabilityMessage) announce(state.reliabilityMessage,{assertive:true});
}

function preserveFocusRender(){
  const active=document.activeElement;
  const id=active?.id??null;
  render();
  focusAfterRender({previousId:id,documentRef:document});
}

function currentMarkets() {
  const watched = state.watchlist.values();
  let markets = filterMarkets(state.markets, state.marketQuery);
  if (state.watchOnly) markets = markets.filter((market) => watched.has(market.marketSubjectId));
  const [field, direction] = state.marketSort.split(':');
  return sortMarkets(markets, field, direction);
}

function marketRow(market) {
  const tr = document.createElement('tr');
  tr.dataset.marketSubjectId = market.marketSubjectId;
  const watched = state.watchlist.values().has(market.marketSubjectId);
  const fresh = state.marketSource === 'demo' ? 'degraded' : freshnessState(market, Math.floor(Date.now() / 1000));

  const watch = document.createElement('td');
  const watchButton = document.createElement('button');
  watchButton.type = 'button';
  watchButton.className = 'watch-button';
  watchButton.dataset.watchMarket = market.marketSubjectId;
  watchButton.setAttribute('aria-label', watched ? `Remove ${market.label} from watchlist` : `Add ${market.label} to watchlist`);
  watchButton.setAttribute('aria-pressed', String(watched));
  watchButton.textContent = watched ? '★' : '☆';
  watch.append(watchButton);

  const name = document.createElement('td');
  const marketName = document.createElement('strong');
  marketName.textContent = market.label;
  const marketId = document.createElement('small');
  marketId.className = 'market-id';
  marketId.textContent = market.marketSubjectId;
  const marketLink = document.createElement('button');
  marketLink.type = 'button';
  marketLink.className = 'market-link';
  marketLink.dataset.openMarket = market.marketSubjectId;
  marketLink.append(marketName, marketId);
  name.append(marketLink);

  const last = document.createElement('td');
  last.className = 'numeric';
  last.textContent = formatNumber(market.lastPrice, 8);

  const change = document.createElement('td');
  change.className = 'numeric';
  change.textContent = formatChange(market.changePct);
  change.dataset.direction = market.changePct === null ? 'flat' : market.changePct >= 0 ? 'up' : 'down';

  const spread = document.createElement('td');
  spread.className = 'numeric';
  spread.textContent = `${formatNumber(market.bestBid, 8)} / ${formatNumber(market.bestAsk, 8)}`;

  const volume = document.createElement('td');
  volume.className = 'numeric';
  volume.textContent = formatNumber(market.quoteVolume);

  const liquidity = document.createElement('td');
  liquidity.className = 'numeric';
  liquidity.textContent = formatNumber(market.liquidity);

  const route = document.createElement('td');
  route.append(createStatusBadge(document, market.routeHealthy ? 'routeHealthy' : 'routeUnhealthy'));

  const settlement = document.createElement('td');
  settlement.append(createStatusBadge(document, market.settlementHealthy ? 'settlementHealthy' : 'settlementUnhealthy'));

  const freshness = document.createElement('td');
  freshness.append(createStatusBadge(document, fresh === 'canonical' ? 'canonical' : fresh === 'stale' ? 'stale' : 'degraded'));

  tr.append(watch, name, last, change, spread, volume, liquidity, route, settlement, freshness);
  return tr;
}

function refreshMarketView(root = document) {
  const rows = root.querySelector('#market-rows');
  if (!rows) return;
  const visible = currentMarkets();
  rows.replaceChildren(...visible.map(marketRow));
  root.querySelector('#market-empty').hidden = visible.length !== 0;
  const source = root.querySelector('#market-source');
  if (source) source.textContent = state.marketSource === 'demo'
    ? 'DEMO DATA · not live market state'
    : state.marketSource === 'api'
      ? 'V13 snapshot data'
      : 'No market source configured';
  const watched = state.watchlist.values().size;
  const summary = root.querySelector('#market-summary');
  if (summary) summary.textContent = `${visible.length} market${visible.length === 1 ? '' : 's'} shown · ${watched} watched`;
}

function renderMarkets(fragment) {
  fragment.querySelector('#market-search').value = state.marketQuery;
  fragment.querySelector('#market-sort').value = state.marketSort;
  fragment.querySelector('#watch-only').checked = state.watchOnly;
  refreshMarketView(fragment);
}


function selectedMarket() {
  return state.markets.find((market) => market.marketSubjectId === state.detailSubjectId) ?? state.markets[0] ?? null;
}

function drawCandles(svg, candles) {
  const geometry = candleGeometry(candles, 720, 280, 24);
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 720 280');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'OHLCV price chart');
  const ns = 'http://www.w3.org/2000/svg';
  for (const candle of geometry) {
    const wick = document.createElementNS(ns, 'line');
    wick.setAttribute('x1', candle.x);
    wick.setAttribute('x2', candle.x);
    wick.setAttribute('y1', candle.highY);
    wick.setAttribute('y2', candle.lowY);
    wick.setAttribute('class', `candle-wick ${candle.direction}`);

    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('x', candle.x - candle.bodyWidth / 2);
    body.setAttribute('width', candle.bodyWidth);
    body.setAttribute('y', Math.min(candle.openY, candle.closeY));
    body.setAttribute('height', Math.max(2, Math.abs(candle.openY - candle.closeY)));
    body.setAttribute('class', `candle-body ${candle.direction}`);
    svg.append(wick, body);
  }
}

async function loadDetailHistory(subjectId) {
  if (state.marketSource === 'api' && state.dataLayer) {
    const tradesPage = await state.dataLayer.loadHistory({kind:'TRADE',subjectId,activeOnly:false,limit:100});
    const trades = tradesPage.records.map(normalizeTrade);
    state.detailHistory = {
      candles: aggregateTradesToCandles(trades, bucketSecondsForWindow(state.detailWindow)),
      trades,
      source: 'api',
    };
    return;
  }
  const response = await fetch('./fixtures/market-detail.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`detail fixture ${response.status}`);
  const fixture = await response.json();
  state.detailHistory = {
    candles: fixture.candles.map(normalizeCandle),
    trades: fixture.trades.map(normalizeTrade),
    source: 'demo',
  };
}

function renderDetail(fragment) {
  const market = selectedMarket();
  if (!market) return;

  fragment.querySelector('#detail-pair').textContent = market.label;
  fragment.querySelector('#detail-market-id').textContent = market.marketSubjectId;
  fragment.querySelector('#detail-last').textContent = formatNumber(market.lastPrice, 8);
  fragment.querySelector('#detail-bid').textContent = formatNumber(market.bestBid, 8);
  fragment.querySelector('#detail-ask').textContent = formatNumber(market.bestAsk, 8);
  fragment.querySelector('#detail-volume').textContent = formatNumber(market.quoteVolume);
  fragment.querySelector('#detail-liquidity').textContent = formatNumber(market.liquidity);
  fragment.querySelector('#detail-window').value = state.detailWindow;
  fragment.querySelector('#detail-source').textContent = state.detailHistory?.source === 'demo'
    ? 'DEMO HISTORY · not live'
    : 'V13 historical query';

  const fresh = state.marketSource === 'demo' ? 'degraded' : freshnessState(market, Math.floor(Date.now()/1000));
  fragment.querySelector('#detail-status').append(createStatusBadge(document, fresh === 'canonical' ? 'canonical' : fresh === 'stale' ? 'stale' : 'degraded'));
  fragment.querySelector('#detail-route').append(createStatusBadge(document, market.routeHealthy ? 'routeHealthy' : 'routeUnhealthy'));
  fragment.querySelector('#detail-settlement').append(createStatusBadge(document, market.settlementHealthy ? 'settlementHealthy' : 'settlementUnhealthy'));

  const candles = state.detailHistory?.candles ?? [];
  drawCandles(fragment.querySelector('#detail-chart'), candles);

  const activity = reconcileHistory([...(state.detailHistory?.trades ?? []), ...candles]);
  const activityBody = fragment.querySelector('#detail-activity');
  activityBody.replaceChildren(...activity.map((record)=>{
    const tr=document.createElement('tr');
    appendLabeledCells(tr,['Record','Price','Amount / volume','State','Replacement'],[
      record.recordId,
      record.price ?? record.close ?? '—',
      record.amount ?? record.volume ?? '—',
      record.state,
      record.replacedBy ?? '—',
    ]);
    return tr;
  }));

  const tape = fragment.querySelector('#trade-tape');
  const seen=new Set();
  const trades=(state.detailHistory?.trades ?? []).filter((trade)=>{
    if (seen.has(trade.recordId)) return false;
    seen.add(trade.recordId);
    return true;
  });
  tape.replaceChildren(...trades.map((trade)=>{
    const li=document.createElement('li');
    li.textContent=`${trade.side.toUpperCase()} · ${formatNumber(trade.amount)} @ ${formatNumber(trade.price,8)} · ${trade.active ? 'canonical' : 'reorg'}`;
    return li;
  }));
}


async function loadSwapQuote() {
  const response = await fetch('./fixtures/swap-quote.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`swap fixture ${response.status}`);
  state.swapQuote = normalizeRouteQuote(await response.json());
  state.swapLifecycle = new SwapLifecycle();
  state.swapLifecycle.quoted();
}

function renderSwap(fragment) {
  const quote=state.swapQuote;
  const market=state.markets.find((item)=>item.marketSubjectId===quote?.marketSubjectId) ?? state.markets[0] ?? null;
  const recipient=fragment.querySelector('#swap-recipient');
  const review=fragment.querySelector('#swap-review');
  const submit=fragment.querySelector('#swap-submit');
  const source=fragment.querySelector('#swap-source');

  fragment.querySelector('#swap-market').textContent=market?.label ?? quote?.marketSubjectId ?? '—';
  fragment.querySelector('#swap-amount-in').textContent=formatNumber(quote?.amountIn);
  fragment.querySelector('#swap-gross-out').textContent=formatNumber(quote?.grossAmountOut);
  fragment.querySelector('#swap-fee').textContent=formatNumber(quote?.feeAmount);
  fragment.querySelector('#swap-net-out').textContent=formatNumber(quote?.netAmountOut);
  fragment.querySelector('#swap-min-out').textContent=formatNumber(quote?.finalMinAmountOut);
  fragment.querySelector('#swap-slippage').value=String(state.swapSlippageBps/100);
  source.textContent=quote?.demo ? 'DEMO QUOTE · review only' : 'Qualified execution quote';

  const route=fragment.querySelector('#swap-route');
  route.replaceChildren(...(quote?.hops ?? []).map((hop,index)=>{
    const li=document.createElement('li');
    li.textContent=`Hop ${index+1}: ${hop.inputToken} → ${hop.outputToken} · min ${formatNumber(hop.minAmountOut)}`;
    return li;
  }));

  const routeStatus=fragment.querySelector('#swap-route-health');
  routeStatus.append(createStatusBadge(document, quote?.routeHealthy ? 'routeHealthy' : 'routeUnhealthy'));
  const settlementStatus=fragment.querySelector('#swap-settlement-health');
  settlementStatus.append(createStatusBadge(document, quote?.settlementHealthy ? 'settlementHealthy' : 'settlementUnhealthy'));

  review.addEventListener('click',()=>{
    try {
      state.swapIntent=buildSwapIntent(quote,{recipient:recipient.value.trim(),slippageBps:state.swapSlippageBps});
      state.swapIntentGeneration=state.walletSession.generation;
      if (state.swapLifecycle.state==='quoted') state.swapLifecycle.review();
      render();
    } catch (error) {
      state.swapLifecycle.failed(error);
      render();
    }
  });

  const reviewed=state.swapIntent && state.swapLifecycle.state==='review';
  fragment.querySelector('#swap-review-panel').hidden=!reviewed;
  if (reviewed) {
    fragment.querySelector('#swap-review-kind').textContent=state.swapIntent.kind;
    fragment.querySelector('#swap-review-recipient').textContent=state.swapIntent.recipient;
    fragment.querySelector('#swap-review-route').textContent=state.swapIntent.routeCommitment ?? 'uncommitted';
    fragment.querySelector('#swap-review-final-min').textContent=formatNumber(state.swapIntent.finalMinAmountOut);
  }

  const sessionGate=signingGate({session:state.walletSession,expectedChainId:state.config?.network?.chainId,intent:state.swapIntent,intentGeneration:state.swapIntentGeneration});
  const gate=canSubmitSwap({quote,intent:state.swapIntent,nowSeconds:Math.floor(Date.now()/1000),walletReady:sessionGate.ok});
  submit.disabled=!gate.ok;
  submit.textContent=gate.ok ? 'Prepare wallet signing' : sessionGate.reason==='chain-unconfigured' ? 'Network not configured' : sessionGate.reason==='chain-mismatch' ? 'Switch network' : 'Connect wallet to sign';
  fragment.querySelector('#swap-lifecycle').textContent=state.swapLifecycle.state;
}


async function loadOrders() {
  if (state.marketSource === 'api' && state.dataLayer) {
    const page = await state.dataLayer.loadHistory({kind:'ORDER',activeOnly:false,limit:100});
    state.orders = page.records.map((record)=>normalizeOrderRecord(record));
    return;
  }
  const response = await fetch('./fixtures/limit-orders.json', { cache:'no-store' });
  if (!response.ok) throw new Error(`order fixtures ${response.status}`);
  state.orders = (await response.json()).map((record)=>normalizeOrderRecord(record));
}

function renderOrders(fragment) {
  const source=fragment.querySelector('#orders-source');
  source.textContent = state.marketSource === 'api' ? 'V13 order history' : 'DEMO ORDERS · review only';

  const market=state.markets[0] ?? null;
  fragment.querySelector('#order-primary-market').value=market?.marketSubjectId ?? '';
  fragment.querySelector('#order-sell-token').value=market?.baseSymbol ?? '420';
  fragment.querySelector('#order-buy-token').value=market?.quoteSymbol ?? 'USD';

  const tbody=fragment.querySelector('#orders-body');
  tbody.replaceChildren(...state.orders.map((record)=>{
    const tr=document.createElement('tr');
    const values=[
      record.orderHash || '—',
      `${record.sellAmount} ${record.sellToken}`,
      `${record.minTotalBuyAmount} ${record.buyToken}`,
      record.state,
      record.txHash || '—',
    ];
    appendLabeledCells(tr,['Order hash','Sell','Minimum buy','State','Transaction'],values);
    const action=document.createElement('td');
    const cancel=document.createElement('button');
    cancel.type='button';
    cancel.dataset.cancelOrder=record.orderHash;
    const gate=canCancelOrder(record,{walletReady:walletReady(),nowSeconds:Math.floor(Date.now()/1000)});
    cancel.disabled=!gate.ok;
    cancel.textContent=gate.ok?'Prepare cancellation':'Connect wallet to cancel';
    action.append(cancel);
    tr.append(action);
    return tr;
  }));

  const reviewPanel=fragment.querySelector('#order-review-panel');
  reviewPanel.hidden=!state.orderDraft;
  if(state.orderDraft){
    fragment.querySelector('#order-review-maker').textContent=state.orderDraft.maker;
    fragment.querySelector('#order-review-pair').textContent=`${state.orderDraft.sellToken} → ${state.orderDraft.buyToken}`;
    fragment.querySelector('#order-review-amount').textContent=String(state.orderDraft.sellAmount);
    fragment.querySelector('#order-review-min').textContent=String(state.orderDraft.minTotalBuyAmount);
    fragment.querySelector('#order-review-floor').textContent=String(signedPriceFloor(state.orderDraft));
    fragment.querySelector('#order-review-nonce').textContent=String(state.orderDraft.nonce);
    fragment.querySelector('#order-review-expiry').textContent=String(state.orderDraft.expiry);
    fragment.querySelector('#order-review-partial').textContent=state.orderDraft.allowPartial?'Allowed':'Not allowed';
  }
}

function captureOrderDraft() {
  const get=(id)=>document.querySelector(id)?.value ?? '';
  const allowPartial=Boolean(document.querySelector('#order-partial')?.checked);
  state.orderDraft=buildLimitOrderDraft({
    maker:get('#order-maker').trim(),
    sellToken:get('#order-sell-token').trim(),
    buyToken:get('#order-buy-token').trim(),
    sellAmount:get('#order-sell-amount'),
    minTotalBuyAmount:get('#order-min-buy'),
    recipient:get('#order-recipient').trim(),
    primaryMarket:get('#order-primary-market').trim(),
    nonce:get('#order-nonce'),
    expiry:get('#order-expiry'),
    allowPartial,
  });
  state.orderDraftGeneration=state.walletSession.generation;
}


async function loadBridgeData() {
  const [routesResponse,settlementsResponse]=await Promise.all([
    fetch('./fixtures/bridge-routes.json',{cache:'no-store'}),
    fetch('./fixtures/bridge-settlements.json',{cache:'no-store'}),
  ]);
  if(!routesResponse.ok||!settlementsResponse.ok) throw new Error('bridge fixtures unavailable');
  state.bridgeRoutes=(await routesResponse.json()).map(normalizeBridgeRoute);
  state.bridgeSettlements=(await settlementsResponse.json()).map(normalizeSettlement);
  state.bridgeRouteId=state.bridgeRouteId ?? state.bridgeRoutes[0]?.routeId ?? null;
}

function selectedBridgeRoute() {
  return state.bridgeRoutes.find((route)=>route.routeId===state.bridgeRouteId) ?? state.bridgeRoutes[0] ?? null;
}

function renderBridge(fragment) {
  const route=selectedBridgeRoute();
  const source=fragment.querySelector('#bridge-source');
  source.textContent='DEMO BRIDGE STATE · review only';

  const select=fragment.querySelector('#bridge-route-select');
  select.replaceChildren(...state.bridgeRoutes.map((item)=>{
    const option=document.createElement('option');
    option.value=item.routeId;
    option.textContent=`${item.sourceChain} → ${item.destinationChain} · ${item.routeId}`;
    return option;
  }));
  if(route) select.value=route.routeId;

  const gate=route?bridgeQualification(route):{ok:false,reason:'missing-route'};
  fragment.querySelector('#bridge-route-id').textContent=route?.routeId ?? '—';
  fragment.querySelector('#bridge-asset').textContent=route?.canonicalAsset ?? '—';
  fragment.querySelector('#bridge-adapter').textContent=route?.adapterId ?? '—';
  fragment.querySelector('#bridge-verifier').textContent=route?.verifierId ?? '—';
  fragment.querySelector('#bridge-fee').textContent=formatNumber(route?.bridgeFee ?? null);
  fragment.querySelector('#bridge-route-status').append(createStatusBadge(document,gate.ok?'routeHealthy':'routeUnhealthy'));
  fragment.querySelector('#bridge-settlement-status').append(createStatusBadge(document,route?.settlementHealthy?'settlementHealthy':'settlementUnhealthy'));
  fragment.querySelector('#bridge-availability').textContent=gate.ok?'Qualified':'Unavailable: '+gate.reason;

  const review=fragment.querySelector('#bridge-review');
  review.addEventListener('click',()=>{
    try{
      const amount=fragment.querySelector('#bridge-amount').value;
      const recipient=fragment.querySelector('#bridge-recipient').value.trim();
      state.bridgeIntent=buildBridgeIntent(route,{amount,recipient});
      state.bridgeIntentGeneration=state.walletSession.generation;
      render();
    }catch(error){
      state.bootError=error; render();
    }
  });

  const panel=fragment.querySelector('#bridge-review-panel');
  panel.hidden=!state.bridgeIntent;
  if(state.bridgeIntent){
    fragment.querySelector('#bridge-review-kind').textContent=state.bridgeIntent.kind;
    fragment.querySelector('#bridge-review-route').textContent=state.bridgeIntent.routeId;
    fragment.querySelector('#bridge-review-asset').textContent=state.bridgeIntent.canonicalAsset;
    fragment.querySelector('#bridge-review-recipient').textContent=state.bridgeIntent.recipient;
    fragment.querySelector('#bridge-review-amount').textContent=String(state.bridgeIntent.amount);
    fragment.querySelector('#bridge-review-fee').textContent=String(state.bridgeIntent.quotedBridgeFee);
  }

  const submit=fragment.querySelector('#bridge-submit');
  const bridgeSessionGate=signingGate({session:state.walletSession,expectedChainId:state.config?.network?.chainId,intent:state.bridgeIntent,intentGeneration:state.bridgeIntentGeneration});
  const submitGate=canSubmitBridge({route,intent:state.bridgeIntent,walletReady:bridgeSessionGate.ok});
  submit.disabled=!submitGate.ok;
  submit.textContent=submitGate.ok?'Prepare wallet signing':bridgeSessionGate.reason==='chain-unconfigured'?'Network not configured':bridgeSessionGate.reason==='chain-mismatch'?'Switch network':'Connect wallet to sign';

  const settlements=fragment.querySelector('#bridge-settlements');
  settlements.replaceChildren(...state.bridgeSettlements.map((record)=>{
    const tr=document.createElement('tr');
    const progress=settlementProgress(record);
    const values=[
      record.settlementId,
      record.state,
      `${progress.percent}%`,
      record.attestationId??'—',
      record.proofId??'—',
      record.txHash??'—',
      record.state==='FAILED' ? (record.retryable?'Retry after route revalidation':'Terminal') : '—',
    ];
    appendLabeledCells(tr,['Settlement','State','Progress','Attestation','Proof','Transaction','Guidance'],values);
    return tr;
  }));
}


async function loadPortfolioData() {
  const [balancesResponse,activityResponse]=await Promise.all([
    fetch('./fixtures/portfolio-balances.json',{cache:'no-store'}),
    fetch('./fixtures/portfolio-activity.json',{cache:'no-store'}),
  ]);
  if(!balancesResponse.ok||!activityResponse.ok) throw new Error('portfolio fixtures unavailable');
  state.portfolioBalances=(await balancesResponse.json()).map(normalizeBalance);
  state.portfolioActivity=mergeActivity(await activityResponse.json());
}

function renderPortfolio(fragment) {
  fragment.querySelector('#portfolio-source').textContent='DEMO PORTFOLIO · not live wallet state';
  const summary=portfolioSummary(state.portfolioBalances);
  fragment.querySelector('#portfolio-assets').textContent=String(summary.assetCount);
  fragment.querySelector('#portfolio-canonical-assets').textContent=String(summary.canonicalAssetCount);
  fragment.querySelector('#portfolio-locked').textContent=formatNumber(summary.totalLocked);

  const balances=fragment.querySelector('#portfolio-balances');
  balances.replaceChildren(...state.portfolioBalances.map((balance)=>{
    const card=document.createElement('article');
    card.className='component-card balance-card';
    const title=document.createElement('h3'); title.textContent=balance.symbol;
    const total=document.createElement('strong'); total.textContent=formatNumber(balance.balance);
    const meta=document.createElement('p'); meta.className='muted';
    meta.textContent=`Available ${formatNumber(balance.available)} · Locked ${formatNumber(balance.locked)} · Source ${balance.source}`;
    const badge=createStatusBadge(document,balance.canonical?'canonical':'degraded');
    card.append(title,total,meta,badge);
    return card;
  }));

  const openOrders=state.orders.filter((order)=>order.state==='OPEN'||order.state==='PARTIAL');
  const orderBody=fragment.querySelector('#portfolio-orders');
  orderBody.replaceChildren(...openOrders.map((order)=>{
    const tr=document.createElement('tr');
    appendLabeledCells(tr,['Order hash','Sell','Minimum buy','State'],[order.orderHash||'—',`${order.sellAmount} ${order.sellToken}`,`${order.minTotalBuyAmount} ${order.buyToken}`,order.state]);
    return tr;
  }));

  const activityBody=fragment.querySelector('#portfolio-activity');
  activityBody.replaceChildren(...state.portfolioActivity.map((record)=>{
    const tr=document.createElement('tr');
    const stateLabel=activityState(record);
    appendLabeledCells(tr,['Kind','Amount','State','Fee','Transaction'],[
      record.kind,
      record.amount===null?'—':`${formatNumber(record.amount)} ${record.assetSymbol??''}`,
      stateLabel,
      record.feeAmount===null?'—':formatNumber(record.feeAmount),
      record.txHash??'—',
    ]);
    const provenance=document.createElement('td');
    const href=explorerHref(state.config?.network?.explorerUrl,record.txHash);
    if(href){
      const a=document.createElement('a'); a.href=href; a.textContent='Explorer'; a.rel='noopener noreferrer'; provenance.append(a);
    } else provenance.textContent='—';
    provenance.dataset.label='Provenance';
    tr.append(provenance);
    return tr;
  }));
}

function renderView() {
  $('#page-title').textContent = state.route.label;
  const view = $('#app-view');
  view.replaceChildren();

  if (state.bootError) {
    $('#data-state').textContent = 'Degraded';
    $('#data-state').dataset.state = 'error';
    const card = document.createElement('div');
    card.className = 'error-state';
    const failure=classifyApiFailure(state.bootError);
    card.innerHTML = '<strong>Exchange unavailable.</strong><p>No market or transaction state will be invented locally.</p>';
    const detail=document.createElement('p');
    detail.className='muted';
    detail.textContent=failure.message;
    card.append(detail);
    view.append(card);
    announce(failure.message,{assertive:true});
    return;
  }

  $('#data-state').textContent = state.marketSource === 'api' ? 'V13 data' : state.marketSource === 'demo' ? 'Demo' : 'Shell only';
  $('#data-state').dataset.state = state.marketSource === 'api' ? 'ready' : 'degraded';

  if (state.route.id === 'markets' && availability(state.config, 'markets')) {
    const fragment = $('#markets-template').content.cloneNode(true);
    renderMarkets(fragment);
    view.append(fragment);
    return;
  }

  if (state.route.id === 'market' && availability(state.config, 'marketDetail')) {
    const fragment = $('#market-detail-template').content.cloneNode(true);
    renderDetail(fragment);
    view.append(fragment);
    return;
  }

  if (state.route.id === 'swap' && availability(state.config, 'swap')) {
    const fragment = $('#swap-template').content.cloneNode(true);
    renderSwap(fragment);
    view.append(fragment);
    return;
  }

  if (state.route.id === 'orders' && availability(state.config, 'limitOrders')) {
    const fragment = $('#orders-template').content.cloneNode(true);
    renderOrders(fragment);
    view.append(fragment);
    return;
  }

  if (state.route.id === 'bridge' && availability(state.config, 'bridge')) {
    const fragment = $('#bridge-template').content.cloneNode(true);
    renderBridge(fragment);
    view.append(fragment);
    return;
  }

  if (state.route.id === 'portfolio' && availability(state.config, 'portfolio')) {
    const fragment = $('#portfolio-template').content.cloneNode(true);
    renderPortfolio(fragment);
    view.append(fragment);
    return;
  }

  const fragment = $('#gated-template').content.cloneNode(true);
  fragment.querySelector('#gated-title').textContent = `${state.route.label} is roadmap-gated`;
  fragment.querySelector('#gated-copy').textContent =
    'The route is reserved now so navigation and deep links remain stable, but feature logic stays disabled until its V14 phase qualifies.';
  view.append(fragment);
}

function render() {
  renderNavigation();
  renderRuntime();
  renderWalletChrome();
  renderReliabilityChrome();
  renderView();
}

function navigate(path) {
  state.route = routeFor(path);
  history.pushState({}, '', state.route.path);
  if (state.route.id === 'swap' && !state.swapQuote) {
    loadSwapQuote().then(render).catch((error)=>{ state.bootError=error; render(); });
    return;
  }
  if (state.route.id === 'orders' && !state.orders.length) {
    loadOrders().then(render).catch((error)=>{ state.bootError=error; render(); });
    return;
  }
  if (state.route.id === 'bridge' && !state.bridgeRoutes.length) {
    loadBridgeData().then(render).catch((error)=>{ state.bootError=error; render(); });
    return;
  }
  if (state.route.id === 'portfolio' && !state.portfolioBalances.length) {
    Promise.all([loadPortfolioData(), state.orders.length?Promise.resolve():loadOrders()]).then(render).catch((error)=>{ state.bootError=error; render(); });
    return;
  }
  render();
}

document.addEventListener('click', (event) => {
  const connect = event.target.closest('#connect');
  if (connect) {
    connectOrSwitchWallet().catch((error)=>{ state.walletSession.failed(error); render(); });
    return;
  }
  const swapSubmit=event.target.closest('#swap-submit');
  if(swapSubmit && state.swapIntent){
    try { reviewSigningRequest('SWAP',state.swapIntent,state.swapIntentGeneration); render(); } catch(error){ state.walletSession.failed(error); render(); }
    return;
  }
  const orderSign=event.target.closest('#order-sign');
  if(orderSign && state.orderDraft){
    try { reviewSigningRequest('LIMIT_ORDER',state.orderDraft,state.orderDraftGeneration); render(); } catch(error){ state.walletSession.failed(error); render(); }
    return;
  }
  const bridgeSubmit=event.target.closest('#bridge-submit');
  if(bridgeSubmit && state.bridgeIntent){
    try { reviewSigningRequest('BRIDGE',state.bridgeIntent,state.bridgeIntentGeneration); render(); } catch(error){ state.walletSession.failed(error); render(); }
    return;
  }
  const link = event.target.closest('[data-route]');
  if (link) {
    event.preventDefault();
    navigate(link.dataset.route);
    return;
  }
  const watch = event.target.closest('[data-watch-market]');
  if (watch) {
    state.watchlist.toggle(watch.dataset.watchMarket);
    refreshMarketView();
    announce('Watchlist updated');
    return;
  }
  const orderReview = event.target.closest('#order-review');
  if (orderReview) {
    try { captureOrderDraft(); render(); } catch (error) { state.bootError=error; render(); }
    return;
  }
  const cancelOrder = event.target.closest('[data-cancel-order]');
  if (cancelOrder) {
    return;
  }
  const openMarket = event.target.closest('[data-open-market]');
  if (openMarket) {
    state.detailSubjectId = openMarket.dataset.openMarket;
    history.pushState({}, '', `/market?subject=${encodeURIComponent(state.detailSubjectId)}`);
    state.route = routeFor('/market');
    loadDetailHistory(state.detailSubjectId).then(render).catch((error)=>{ state.bootError = error; render(); });
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'market-search') {
    state.marketQuery = event.target.value;
    refreshMarketView();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'market-sort') {
    state.marketSort = event.target.value;
    refreshMarketView();
  } else if (event.target.id === 'watch-only') {
    state.watchOnly = event.target.checked;
    refreshMarketView();
  } else if (event.target.id === 'detail-window') {
    state.detailWindow = event.target.value;
    if (state.marketSource === 'api' && state.detailSubjectId) {
      loadDetailHistory(state.detailSubjectId).then(render).catch((error)=>{ state.bootError=error; render(); });
    } else {
      render();
    }
  } else if (event.target.id === 'swap-slippage') {
    const value=Number(event.target.value);
    state.swapSlippageBps=Number.isFinite(value) ? Math.round(value*100) : 100;
  } else if (event.target.id === 'bridge-route-select') {
    state.bridgeRouteId=event.target.value;
    state.bridgeIntent=null;
    render();
  }
});

window.addEventListener('online',()=>{ state.online=true; state.reliabilityMessage='Connection restored'; render(); });
window.addEventListener('offline',()=>{ state.online=false; state.reliabilityMessage='You are offline. Existing data may become stale.'; render(); });

window.addEventListener('popstate', () => {
  state.route = routeFor(window.location.pathname);
  state.detailSubjectId = new URLSearchParams(window.location.search).get('subject');
  render();
});

async function loadMarketSource() {
  if (state.config.api.baseUrl && Array.isArray(state.config.api.marketSubjects) && state.config.api.marketSubjects.length) {
    state.dataLayer = new ExchangeDataLayer({
      baseUrl: state.config.api.baseUrl,
      streamUrl: state.config.api.streamUrl,
      transport: state.config.api.transport,
    });
    const snapshots = await Promise.all(state.config.api.marketSubjects.map((subjectId) => state.dataLayer.loadSnapshot(subjectId)));
    state.markets = snapshots.map(normalizeMarket);
    state.marketSource = 'api';
    return;
  }

  const response = await fetch('./fixtures/markets.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`demo market fixtures ${response.status}`);
  state.markets = (await response.json()).map(normalizeMarket);
  state.marketSource = 'demo';
}

async function boot() {
  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    state.config = validateRuntimeConfig(await response.json());
    await loadMarketSource();
    if (state.route.id === 'market') {
      state.detailSubjectId = state.detailSubjectId ?? state.markets[0]?.marketSubjectId ?? null;
      if (state.detailSubjectId) await loadDetailHistory(state.detailSubjectId);
    }
    if (state.route.id === 'swap') await loadSwapQuote();
    if (state.route.id === 'orders') await loadOrders();
    if (state.route.id === 'bridge') await loadBridgeData();
    if (state.route.id === 'portfolio') {
      await Promise.all([loadPortfolioData(), state.orders.length?Promise.resolve():loadOrders()]);
    }
  } catch (error) {
    state.bootError = error;
    state.config = state.config ?? {
      site: { productionOrigin: 'https://exchange.420integrated.org' },
      network: { name: '420 Integrated' },
      api: { schemaMajor: 14, schemaMinor: 0, baseUrl: null },
      features: Object.fromEntries(ROUTES.map((route) => [route.feature, route.id === 'markets'])),
    };
  }
  render();
}

boot();
