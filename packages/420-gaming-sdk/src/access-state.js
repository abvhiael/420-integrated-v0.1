export const PlayerAccessState = Object.freeze({
  GUEST: "guest",
  REGISTERED: "registered",
  WALLET_LINKED: "wallet-linked"
});

export const PromptKind = Object.freeze({
  NONE: "none",
  REGISTER: "register",
  LINK_WALLET: "link-wallet",
  CONNECT_WALLET: "connect-wallet"
});

export const AccessRequirement = Object.freeze({
  CORE: "core",
  REGISTERED: "registered",
  WALLET: "wallet"
});

export function derivePlayerAccessState({ registered = false, walletLinked = false } = {}) {
  if (walletLinked) return PlayerAccessState.WALLET_LINKED;
  if (registered) return PlayerAccessState.REGISTERED;
  return PlayerAccessState.GUEST;
}

export function evaluateAccessRequirement({
  requirement = AccessRequirement.CORE,
  registered = false,
  walletLinked = false,
  walletConnected = false
} = {}) {
  const state = derivePlayerAccessState({ registered, walletLinked });

  if (requirement === AccessRequirement.CORE) {
    return { allowed: true, state, prompt: PromptKind.NONE, optional: false };
  }

  if (requirement === AccessRequirement.REGISTERED) {
    if (state !== PlayerAccessState.GUEST) {
      return { allowed: true, state, prompt: PromptKind.NONE, optional: true };
    }
    return { allowed: false, state, prompt: PromptKind.REGISTER, optional: true };
  }

  if (requirement === AccessRequirement.WALLET) {
    if (!walletLinked) {
      return { allowed: false, state, prompt: PromptKind.LINK_WALLET, optional: true };
    }
    if (!walletConnected) {
      return { allowed: false, state, prompt: PromptKind.CONNECT_WALLET, optional: true };
    }
    return { allowed: true, state, prompt: PromptKind.NONE, optional: true };
  }

  throw new TypeError(`Unsupported gaming access requirement: ${requirement}`);
}
