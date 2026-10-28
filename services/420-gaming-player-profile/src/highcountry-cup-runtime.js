// HC-NEXT-7.4 explicit service composition. Do not activate unless every
// externally reviewed chain, bytecode, selector and datastore binding is supplied.
import {createHighCountryCupRpc420} from './highcountry-cup-rpc.js';
import {createGlobalCupProjection420} from './highcountry-global-cup.js';
import {createPostgresCupAchievements420} from './highcountry-cup-achievements.js';
export function createHighCountryCupRuntime420({endpoint,chainId,cupAddress,engineAddress,
 cupCode,engineCode,codeHash,selectors,pool,gameId,fetchImpl}={}){
 const source=createHighCountryCupRpc420({endpoint,chainId,cupAddress,engineAddress,
  cupCode,engineCode,selectors,fetchImpl});
 const projection=createGlobalCupProjection420({source,chainId,cupAddress,codeHash});
 const storage=createPostgresCupAchievements420({pool,gameId,projection});
 return Object.freeze({
  standings:({cupId})=>projection.standings({cupId}),
  // Intended exclusively for an authorized reconciliation worker. Never HTTP exposed.
  synchronize:({cupId})=>storage.synchronize({cupId}),
  historyStatus:({cupId})=>storage.current({cupId})
 });
}
