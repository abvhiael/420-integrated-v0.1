import {
  AccessRequirement,
  createGamingClient420,
  evaluateAccessRequirement
} from "../../../packages/420-gaming-sdk/src/index.js";

export const SMOKE_CHROME_GAME_ID = "420/GAMING/GAME/SMOKE_AND_CHROME/V1";

export const SmokeChromeFeature = Object.freeze({
  CORE_MATCH: "core-match",
  DECK_BUILDING: "deck-building",
  CLOUD_SAVE: "cloud-save",
  OWNED_EDITION: "owned-edition",
  COLLECTIBLE: "collectible",
  MARKETPLACE: "marketplace",
  TOURNAMENT_PRIZE: "tournament-prize",
  CROSS_GAME_PRESTIGE: "cross-game-prestige"
});

export const SmokeChromeEntitlement = Object.freeze({
  OWNED_EDITION: "420/SC/ENTITLEMENT/OWNED_EDITION/V1",
  COLLECTIBLE: "420/SC/ENTITLEMENT/COLLECTIBLE/V1",
  MARKETPLACE: "420/SC/ENTITLEMENT/MARKETPLACE/V1",
  TOURNAMENT_PRIZE: "420/SC/ENTITLEMENT/TOURNAMENT_PRIZE/V1",
  CROSS_GAME: "420/SC/ENTITLEMENT/CROSS_GAME/V1"
});

const requirementByFeature = Object.freeze({
  [SmokeChromeFeature.CORE_MATCH]: AccessRequirement.CORE,
  [SmokeChromeFeature.DECK_BUILDING]: AccessRequirement.CORE,
  [SmokeChromeFeature.CLOUD_SAVE]: AccessRequirement.REGISTERED,
  [SmokeChromeFeature.OWNED_EDITION]: AccessRequirement.WALLET,
  [SmokeChromeFeature.COLLECTIBLE]: AccessRequirement.WALLET,
  [SmokeChromeFeature.MARKETPLACE]: AccessRequirement.WALLET,
  [SmokeChromeFeature.TOURNAMENT_PRIZE]: AccessRequirement.WALLET,
  [SmokeChromeFeature.CROSS_GAME_PRESTIGE]: AccessRequirement.WALLET
});

export function evaluateSmokeChromeAccess({ feature, ...state }) {
  const requirement = requirementByFeature[feature];
  if (!requirement) throw new TypeError(`Unsupported Smoke & Chrome feature: ${feature}`);
  return evaluateAccessRequirement({ requirement, ...state });
}

export function createSmokeChromeGamingClient(adapters) {
  return createGamingClient420({ gameId: SMOKE_CHROME_GAME_ID, adapters });
}
