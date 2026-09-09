import fs from "node:fs";

const path = process.argv[2] ?? "deployments/gaming/testnet.runtime.json";
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";
const requiredContracts = [
  "gamingAuthorization",
  "gameRegistry",
  "gameIdentity",
  "gameEntitlements",
  "gameClaims",
  "crossGameRegistry"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(manifest.schema === "420-gaming-runtime-v1", "unexpected runtime schema");
assert(manifest.network === "testnet", "expected testnet manifest");

const unresolvedAllowed = manifest.status === "UNRESOLVED_UNTIL_DEPLOYMENT";
if (!unresolvedAllowed) {
  assert(Number.isInteger(manifest.chainId) && manifest.chainId > 0, "chainId must be a positive integer");
}

for (const key of requiredContracts) {
  const value = manifest.contracts?.[key];
  if (unresolvedAllowed && value === null) continue;
  assert(ADDRESS.test(value ?? "") && value.toLowerCase() !== ZERO, `invalid contract address: ${key}`);
}

for (const key of ["protocolAdmin", "highCountryOperator"]) {
  const value = manifest.operators?.[key];
  if (unresolvedAllowed && value === null) continue;
  assert(ADDRESS.test(value ?? "") && value.toLowerCase() !== ZERO, `invalid operator address: ${key}`);
}

const highCountry = manifest.games?.find((game) => game.name === "High Country");
assert(highCountry, "High Country runtime registration missing");
assert(highCountry.gameIdDomain === "420/GAMING/GAME/HIGH_COUNTRY/V1", "High Country game ID domain mismatch");
assert(highCountry.operatorRef === "highCountryOperator", "High Country operator binding mismatch");
assert(highCountry.active === true, "High Country must be active in reference testnet manifest");

const expectedEntitlements = new Set([
  "420/HC/ENTITLEMENT/BONUS_REGION/V1",
  "420/HC/ENTITLEMENT/COSMETIC/V1",
  "420/HC/ENTITLEMENT/COMPETITION/V1",
  "420/HC/ENTITLEMENT/GENETICS/V1",
  "420/HC/ENTITLEMENT/CROSS_GAME/V1"
]);
for (const id of highCountry.entitlementDomains ?? []) expectedEntitlements.delete(id);
assert(expectedEntitlements.size === 0, "High Country entitlement catalogue incomplete");

const serialized = JSON.stringify(manifest).toLowerCase();
for (const forbidden of ["privatekey", "private_key", "seedphrase", "seed_phrase", "mnemonic", "sessionkey", "session_key"]) {
  assert(!serialized.includes(forbidden), `forbidden secret field in runtime manifest: ${forbidden}`);
}

console.log(`420 Gaming runtime manifest verified: ${path}`);
