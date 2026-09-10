import {
  AccessRequirement,
  createGamingClient420,
  evaluateAccessRequirement
} from "../../../packages/420-gaming-sdk/src/index.js";

export const GREEN_ROAD_GAME_ID = "420/GAMING/GAME/THE_GREEN_ROAD/V1";

export const GreenRoadFeature = Object.freeze({
  CORE_ROAD_TRIP: "core-road-trip",
  CLOUD_SAVE: "cloud-save",
  SECRET_ROUTE: "secret-route",
  BONUS_LEVEL: "bonus-level",
  COLLECTIBLE: "collectible",
  SEASONAL_EVENT: "seasonal-event",
  CROSS_GAME_ARTIFACT: "cross-game-artifact",
  REWARD: "reward"
});

export const GreenRoadEntitlement = Object.freeze({
  SECRET_ROUTE: "420/TGR/ENTITLEMENT/SECRET_ROUTE/V1",
  BONUS_LEVEL: "420/TGR/ENTITLEMENT/BONUS_LEVEL/V1",
  COLLECTIBLE: "420/TGR/ENTITLEMENT/COLLECTIBLE/V1",
  SEASONAL_EVENT: "420/TGR/ENTITLEMENT/SEASONAL_EVENT/V1",
  CROSS_GAME: "420/TGR/ENTITLEMENT/CROSS_GAME/V1"
});

const requirementByFeature = Object.freeze({
  [GreenRoadFeature.CORE_ROAD_TRIP]: AccessRequirement.CORE,
  [GreenRoadFeature.CLOUD_SAVE]: AccessRequirement.REGISTERED,
  [GreenRoadFeature.SECRET_ROUTE]: AccessRequirement.WALLET,
  [GreenRoadFeature.BONUS_LEVEL]: AccessRequirement.WALLET,
  [GreenRoadFeature.COLLECTIBLE]: AccessRequirement.WALLET,
  [GreenRoadFeature.SEASONAL_EVENT]: AccessRequirement.WALLET,
  [GreenRoadFeature.CROSS_GAME_ARTIFACT]: AccessRequirement.WALLET,
  [GreenRoadFeature.REWARD]: AccessRequirement.WALLET
});

export function evaluateGreenRoadAccess({ feature, ...state }) {
  const requirement = requirementByFeature[feature];
  if (!requirement) throw new TypeError(`Unsupported Green Road feature: ${feature}`);
  return evaluateAccessRequirement({ requirement, ...state });
}

export function createGreenRoadGamingClient(adapters) {
  return createGamingClient420({ gameId: GREEN_ROAD_GAME_ID, adapters });
}
