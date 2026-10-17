// Phase 3.18: canonical presentation-only occlusion order. Not gameplay authority.
export const STORE_LAYERS = Object.freeze([
  "00_BACKGROUND",
  "01_WALLS_AND_WINDOWS",
  "02_FLOOR",
  "03_ARCHITECTURE",
  "04_FIXED_SHELVING",
  "05_FIXED_COUNTERS",
  "06_PRODUCT_DISPLAYS",
  "07_PROPS",
  "08_PLANTS",
  "09_CUSTOMERS",
  "10_STAFF",
  "11_INTERACTION_EFFECTS",
  "12_LIGHTING",
  "13_FOREGROUND",
  "14_UI"
]);
const layerRanks = new Map(STORE_LAYERS.map((name, rank) => [name, rank]));
export const getLayerRank = (name) => {
  if (typeof name !== "string" || !layerRanks.has(name)) throw new TypeError("unrecognized Budtender layer");
  return layerRanks.get(name);
};
export const orderSceneEntries = (entries) => {
  if (!Array.isArray(entries)) throw new TypeError("scene entries must be an array");
  return entries.map((entry, sequence) => ({entry,sequence,rank:getLayerRank(entry?.layer)}))
    .sort((a,b) => a.rank-b.rank || a.sequence-b.sequence).map(({entry})=>entry);
};
export const applySceneLayerOrder = (stage) => {
  if (!stage || typeof stage.querySelectorAll !== "function") throw new TypeError("invalid scene stage");
  const nodes = [...stage.querySelectorAll(":scope > [data-scene-layer]")];
  // Validate the full scene before applying any changes (fail closed on unknown layers).
  const ordered = orderSceneEntries(nodes.map(node=>({node,layer:node.getAttribute("data-scene-layer")})));
  for (const {node,layer} of ordered) node.style.zIndex = String(getLayerRank(layer));
  return ordered.map(({layer})=>layer);
};
