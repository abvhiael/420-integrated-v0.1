// Retained Genesis integration contract fixtures for games extracted by MIG-4.
// These are NOT game implementations. External repos own their game-specific assertions.
// Shared security boundaries remain checked against the real 420 Gaming SDK.
import {AccessRequirement,evaluateAccessRequirement,createGamingClient420,GAMING_GAME_IDS} from '../src/index.js';
export const GREEN_ROAD_GAME_ID=GAMING_GAME_IDS.greenRoad;
export const BUDTENDER_GAME_ID=GAMING_GAME_IDS.budtender;
export const SMOKE_CHROME_GAME_ID=GAMING_GAME_IDS.smokeAndChrome;
export const GreenRoadFeature=Object.freeze({CORE_ROAD_TRIP:'core-road-trip',SECRET_ROUTE:'secret-route',CLOUD_SAVE:'cloud-save',CROSS_GAME_ARTIFACT:'cross-game-artifact'});
export const BudtenderFeature=Object.freeze({CORE_MANAGEMENT:'core-management',PREMIUM_DECOR:'premium-decor',CLOUD_SAVE:'cloud-save',CROSS_GAME_ITEM:'cross-game-item'});
export const SmokeChromeFeature=Object.freeze({CORE_MATCH:'core-match',DECK_BUILDING:'deck-building',OWNED_EDITION:'owned-edition',CLOUD_SAVE:'cloud-save',CROSS_GAME_PRESTIGE:'cross-game-prestige'});
const scopeMap=new Map([
 [GreenRoadFeature.CORE_ROAD_TRIP,AccessRequirement.CORE],
 [GreenRoadFeature.SECRET_ROUTE,AccessRequirement.WALLET],
 [GreenRoadFeature.CLOUD_SAVE,AccessRequirement.REGISTERED],
 [GreenRoadFeature.CROSS_GAME_ARTIFACT,AccessRequirement.WALLET],
 [BudtenderFeature.CORE_MANAGEMENT,AccessRequirement.CORE],
 [BudtenderFeature.PREMIUM_DECOR,AccessRequirement.WALLET],
 [BudtenderFeature.CROSS_GAME_ITEM,AccessRequirement.WALLET],
 [SmokeChromeFeature.CORE_MATCH,AccessRequirement.CORE],
 [SmokeChromeFeature.DECK_BUILDING,AccessRequirement.CORE],
 [SmokeChromeFeature.OWNED_EDITION,AccessRequirement.WALLET],
 [SmokeChromeFeature.CROSS_GAME_PRESTIGE,AccessRequirement.WALLET]
]);
function evaluate(featureSet,{feature,...state}={}){
 if(!Object.values(featureSet).includes(feature))throw new TypeError('unsupported external game feature');
 const requirement=scopeMap.get(feature);
 if(!requirement)throw new TypeError('unmapped external game feature');
 return evaluateAccessRequirement({requirement,...state});
}
export const evaluateGreenRoadAccess=input=>evaluate(GreenRoadFeature,input);
export const evaluateBudtenderAccess=input=>evaluate(BudtenderFeature,input);
export const evaluateSmokeChromeAccess=input=>evaluate(SmokeChromeFeature,input);
export const createGreenRoadGamingClient=adapters=>createGamingClient420({gameId:GREEN_ROAD_GAME_ID,adapters});
export const createBudtenderGamingClient=adapters=>createGamingClient420({gameId:BUDTENDER_GAME_ID,adapters});
export const createSmokeChromeGamingClient=adapters=>createGamingClient420({gameId:SMOKE_CHROME_GAME_ID,adapters});
