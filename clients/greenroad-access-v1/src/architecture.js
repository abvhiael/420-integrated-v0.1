import { GREEN_ROAD_GAME_ID } from "./access.js";

export const GREEN_ROAD_ARCHITECTURE_VERSION = 1;
export const GREEN_ROAD_SAVE_SCHEMA_VERSION = 1;
export const GREEN_ROAD_CONTENT_SCHEMA_VERSION = 1;

export const GreenRoadPlayerMode = Object.freeze({
  GUEST: "guest",
  REGISTERED: "registered",
  WALLET_LINKED: "wallet-linked"
});

export const GreenRoadContentKind = Object.freeze({
  CHAPTER: "chapter",
  LOCATION: "location",
  SCENE: "scene",
  HIDDEN_OBJECT: "hidden-object",
  CLUE: "clue",
  JOURNAL_ENTRY: "journal-entry",
  COLLECTIBLE: "collectible",
  ACHIEVEMENT: "achievement"
});

export const GreenRoadProgressDomain = Object.freeze({
  CORE_PROGRESS: "core-progress",
  SCENE_PROGRESS: "scene-progress",
  CLUES: "clues",
  JOURNAL: "journal",
  HINTS: "hints",
  ACHIEVEMENTS: "achievements",
  LOCAL_COLLECTIBLES: "local-collectibles",
  PORTABLE_ENTITLEMENTS: "portable-entitlements",
  PORTABLE_REWARDS: "portable-rewards"
});

export const GreenRoadAuthority = Object.freeze({
  LOCAL_CLIENT: "local-client",
  PLAYER_PROFILE_SERVICE: "player-profile-service",
  GAMING_PROTOCOL: "420-gaming-protocol"
});

export const GREEN_ROAD_AUTHORITY_BY_DOMAIN = Object.freeze({
  [GreenRoadProgressDomain.CORE_PROGRESS]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.SCENE_PROGRESS]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.CLUES]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.JOURNAL]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.HINTS]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.ACHIEVEMENTS]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.LOCAL_COLLECTIBLES]: GreenRoadAuthority.PLAYER_PROFILE_SERVICE,
  [GreenRoadProgressDomain.PORTABLE_ENTITLEMENTS]: GreenRoadAuthority.GAMING_PROTOCOL,
  [GreenRoadProgressDomain.PORTABLE_REWARDS]: GreenRoadAuthority.GAMING_PROTOCOL
});

export const GREEN_ROAD_OFFLINE_POLICY = Object.freeze({
  guest: "local-authoritative-until-registration",
  registered: "append-events-and-reconcile",
  walletLinked: "append-events-and-reconcile",
  conflictRule: "monotonic-progress-no-destructive-rollback",
  chainRule: "portable-state-revalidated-before-use"
});

export function createGreenRoadSaveEnvelope({
  playerMode = GreenRoadPlayerMode.GUEST,
  playerId = null,
  revision = 0,
  updatedAt,
  progress = {}
} = {}) {
  if (!Object.values(GreenRoadPlayerMode).includes(playerMode)) {
    throw new TypeError(`Unsupported Green Road player mode: ${playerMode}`);
  }
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError("Green Road save revision must be a non-negative integer");
  }
  if (typeof updatedAt !== "string" || updatedAt.length === 0) {
    throw new TypeError("Green Road save updatedAt is required");
  }
  if (progress === null || typeof progress !== "object" || Array.isArray(progress)) {
    throw new TypeError("Green Road save progress must be an object");
  }

  return Object.freeze({
    gameId: GREEN_ROAD_GAME_ID,
    architectureVersion: GREEN_ROAD_ARCHITECTURE_VERSION,
    schemaVersion: GREEN_ROAD_SAVE_SCHEMA_VERSION,
    playerMode,
    playerId,
    revision,
    updatedAt,
    progress: Object.freeze({ ...progress })
  });
}

export function validateGreenRoadContentManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return false;
  if (manifest.gameId !== GREEN_ROAD_GAME_ID) return false;
  if (manifest.schemaVersion !== GREEN_ROAD_CONTENT_SCHEMA_VERSION) return false;
  if (typeof manifest.contentVersion !== "string" || manifest.contentVersion.length === 0) return false;
  if (!Array.isArray(manifest.chapters)) return false;

  const seen = new Set();
  for (const chapter of manifest.chapters) {
    if (!chapter || typeof chapter.id !== "string" || chapter.id.length === 0) return false;
    if (seen.has(chapter.id)) return false;
    seen.add(chapter.id);
    if (!Array.isArray(chapter.locations)) return false;

    for (const location of chapter.locations) {
      if (!location || typeof location.id !== "string" || location.id.length === 0) return false;
      if (seen.has(location.id)) return false;
      seen.add(location.id);
      if (!Array.isArray(location.scenes)) return false;

      for (const scene of location.scenes) {
        if (!scene || typeof scene.id !== "string" || scene.id.length === 0) return false;
        if (seen.has(scene.id)) return false;
        seen.add(scene.id);
        if (!Array.isArray(scene.hiddenObjects) || !Array.isArray(scene.clues)) return false;

        for (const object of [...scene.hiddenObjects, ...scene.clues]) {
          if (!object || typeof object.id !== "string" || object.id.length === 0) return false;
          if (seen.has(object.id)) return false;
          seen.add(object.id);
        }
      }
    }
  }

  return true;
}

export function authorityForGreenRoadDomain(domain, playerMode) {
  if (!Object.values(GreenRoadPlayerMode).includes(playerMode)) {
    throw new TypeError(`Unsupported Green Road player mode: ${playerMode}`);
  }
  const canonical = GREEN_ROAD_AUTHORITY_BY_DOMAIN[domain];
  if (!canonical) throw new TypeError(`Unsupported Green Road progress domain: ${domain}`);

  if (playerMode === GreenRoadPlayerMode.GUEST && canonical === GreenRoadAuthority.PLAYER_PROFILE_SERVICE) {
    return GreenRoadAuthority.LOCAL_CLIENT;
  }
  return canonical;
}
