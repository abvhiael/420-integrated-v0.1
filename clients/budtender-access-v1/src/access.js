import {
  AccessRequirement,
  createGamingClient420,
  evaluateAccessRequirement
} from "../../../packages/420-gaming-sdk/src/index.js";

export const BUDTENDER_GAME_ID = "420/GAMING/GAME/BUDTENDER/V1";

export const BudtenderFeature = Object.freeze({
  CORE_MANAGEMENT: "core-management",
  CLOUD_SAVE: "cloud-save",
  PREMIUM_DECOR: "premium-decor",
  COLLECTIBLE_FIXTURE: "collectible-fixture",
  SEASONAL_EVENT: "seasonal-event",
  CROSS_GAME_ITEM: "cross-game-item",
  REWARD: "reward"
});

export const BudtenderEntitlement = Object.freeze({
  PREMIUM_DECOR: "420/BUDTENDER/ENTITLEMENT/PREMIUM_DECOR/V1",
  COLLECTIBLE_FIXTURE: "420/BUDTENDER/ENTITLEMENT/COLLECTIBLE_FIXTURE/V1",
  SEASONAL_EVENT: "420/BUDTENDER/ENTITLEMENT/SEASONAL_EVENT/V1",
  CROSS_GAME: "420/BUDTENDER/ENTITLEMENT/CROSS_GAME/V1"
});

const requirementByFeature = Object.freeze({
  [BudtenderFeature.CORE_MANAGEMENT]: AccessRequirement.CORE,
  [BudtenderFeature.CLOUD_SAVE]: AccessRequirement.REGISTERED,
  [BudtenderFeature.PREMIUM_DECOR]: AccessRequirement.WALLET,
  [BudtenderFeature.COLLECTIBLE_FIXTURE]: AccessRequirement.WALLET,
  [BudtenderFeature.SEASONAL_EVENT]: AccessRequirement.WALLET,
  [BudtenderFeature.CROSS_GAME_ITEM]: AccessRequirement.WALLET,
  [BudtenderFeature.REWARD]: AccessRequirement.WALLET
});

export function evaluateBudtenderAccess({ feature, ...state }) {
  const requirement = requirementByFeature[feature];
  if (!requirement) throw new TypeError(`Unsupported Budtender feature: ${feature}`);
  return evaluateAccessRequirement({ requirement, ...state });
}

export function createBudtenderGamingClient(adapters) {
  return createGamingClient420({ gameId: BUDTENDER_GAME_ID, adapters });
}
