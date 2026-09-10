import test from "node:test";
import assert from "node:assert/strict";

import {
  createGreenRoadSceneState,
  findGreenRoadObjectAtPoint,
  pointInNormalizedRegion,
  reduceGreenRoadScene,
  validateGreenRoadSceneDefinition,
  validateNormalizedRegion
} from "../src/scene-engine.js";

const scene = {
  schemaVersion: 1,
  id: "scene.kingston.sound-system.1",
  contentVersion: "founding-route-v1",
  hiddenObjects: [
    {
      id: "object.kingston.acetate.1",
      description: "acetate record",
      hitRegion: { kind: "circle", cx: 0.25, cy: 0.5, radius: 0.08 }
    },
    {
      id: "object.kingston.speaker.1",
      description: "speaker badge",
      hitRegion: { kind: "rect", x: 0.7, y: 0.2, width: 0.1, height: 0.15 }
    }
  ],
  clues: [
    { id: "clue.kingston.acetate.1", requiresObjectIds: ["object.kingston.acetate.1"] },
    { id: "clue.kingston.complete.1", requiresObjectIds: ["object.kingston.acetate.1", "object.kingston.speaker.1"] }
  ],
  completionRule: {
    kind: "all-required-objects",
    requiredObjectIds: ["object.kingston.acetate.1", "object.kingston.speaker.1"]
  }
};

test("normalized regions validate and resolve independent of device pixels", () => {
  assert.equal(validateNormalizedRegion({ kind: "circle", cx: 0.5, cy: 0.5, radius: 0.1 }), true);
  assert.equal(validateNormalizedRegion({ kind: "rect", x: 0.9, y: 0.9, width: 0.2, height: 0.1 }), false);
  assert.equal(pointInNormalizedRegion({ x: 0.25, y: 0.5 }, scene.hiddenObjects[0].hitRegion), true);
});

test("scene definitions fail closed on malformed relationships", () => {
  assert.equal(validateGreenRoadSceneDefinition(scene), true);

  const malformed = structuredClone(scene);
  malformed.clues[0].requiresObjectIds = ["object.foreign.missing"];
  assert.equal(validateGreenRoadSceneDefinition(malformed), false);
});

test("scene state starts wallet-free and contains only game-domain progress", () => {
  const state = createGreenRoadSceneState(scene);
  assert.deepEqual(state, {
    sceneId: scene.id,
    contentVersion: scene.contentVersion,
    foundObjectIds: [],
    unlockedClueIds: [],
    completed: false
  });
  assert.equal("wallet" in state, false);
  assert.equal("entitlements" in state, false);
});

test("object discovery is monotonic and unlocks clues deterministically", () => {
  let state = createGreenRoadSceneState(scene);
  state = reduceGreenRoadScene(scene, state, { type: "object-found", objectId: "object.kingston.acetate.1" });

  assert.deepEqual(state.foundObjectIds, ["object.kingston.acetate.1"]);
  assert.deepEqual(state.unlockedClueIds, ["clue.kingston.acetate.1"]);
  assert.equal(state.completed, false);

  const duplicate = reduceGreenRoadScene(scene, state, { type: "object-found", objectId: "object.kingston.acetate.1" });
  assert.deepEqual(duplicate.foundObjectIds, ["object.kingston.acetate.1"]);
});

test("coordinate hit testing discovers only unfound objects", () => {
  const initial = createGreenRoadSceneState(scene);
  const first = findGreenRoadObjectAtPoint(scene, initial, { x: 0.25, y: 0.5 });
  assert.equal(first.objectId, "object.kingston.acetate.1");

  const repeated = findGreenRoadObjectAtPoint(scene, first.state, { x: 0.25, y: 0.5 });
  assert.equal(repeated.objectId, null);
  assert.deepEqual(repeated.state.foundObjectIds, ["object.kingston.acetate.1"]);
});

test("scene completion is derived only from required object progress", () => {
  let state = createGreenRoadSceneState(scene);
  state = reduceGreenRoadScene(scene, state, { type: "object-found", objectId: "object.kingston.acetate.1" });
  state = reduceGreenRoadScene(scene, state, { type: "object-found", objectId: "object.kingston.speaker.1" });

  assert.equal(state.completed, true);
  assert.deepEqual(state.unlockedClueIds, ["clue.kingston.acetate.1", "clue.kingston.complete.1"]);
});

test("foreign object events fail closed", () => {
  const state = createGreenRoadSceneState(scene);
  assert.throws(
    () => reduceGreenRoadScene(scene, state, { type: "object-found", objectId: "object.foreign.1" }),
    /Unknown Green Road hidden object/
  );
});
