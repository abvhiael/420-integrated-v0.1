import test from "node:test";
import assert from "node:assert/strict";

import { GREEN_ROAD_GAME_ID } from "../src/access.js";
import {
  GreenRoadAuthority,
  GreenRoadPlayerMode,
  GreenRoadProgressDomain,
  authorityForGreenRoadDomain,
  createGreenRoadSaveEnvelope,
  validateGreenRoadContentManifest
} from "../src/architecture.js";

test("guest gameplay progress remains local-authoritative", () => {
  assert.equal(
    authorityForGreenRoadDomain(GreenRoadProgressDomain.CORE_PROGRESS, GreenRoadPlayerMode.GUEST),
    GreenRoadAuthority.LOCAL_CLIENT
  );
});

test("registered gameplay progress moves to the player profile service", () => {
  assert.equal(
    authorityForGreenRoadDomain(GreenRoadProgressDomain.SCENE_PROGRESS, GreenRoadPlayerMode.REGISTERED),
    GreenRoadAuthority.PLAYER_PROFILE_SERVICE
  );
});

test("portable wallet value is always gaming-protocol authoritative", () => {
  for (const mode of Object.values(GreenRoadPlayerMode)) {
    assert.equal(
      authorityForGreenRoadDomain(GreenRoadProgressDomain.PORTABLE_ENTITLEMENTS, mode),
      GreenRoadAuthority.GAMING_PROTOCOL
    );
    assert.equal(
      authorityForGreenRoadDomain(GreenRoadProgressDomain.PORTABLE_REWARDS, mode),
      GreenRoadAuthority.GAMING_PROTOCOL
    );
  }
});

test("save envelopes are scoped and versioned", () => {
  const save = createGreenRoadSaveEnvelope({
    playerMode: GreenRoadPlayerMode.GUEST,
    revision: 0,
    updatedAt: "2026-09-09T20:00:00Z",
    progress: { completedSceneIds: ["scene.kingston.sound-system.1"] }
  });

  assert.equal(save.gameId, GREEN_ROAD_GAME_ID);
  assert.equal(save.schemaVersion, 1);
  assert.equal(save.architectureVersion, 1);
  assert.equal(save.playerId, null);
});

test("content manifest requires globally unique immutable IDs", () => {
  const valid = {
    gameId: GREEN_ROAD_GAME_ID,
    schemaVersion: 1,
    contentVersion: "founding-route-v1",
    chapters: [{
      id: "chapter.kingston",
      locations: [{
        id: "location.kingston.record-room",
        scenes: [{
          id: "scene.kingston.sound-system.1",
          hiddenObjects: [{ id: "object.kingston.acetate.1" }],
          clues: [{ id: "clue.kingston.sound-system.1" }]
        }]
      }]
    }]
  };

  assert.equal(validateGreenRoadContentManifest(valid), true);

  const duplicate = structuredClone(valid);
  duplicate.chapters[0].locations[0].scenes[0].clues[0].id = "object.kingston.acetate.1";
  assert.equal(validateGreenRoadContentManifest(duplicate), false);
});

test("foreign-game manifests fail closed", () => {
  assert.equal(validateGreenRoadContentManifest({
    gameId: "420/GAMING/GAME/OTHER/V1",
    schemaVersion: 1,
    contentVersion: "v1",
    chapters: []
  }), false);
});
