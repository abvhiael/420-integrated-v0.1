import {
  AccessRequirement,
  PlayerAccessState,
  PromptKind,
  derivePlayerAccessState,
  evaluateAccessRequirement
} from "../../../packages/420-gaming-sdk/src/index.js";

export { PlayerAccessState, PromptKind, derivePlayerAccessState };

export const FeatureClass = Object.freeze({
  CORE_GAMEPLAY: "core-gameplay",
  CLOUD_SAVE: "cloud-save",
  OPTIONAL_CONTENT: "optional-content",
  OWNERSHIP: "ownership",
  MARKETPLACE: "marketplace",
  CROSS_GAME: "cross-game",
  REWARD: "reward"
});

const REQUIREMENT_BY_FEATURE = new Map([
  [FeatureClass.CORE_GAMEPLAY, AccessRequirement.CORE],
  [FeatureClass.CLOUD_SAVE, AccessRequirement.REGISTERED],
  [FeatureClass.OPTIONAL_CONTENT, AccessRequirement.WALLET],
  [FeatureClass.OWNERSHIP, AccessRequirement.WALLET],
  [FeatureClass.MARKETPLACE, AccessRequirement.WALLET],
  [FeatureClass.CROSS_GAME, AccessRequirement.WALLET],
  [FeatureClass.REWARD, AccessRequirement.WALLET]
]);

export function evaluateFeatureAccess({ feature, ...state } = {}) {
  const requirement = REQUIREMENT_BY_FEATURE.get(feature);
  if (!requirement) throw new TypeError(`Unsupported High Country feature class: ${feature}`);

  const decision = evaluateAccessRequirement({ requirement, ...state });

  if (feature === FeatureClass.CORE_GAMEPLAY) {
    return { ...decision, reason: "core-gameplay-remains-wallet-free" };
  }
  if (feature === FeatureClass.CLOUD_SAVE) {
    return {
      ...decision,
      reason: decision.allowed
        ? "registered-account-satisfies-cloud-save"
        : "registration-required-for-cloud-save"
    };
  }
  if (decision.prompt === PromptKind.LINK_WALLET) {
    return { ...decision, reason: "wallet-link-required-for-optional-web3-feature" };
  }
  if (decision.prompt === PromptKind.CONNECT_WALLET) {
    return { ...decision, reason: "wallet-reconnect-required-at-feature-boundary" };
  }
  return { ...decision, reason: "wallet-linked-feature-available" };
}

export function shouldPromptDuringRoutinePlay(decision) {
  return decision?.prompt !== PromptKind.NONE && decision?.optional !== true;
}
