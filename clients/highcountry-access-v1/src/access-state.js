export const PlayerAccessState = Object.freeze({
  GUEST: "guest",
  REGISTERED: "registered",
  WALLET_LINKED: "wallet-linked"
});

export const FeatureClass = Object.freeze({
  CORE_GAMEPLAY: "core-gameplay",
  CLOUD_SAVE: "cloud-save",
  OPTIONAL_CONTENT: "optional-content",
  OWNERSHIP: "ownership",
  MARKETPLACE: "marketplace",
  CROSS_GAME: "cross-game",
  REWARD: "reward"
});

export const PromptKind = Object.freeze({
  NONE: "none",
  REGISTER: "register",
  LINK_WALLET: "link-wallet",
  CONNECT_WALLET: "connect-wallet"
});

const WALLET_ONLY = new Set([
  FeatureClass.OPTIONAL_CONTENT,
  FeatureClass.OWNERSHIP,
  FeatureClass.MARKETPLACE,
  FeatureClass.CROSS_GAME,
  FeatureClass.REWARD
]);

export function derivePlayerAccessState({ registered = false, walletLinked = false } = {}) {
  if (walletLinked) return PlayerAccessState.WALLET_LINKED;
  if (registered) return PlayerAccessState.REGISTERED;
  return PlayerAccessState.GUEST;
}

export function evaluateFeatureAccess({
  feature,
  registered = false,
  walletLinked = false,
  walletConnected = false
} = {}) {
  const state = derivePlayerAccessState({ registered, walletLinked });

  if (feature === FeatureClass.CORE_GAMEPLAY) {
    return {
      allowed: true,
      state,
      prompt: PromptKind.NONE,
      optional: false,
      reason: "core-gameplay-remains-wallet-free"
    };
  }

  if (feature === FeatureClass.CLOUD_SAVE) {
    if (state !== PlayerAccessState.GUEST) {
      return {
        allowed: true,
        state,
        prompt: PromptKind.NONE,
        optional: true,
        reason: "registered-account-satisfies-cloud-save"
      };
    }

    return {
      allowed: false,
      state,
      prompt: PromptKind.REGISTER,
      optional: true,
      reason: "registration-required-for-cloud-save"
    };
  }

  if (WALLET_ONLY.has(feature)) {
    if (!walletLinked) {
      return {
        allowed: false,
        state,
        prompt: PromptKind.LINK_WALLET,
        optional: true,
        reason: "wallet-link-required-for-optional-web3-feature"
      };
    }

    if (!walletConnected) {
      return {
        allowed: false,
        state,
        prompt: PromptKind.CONNECT_WALLET,
        optional: true,
        reason: "wallet-reconnect-required-at-feature-boundary"
      };
    }

    return {
      allowed: true,
      state,
      prompt: PromptKind.NONE,
      optional: true,
      reason: "wallet-linked-feature-available"
    };
  }

  throw new TypeError(`Unsupported High Country feature class: ${feature}`);
}

export function shouldPromptDuringRoutinePlay(decision) {
  return decision?.prompt !== PromptKind.NONE && decision?.optional !== true;
}
