import {HighCountryPlacementTransactions} from './placement-transactions.js';
import {HighCountryPlacementAuthorityRegistry} from './placement-authority-registry.js';
import {HighCountryStoredInstanceTransfer} from './placement-instance-transfer.js';
import {HighCountryProductionPlacementAuthority} from './placement-production-authority.js';
import {CanonicalSocialEventIndexer} from './canonical-social-event-indexer.js';
import {SocialRecoveryWorker} from './social-recovery-worker.js';
import {SeedPurchases} from './seed-purchases.js';
import {SeedPaymentReader} from './seed-payment-reader.js';
import {SeedOpenings} from './seed-openings.js';
import {SeedOpeningChainReader} from './seed-opening-chain-reader.js';
import {SeedOpeningWorker} from './seed-opening-worker.js';
import {CanonicalSocialChainAdapter} from './canonical-social-chain-adapter.js';
import {CanonicalSocialGateway} from './canonical-social-gateway.js';
import {dispatchSocialGateway} from './social-http.js';
import {SeedPacks} from './seed-packs.js';
import {SeedIssuanceWorker} from './seed-issuance-worker.js';
import {SeedCatalogue,SeedCollection} from './seed-catalogue.js';
import {SeedChainReader} from './seed-chain-reader.js';
import {createServer} from 'node:http';
import {HighCountryMarket} from './market.js';
import {HighCountryMarketplaceView} from './marketplace-view.js';
import {GameplayRewardRuntime,RuntimeAuthority} from './runtime-integration.js';
import {composeSettlementRuntime} from './settlement-runtime.js';
import {FinalizedRpc,address} from './finalized-rpc.js';
import {PostgresBudsStore} from './postgres-store.js';
import {SettlementError} from './buds-ledger.js';
import {SkillResearchService} from './skill-research.js';
import {MissionService} from './missions.js';
import {DiscoveryIntegration} from './discovery-integration.js';
import {LandLeaseAccounts} from './land-lease-accounts.js';
import {GameplayLicensing} from './gameplay-licensing.js';

// Optional server-only composition; absent approved independent world authority,
// routes remain disabled and no placement capability is constructed.
function composePlacement({store,identity,placement}){
 if(!placement)return null;
 if(!store||identity?.store!==store)throw new SettlementError('placement store identity mismatch');
 if(typeof placement.world?.verifyTransferAtCommit!=='function'
    ||typeof placement.resolveGeometry!=='function'||typeof placement.resolveAssets!=='function')
   throw new SettlementError('unqualified placement authority wiring');
 const authority=new HighCountryProductionPlacementAuthority({runtime:identity,world:placement.world});
 return Object.freeze({
  registry:new HighCountryPlacementAuthorityRegistry({store,authority}),
  transactions:new HighCountryPlacementTransactions({store,authority,
   resolveGeometry:placement.resolveGeometry,resolveAssets:placement.resolveAssets}),
  transfer:new HighCountryStoredInstanceTransfer({store,authority})
 });
}
async function requireLeastPrivilegeRuntimeRole(pool,namespace) {
 const check=await pool.query("SELECT current_user AS role, r.rolsuper, r.rolbypassrls, c.relrowsecurity, pg_get_userbyid(c.relowner) AS owner, has_table_privilege(current_user,'highcountry_buds_state','SELECT') AS can_select, has_table_privilege(current_user,'highcountry_buds_state','UPDATE') AS can_update, has_table_privilege(current_user,'highcountry_buds_state','INSERT,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS elevated FROM pg_roles r JOIN pg_class c ON c.oid='highcountry_buds_state'::regclass WHERE r.rolname=current_user");
 const role=check.rows[0];
 if(!role||role.role!==namespace||role.rolsuper||role.rolbypassrls||!role.relrowsecurity||role.owner===role.role||!role.can_select||!role.can_update||role.elevated)throw new SettlementError('unsafe runtime database role');
}

/// Composition uses one provisioned durable namespace and independently configured canonical RPC/signer/issuer policy.
export async function createRuntime({pool,namespace,authority:authConfig,rpc:rpcConfig,sources,marketDomain,operator,issuer,signerRpc,clock,progression,missions,discovery,landRights,social,seedCatalogue,seedPacks,seedOpenings,seedPurchases,placement}){
 await requireLeastPrivilegeRuntimeRole(pool,namespace);
 const store=new PostgresBudsStore(pool,namespace),rpc=new FinalizedRpc(rpcConfig);
 for(const [name,policy] of Object.entries(sources))if(address(rpc.contracts[name]?.address)!==address(policy.contract))throw new SettlementError('source contract mismatch');
 const identity=new RuntimeAuthority({...authConfig,store,rpc,sourcePolicies:sources,clock});
 const rewards=new GameplayRewardRuntime({store,authority:identity,rpc,sources,clock});
 const chain=composeSettlementRuntime({store,identity,rpc,operator,issuer,marketDomain,signerRpc,clock});
 const marketAuthority={
  canonicalSettlementRequired:true,
  registeredPrincipal:t=>identity.registeredPrincipal(t),
  requireAssetIssuer:t=>identity.requireTrustedIssuer(t,'inventory'),
  requireMarketOpen:async()=>{if(!await rpc.unrestricted(marketDomain))throw new SettlementError('market restricted');},
  verifyAssetReceipt:async r=>{
   if(r.chainId!==rpc.chainId||r.registry!==address(rpc.contracts.escrow.address)||r.issuer!==issuer)return false;
   const b=await store.transact(s=>s.runtimeWallets?.get(r.owner));
   if(!b||await rpc.playerProfile(identity.gameId,b.wallet)!==b.profile)return false;
   const lock=await chain.reader.lockedEscrowReceipt(r.receiptId,1);
   return !!lock&&lock.owner===b.wallet&&lock.asset===r.asset&&lock.quantity===r.quantity;
  }
 };
 const market=new HighCountryMarket(store,marketAuthority,clock);
 const skillResearch=progression?new SkillResearchService({store,identity,...progression,clock}):null;
 const missionService=missions?new MissionService({store,identity,...missions,clock}):null;
 const discoveryService=discovery?new DiscoveryIntegration({store,identity,...discovery,clock}):null;
 const landRightsService=landRights?new LandLeaseAccounts({store,identity,...landRights,clock}):null;
 const gameplayLicensing=landRightsService?new GameplayLicensing({landRights:landRightsService,identity,canonical:landRights.canonical}):null;
 const socialChain=social?new CanonicalSocialChainAdapter({rpc:identity.rpc,contracts:social.contracts,scope:social.scope,emergencyDomain:social.emergencyDomain,organizationEmergencyDomain:social.organizationEmergencyDomain,cooperativeEmergencyDomain:social.cooperativeEmergencyDomain}):null;
 if(social)socialChain.eventIndexer=new CanonicalSocialEventIndexer({pool:store.pool,rpc:identity.rpc,contracts:social.contracts,scope:social.scope});
 const socialGateway=social?new CanonicalSocialGateway({identity,pool:store.pool,chain:socialChain,scope:social.scope,clock}):null;
 const socialRecovery=social?new SocialRecoveryWorker({pool:store.pool,chain:socialChain,scope:social.scope}):null;
 const seedCatalogueService=seedCatalogue?new SeedCatalogue(seedCatalogue):null;
 const seedCollection=seedCatalogueService?new SeedCollection({store,identity,catalogue:seedCatalogueService,reader:new SeedChainReader({...seedCatalogue,rpc:identity.rpc}),clock}):null;
 if(seedPacks&&seedPacks.version!=='HC.SEED.PACKS.V1')throw new SettlementError('unapproved seed pack version');
 const seedPackService=seedPacks?new SeedPacks({store,identity,catalogue:seedCatalogueService,reader:new SeedChainReader({...seedCatalogue,rpc:identity.rpc}),clock}):null;
 if(seedOpenings&&(!seedPackService||seedOpenings.version!=='HC.SEED.OPENINGS.V1'))throw new SettlementError('unapproved opening runtime');
 const seedOpeningService=seedOpenings?new SeedOpenings({packs:seedPackService,reader:new SeedOpeningChainReader({...seedOpenings,rpc:identity.rpc,catalogue:seedCatalogueService,gameId:identity.gameId}),clock}):null;
 if(seedPurchases&&(!seedOpeningService||seedPurchases.version!=='HC.SEED.PURCHASES.V1'))throw new SettlementError('unapproved seed purchase runtime');
 const seedPurchaseService=seedPurchases?new SeedPurchases({packs:seedPackService,signerRpc,reader:new SeedPaymentReader({...seedPurchases,rpc:identity.rpc,gameId:identity.gameId}),clock}):null;
 return {store,identity,rewards,market,seedPurchases:seedPurchaseService,seedOpenings:seedOpeningService,seedPacks:seedPackService,seedCatalogue:seedCatalogueService,seedCollection,marketView:new HighCountryMarketplaceView({store,identity,market,clock}),skillResearch,missionService,discoveryService,landRightsService,gameplayLicensing,socialGateway,socialRecovery,seedOpeningWorker:seedOpeningService?new SeedOpeningWorker({openings:seedOpeningService,signerRpc,operator,clock}):null,seedIssuanceWorker:seedPackService?new SeedIssuanceWorker({packs:seedPackService,reader:seedPackService.reader,rpc,signerRpc,operator,clock}):null,placement:composePlacement({store,identity,placement}),...chain};
}
// Production entrypoint for a wallet-optional, registered-player ordinary economy.
// Never silently repurpose the canonical on-chain escrow settlement runtime.
export async function createOrdinaryRuntime({pool,namespace,authority:authConfig,rpc:rpcConfig,sources,inventoryAuthority,signerRpc,clock,progression,missions,discovery,landRights,social,seedCatalogue,seedPacks,seedOpenings,seedPurchases,placement}) {
 await requireLeastPrivilegeRuntimeRole(pool,namespace);
 if(!inventoryAuthority||typeof inventoryAuthority.verifyAssetReceipt!=='function'
    ||typeof inventoryAuthority.requireMarketOpen!=='function')
  throw new SettlementError('ordinary inventory admission authority missing');
 const store=new PostgresBudsStore(pool,namespace),rpc=new FinalizedRpc(rpcConfig);
 if(!sources||typeof sources!=='object')throw new SettlementError('approved reward sources required');
 for(const [name,policy] of Object.entries(sources))
  if(address(rpc.contracts[name]?.address)!==address(policy.contract))
   throw new SettlementError('source contract mismatch');
 const identity=new RuntimeAuthority({...authConfig,store,rpc,sourcePolicies:sources,clock});
 const rewards=new GameplayRewardRuntime({store,authority:identity,rpc,sources,clock});
 return composeOrdinaryMarketRuntime({store,identity,rewards,inventoryAuthority,signerRpc,clock,progression,missions,discovery,landRights,social,seedCatalogue,seedPacks,seedOpenings,seedPurchases,placement});
}
// Separate ordinary market composition. The canonical runtime above remains chain-settlement-only.
export function composeOrdinaryMarketRuntime({store,identity,rewards,inventoryAuthority,signerRpc,clock,progression,missions,discovery,landRights,social,seedCatalogue,seedPacks,seedOpenings,seedPurchases,placement}) {
 if(typeof store?.transact!=='function'||identity?.store!==store
   ||typeof identity?.registeredPrincipal!=='function'
   ||typeof identity?.requireTrustedIssuer!=='function'
   ||typeof inventoryAuthority?.verifyAssetReceipt!=='function')
  throw new SettlementError('ordinary market trusted dependencies missing');
 const authority={
  canonicalSettlementRequired:false,
  registeredPrincipal:session=>identity.registeredPrincipal(session),
  requireAssetIssuer:session=>identity.requireTrustedIssuer(session,'inventory'),
  verifyAssetReceipt:receipt=>inventoryAuthority.verifyAssetReceipt(receipt),
  requireMarketOpen:inventoryAuthority.requireMarketOpen
   ?()=>inventoryAuthority.requireMarketOpen():undefined
 };
 const market=new HighCountryMarket(store,authority,clock);
 const skillResearch=progression?new SkillResearchService({store,identity,...progression,clock}):null;
 const missionService=missions?new MissionService({store,identity,...missions,clock}):null;
 const discoveryService=discovery?new DiscoveryIntegration({store,identity,...discovery,clock}):null;
 const landRightsService=landRights?new LandLeaseAccounts({store,identity,...landRights,clock}):null;
 const gameplayLicensing=landRightsService?new GameplayLicensing({landRights:landRightsService,identity,canonical:landRights.canonical}):null;
 const socialChain=social?new CanonicalSocialChainAdapter({rpc:identity.rpc,contracts:social.contracts,scope:social.scope,emergencyDomain:social.emergencyDomain,organizationEmergencyDomain:social.organizationEmergencyDomain,cooperativeEmergencyDomain:social.cooperativeEmergencyDomain}):null;
 if(social)socialChain.eventIndexer=new CanonicalSocialEventIndexer({pool:store.pool,rpc:identity.rpc,contracts:social.contracts,scope:social.scope});
 const socialGateway=social?new CanonicalSocialGateway({identity,pool:store.pool,chain:socialChain,scope:social.scope,clock}):null;
 const socialRecovery=social?new SocialRecoveryWorker({pool:store.pool,chain:socialChain,scope:social.scope}):null;
 const seedCatalogueService=seedCatalogue?new SeedCatalogue(seedCatalogue):null;
 const seedCollection=seedCatalogueService?new SeedCollection({store,identity,catalogue:seedCatalogueService,reader:new SeedChainReader({...seedCatalogue,rpc:identity.rpc}),clock}):null;
 if(seedPacks&&seedPacks.version!=='HC.SEED.PACKS.V1')throw new SettlementError('unapproved seed pack version');
 const seedPackService=seedPacks?new SeedPacks({store,identity,catalogue:seedCatalogueService,reader:new SeedChainReader({...seedCatalogue,rpc:identity.rpc}),clock}):null;
 if(seedOpenings&&(!seedPackService||seedOpenings.version!=='HC.SEED.OPENINGS.V1'))throw new SettlementError('unapproved opening runtime');
 const seedOpeningService=seedOpenings?new SeedOpenings({packs:seedPackService,reader:new SeedOpeningChainReader({...seedOpenings,rpc:identity.rpc,catalogue:seedCatalogueService,gameId:identity.gameId}),clock}):null;
 if(seedPurchases&&(!seedOpeningService||seedPurchases.version!=='HC.SEED.PURCHASES.V1'))throw new SettlementError('unapproved seed purchase runtime');
 const seedPurchaseService=seedPurchases?new SeedPurchases({packs:seedPackService,signerRpc,reader:new SeedPaymentReader({...seedPurchases,rpc:identity.rpc,gameId:identity.gameId}),clock}):null;
 return {store,identity,rewards,market,seedPurchases:seedPurchaseService,seedOpenings:seedOpeningService,seedPacks:seedPackService,seedCatalogue:seedCatalogueService,seedCollection,marketView:new HighCountryMarketplaceView({store,identity,market,clock}),skillResearch,missionService,discoveryService,landRightsService,gameplayLicensing,socialGateway,placement:composePlacement({store,identity,placement})};
}
export function runtimeHttpServer(runtime,{origin}){
 const {identity,rewards,market,marketView,skillResearch,missionService,discoveryService,landRightsService,gameplayLicensing,socialGateway,socialRecovery,seedCatalogue,seedCollection,seedPacks,seedOpenings,seedPurchases,seedOpeningWorker,seedIssuanceWorker,settlement,worker}=runtime;
 return createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  if(req.headers.origin===origin){
   res.setHeader('access-control-allow-origin',origin);
   res.setHeader('access-control-allow-methods','POST,OPTIONS');
   res.setHeader('access-control-allow-headers','authorization,content-type');
   res.setHeader('vary','Origin');
  }
  if(req.method==='OPTIONS'&&req.headers.origin===origin){res.statusCode=204;return res.end();}
  try{
   if(req.method!=='POST'||(req.headers.origin&&req.headers.origin!==origin))throw new SettlementError('request denied');
   const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
   let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new SettlementError('request too large');raw+=chunk;}
   let b;try{b=JSON.parse(raw||'{}');}catch{throw new SettlementError('invalid request');}
   if(req.url.startsWith('/seeds/packs/')&&(!b||typeof b!=='object'||Array.isArray(b)))throw new SettlementError('seed pack object required');
   if(req.url==='/seeds/packs/policy'){
    if(!seedPacks||!b||Object.keys(b).length)throw new SettlementError('seed pack policy request denied');
    return res.end(JSON.stringify({ok:true,result:seedPacks.policy()}));
   }
   if(req.url==='/seeds/catalogue'){
    if(!seedCatalogue||Object.keys(b).sort().join(',')!=='filters')throw new SettlementError('seed catalogue request denied');
    return res.end(JSON.stringify({ok:true,result:seedCatalogue.browse(b.filters)}));
   }
   if(!token)throw new SettlementError('session required');
   let result;
   if(req.url.startsWith('/social/')){
    result=await dispatchSocialGateway(socialGateway,req.url,token,b);
    return res.end(JSON.stringify({ok:true,result:result??null}));
   }
   switch(req.url){
    case '/seeds/packs/shop':
     if(!seedPurchases||Object.keys(b).length)throw new SettlementError('seed marketplace denied');
     result=await seedPurchases.browse(token);break;
    case '/seeds/packs/purchase-prepare':
     if(!seedPurchases||Object.keys(b).sort().join(',')!=='currency,operation,region')throw new SettlementError('seed purchase denied');
     result=await seedPurchases.prepare(token,b);break;
    case '/seeds/packs/purchase-confirm':
     if(!seedPurchases||Object.keys(b).sort().join(',')!=='purchaseId')throw new SettlementError('seed purchase confirmation denied');
     result=await seedPurchases.confirm(token,b.purchaseId);break;
    case '/seeds/packs/purchase-cancel':
     if(!seedPurchases||Object.keys(b).sort().join(',')!=='purchaseId')throw new SettlementError('seed purchase cancellation denied');
     result=await seedPurchases.cancel(token,b.purchaseId);break;
    case '/seeds/packs/open':
     if(!seedOpenings||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed opening request denied');
     result=await seedOpenings.open(token,b.packId);break;
    case '/seeds/packs/opening':
     if(!seedOpenings||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed opening reconciliation denied');
     result=await seedOpenings.reconcile(token,b.packId);break;
    case '/seeds/packs/opening-pending':
     if(!seedOpenings||Object.keys(b).sort().join(',')!=='after,limit')throw new SettlementError('seed opening queue denied');
     result=await seedOpenings.pending(token,b);break;
    case '/seeds/packs/opening-dispatch':
     if(!seedOpeningWorker||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed opening dispatch denied');
     result=await seedOpeningWorker.tick(token,b.packId);break;
    case '/seeds/packs/inventory':
     if(!seedPacks||Object.keys(b).length)throw new SettlementError('seed inventory request denied');
     result=await seedPacks.inventory(token);break;
    case '/seeds/packs/starter':
     if(!seedPacks||Object.keys(b).sort().join(',')!=='region')throw new SettlementError('seed starter request denied');
     result=await seedPacks.starter(token,b.region);break;
    case '/seeds/packs/allocate':
     if(!seedPacks||Object.keys(b).sort().join(',')!=='count,owner,receiptId,region')throw new SettlementError('seed allocation request denied');
     result=await seedPacks.allocate(token,b);break;
    case '/seeds/packs/pending':
     if(!seedPacks||Object.keys(b).sort().join(',')!=='after,limit')throw new SettlementError('seed queue request denied');
     result=await seedPacks.pending(token,b);break;
    case '/seeds/packs/prepare':
     if(!seedPacks||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed preparation request denied');
     result=await seedPacks.prepare(token,b.packId);break;
    case '/seeds/packs/confirm':
     if(!seedPacks||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed confirmation request denied');
     result=await seedPacks.confirm(token,b.packId);break;
    case '/seeds/packs/dispatch':
     if(!seedIssuanceWorker||Object.keys(b).sort().join(',')!=='packId')throw new SettlementError('seed dispatch request denied');
     result=await seedIssuanceWorker.tick(token,b.packId);break;
    case '/seeds/collection':
     if(!seedCollection||Object.keys(b).length)throw new SettlementError('seed collection request denied');
     result=await seedCollection.snapshot(token);break;
    case '/seeds/harvest-card':
     if(!seedCollection||Object.keys(b).sort().join(',')!=='plantId')throw new SettlementError('harvest card request denied');
     result=await seedCollection.claimHarvest(token,b.plantId);break;
    case '/accounts/register':result=await identity.register(token);break;
    case '/wallet/challenge':result=await identity.linkChallenge(token,b.wallet);break;
    case '/wallet/link':result=await identity.linkWallet(token,b.nonce,b.signature);break;
    case '/wallet/unlink':result=await identity.unlink(token);break;
    case '/rewards/claim':result=await rewards.claim(token,b.source,b.proof);break;
    case '/progression/snapshot':
     if(!skillResearch||Object.keys(b).length!==0)throw new SettlementError('progression snapshot denied');
     result=await skillResearch.snapshot(token);break;
    case '/progression/evidence':
     if(!skillResearch||Object.keys(b).sort().join(',')!=='evidence,operation,points,trackId')
      throw new SettlementError('progression evidence request denied');
     result=await skillResearch.progress(token,b.operation,b.trackId,b.evidence,b.points);break;
    case '/progression/unlock':
     if(!skillResearch||Object.keys(b).sort().join(',')!=='operation,trackId')
      throw new SettlementError('progression unlock request denied');
     result=await skillResearch.unlock(token,b.operation,b.trackId);break;
    case '/land/license/evaluate':
     if(!gameplayLicensing||Object.keys(b).sort().join(',')!=='capability,namespace,parcelId')throw new SettlementError('gameplay licence request denied');
     result=await gameplayLicensing.evaluate(token,b);break;
    case '/land/rights':
     if(!landRightsService||Object.keys(b).sort().join(',')!=='parcelId')throw new SettlementError('land rights request denied');
     result=await landRightsService.rights(token,b.parcelId);break;
    case '/land/rent/history':
     if(!landRightsService||Object.keys(b).sort().join(',')!=='leaseId')throw new SettlementError('rent history request denied');
     result=await landRightsService.rentHistory(token,b.leaseId);break;
    case '/land/rent/record':
     if(!landRightsService||Object.keys(b).sort().join(',')!=='amount,leaseId,operation,parcelId,period,sourceReceipt')throw new SettlementError('rent accounting request denied');
     result=await landRightsService.recordRent(token,b);break;
    case '/discovery/snapshot':
     if(!discoveryService||Object.keys(b).length)throw new SettlementError('discovery snapshot denied');
     result=await discoveryService.snapshot(token);break;
    case '/discovery/ingest':
     if(!discoveryService||Object.keys(b).sort().join(',')!=='evidence,objectiveId,operation')
      throw new SettlementError('discovery request denied');
     result=await discoveryService.ingest(token,b.operation,b.objectiveId,b.evidence);break;
    case '/missions/snapshot':
     if(!missionService||Object.keys(b).length)throw new SettlementError('mission snapshot denied');
     result=await missionService.snapshot(token);break;
    case '/missions/activate':
    case '/missions/claim':
    case '/missions/cancel':
    case '/missions/expire':
     if(!missionService||Object.keys(b).sort().join(',')!=='id,operation')throw new SettlementError('mission request denied');
     result=await missionService[req.url.split('/')[2]](token,b.operation,b.id);break;
    case '/missions/progress':
     if(!missionService||Object.keys(b).sort().join(',')!=='amount,evidence,id,operation')throw new SettlementError('mission evidence request denied');
     result=await missionService.progress(token,b.operation,b.id,b.evidence,b.amount);break;
    case '/market/import':result=await market.importAsset(token,b.operation,b.receipt);break;
    case '/market/list':result=await market.list(token,b.operation,b.listing,b.asset,b.quantity,b.price,b.expiresAt);break;
    case '/market/snapshot':
     if(!marketView)throw new SettlementError('market read model unavailable');
     result=await marketView.snapshot(token);break;
    case '/market/dispute':
     if(!marketView)throw new SettlementError('market dispute intake unavailable');
     result=await marketView.dispute(token,b.operation,b.listing,b.reason);break;
    case '/operator/market-dispute':
     if(!marketView)throw new SettlementError('market dispute resolution unavailable');
     result=await marketView.review(token,b.operation,b.dispute,b.status,b.evidence);break;
    case '/market/buy':
     if(market?.authority?.canonicalSettlementRequired!==false)throw new SettlementError('ordinary market disabled');
     result=await market.buy(token,b.operation,b.listing);break;
    case '/market/cancel':
     if(market?.authority?.canonicalSettlementRequired!==false)throw new SettlementError('ordinary market disabled');
     result=await market.cancel(token,b.operation,b.listing);break;
    case '/market/expire':
     if(market?.authority?.canonicalSettlementRequired!==false)throw new SettlementError('ordinary market disabled');
     await identity.registeredPrincipal(token);
     result=await market.expire(b.operation,b.listing);break;
    case '/market/prepare':
     if(market?.authority?.canonicalSettlementRequired!==true)throw new SettlementError('canonical settlement disabled');
     result=await settlement.prepare(token,b.operation,b.listing,b.transferOperation);break;
    case '/operator/revoke-account':result=await identity.revoke(token,b.principal);break;
    case '/operator/revoke-source':result=await identity.revokeSource(token,b.source);break;
    case '/operator/reconcile':
     if(market?.authority?.canonicalSettlementRequired!==true)throw new SettlementError('canonical settlement disabled');
     await identity.requireMarketOperator(token);result=await worker.tick(b.transferOperation);break;
    default:throw new SettlementError('unknown route');
   }
   res.end(JSON.stringify({ok:true,result:result??null}));
  }catch(error){res.statusCode=error instanceof SettlementError?403:503;
   res.end(JSON.stringify({ok:false,error:error instanceof SettlementError?error.message:'runtime unavailable'}));}
 });
}
