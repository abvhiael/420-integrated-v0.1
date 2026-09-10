export const GREEN_ROAD_SCENE_SCHEMA_VERSION = 1;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNormalizedNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function uniqueStrings(values) {
  return Array.isArray(values) && values.every((value) => typeof value === "string" && value.length > 0) && new Set(values).size === values.length;
}

export function validateNormalizedRegion(region) {
  if (!isRecord(region)) return false;
  if (region.kind === "circle") {
    return isNormalizedNumber(region.cx) && isNormalizedNumber(region.cy) &&
      typeof region.radius === "number" && Number.isFinite(region.radius) && region.radius > 0 && region.radius <= 1;
  }
  if (region.kind === "rect") {
    return isNormalizedNumber(region.x) && isNormalizedNumber(region.y) &&
      typeof region.width === "number" && Number.isFinite(region.width) && region.width > 0 && region.width <= 1 &&
      typeof region.height === "number" && Number.isFinite(region.height) && region.height > 0 && region.height <= 1 &&
      region.x + region.width <= 1 && region.y + region.height <= 1;
  }
  return false;
}

export function pointInNormalizedRegion(point, region) {
  if (!isRecord(point) || !isNormalizedNumber(point.x) || !isNormalizedNumber(point.y)) {
    throw new TypeError("Green Road scene point must use normalized x/y coordinates");
  }
  if (!validateNormalizedRegion(region)) {
    throw new TypeError("Green Road hit region is invalid");
  }

  if (region.kind === "circle") {
    const dx = point.x - region.cx;
    const dy = point.y - region.cy;
    return (dx * dx) + (dy * dy) <= region.radius * region.radius;
  }

  return point.x >= region.x && point.x <= region.x + region.width &&
    point.y >= region.y && point.y <= region.y + region.height;
}

export function validateGreenRoadSceneDefinition(scene) {
  if (!isRecord(scene)) return false;
  if (scene.schemaVersion !== GREEN_ROAD_SCENE_SCHEMA_VERSION) return false;
  if (typeof scene.id !== "string" || scene.id.length === 0) return false;
  if (typeof scene.contentVersion !== "string" || scene.contentVersion.length === 0) return false;
  if (!Array.isArray(scene.hiddenObjects) || !Array.isArray(scene.clues)) return false;
  if (!isRecord(scene.completionRule)) return false;

  const ids = new Set();
  for (const object of scene.hiddenObjects) {
    if (!isRecord(object) || typeof object.id !== "string" || object.id.length === 0) return false;
    if (ids.has(object.id)) return false;
    ids.add(object.id);
    if (!validateNormalizedRegion(object.hitRegion)) return false;
    if (object.description !== undefined && (typeof object.description !== "string" || object.description.length === 0)) return false;
  }

  for (const clue of scene.clues) {
    if (!isRecord(clue) || typeof clue.id !== "string" || clue.id.length === 0) return false;
    if (ids.has(clue.id)) return false;
    ids.add(clue.id);
    if (clue.requiresObjectIds !== undefined && !uniqueStrings(clue.requiresObjectIds)) return false;
    if ((clue.requiresObjectIds ?? []).some((id) => !scene.hiddenObjects.some((object) => object.id === id))) return false;
  }

  const rule = scene.completionRule;
  if (rule.kind !== "all-required-objects") return false;
  const required = rule.requiredObjectIds ?? scene.hiddenObjects.map((object) => object.id);
  if (!uniqueStrings(required)) return false;
  if (required.some((id) => !scene.hiddenObjects.some((object) => object.id === id))) return false;

  return true;
}

export function createGreenRoadSceneState(scene) {
  if (!validateGreenRoadSceneDefinition(scene)) {
    throw new TypeError("Green Road scene definition is invalid");
  }
  return Object.freeze({
    sceneId: scene.id,
    contentVersion: scene.contentVersion,
    foundObjectIds: Object.freeze([]),
    unlockedClueIds: Object.freeze([]),
    completed: false
  });
}

function deriveUnlockedClueIds(scene, foundObjectIds) {
  const found = new Set(foundObjectIds);
  return scene.clues
    .filter((clue) => (clue.requiresObjectIds ?? []).every((id) => found.has(id)))
    .map((clue) => clue.id);
}

function deriveCompletion(scene, foundObjectIds) {
  const found = new Set(foundObjectIds);
  const required = scene.completionRule.requiredObjectIds ?? scene.hiddenObjects.map((object) => object.id);
  return required.every((id) => found.has(id));
}

export function reduceGreenRoadScene(scene, state, event) {
  if (!validateGreenRoadSceneDefinition(scene)) throw new TypeError("Green Road scene definition is invalid");
  if (!isRecord(state) || state.sceneId !== scene.id || state.contentVersion !== scene.contentVersion) {
    throw new TypeError("Green Road scene state does not match the scene definition");
  }
  if (!isRecord(event) || event.type !== "object-found" || typeof event.objectId !== "string") {
    throw new TypeError("Unsupported Green Road scene event");
  }
  if (!scene.hiddenObjects.some((object) => object.id === event.objectId)) {
    throw new TypeError(`Unknown Green Road hidden object: ${event.objectId}`);
  }

  const foundObjectIds = state.foundObjectIds.includes(event.objectId)
    ? [...state.foundObjectIds]
    : [...state.foundObjectIds, event.objectId];
  const unlockedClueIds = deriveUnlockedClueIds(scene, foundObjectIds);

  return Object.freeze({
    sceneId: scene.id,
    contentVersion: scene.contentVersion,
    foundObjectIds: Object.freeze(foundObjectIds),
    unlockedClueIds: Object.freeze(unlockedClueIds),
    completed: deriveCompletion(scene, foundObjectIds)
  });
}

export function findGreenRoadObjectAtPoint(scene, state, point) {
  if (!validateGreenRoadSceneDefinition(scene)) throw new TypeError("Green Road scene definition is invalid");
  if (!isRecord(state) || state.sceneId !== scene.id) throw new TypeError("Green Road scene state does not match the scene definition");

  const found = new Set(state.foundObjectIds);
  const match = scene.hiddenObjects.find((object) => !found.has(object.id) && pointInNormalizedRegion(point, object.hitRegion));
  if (!match) return Object.freeze({ state, objectId: null });

  return Object.freeze({
    state: reduceGreenRoadScene(scene, state, { type: "object-found", objectId: match.id }),
    objectId: match.id
  });
}
