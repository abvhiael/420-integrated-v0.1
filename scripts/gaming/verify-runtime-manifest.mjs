import fs from "node:fs";

const path = process.argv[2] ?? "deployments/gaming/testnet.runtime.json";
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = "0x0000000000000000000000000000000000000000";
const requiredContracts = ["gamingAuthorization","gameRegistry","gameIdentity","gameEntitlements","gameClaims","crossGameRegistry"];
const requiredOperators = ["protocolAdmin","highCountryOperator","greenRoadOperator","budtenderOperator","smokeChromeOperator"];
const expectedGames = new Map([
  ["High Country", ["420/GAMING/GAME/HIGH_COUNTRY/V1", "highCountryOperator"]],
  ["The Green Road", ["420/GAMING/GAME/THE_GREEN_ROAD/V1", "greenRoadOperator"]],
  ["Budtender", ["420/GAMING/GAME/BUDTENDER/V1", "budtenderOperator"]],
  ["Smoke & Chrome", ["420/GAMING/GAME/SMOKE_AND_CHROME/V1", "smokeChromeOperator"]]
]);
function assert(c,m){if(!c) throw new Error(m);}
assert(manifest.schema === "420-gaming-runtime-v1", "unexpected runtime schema");
assert(manifest.network === "testnet", "expected testnet manifest");
const unresolved = manifest.status === "UNRESOLVED_UNTIL_DEPLOYMENT";
if (!unresolved) assert(Number.isInteger(manifest.chainId) && manifest.chainId > 0, "chainId must be a positive integer");
for (const key of requiredContracts) {
  const value = manifest.contracts?.[key];
  if (unresolved && value === null) continue;
  assert(ADDRESS.test(value ?? "") && value.toLowerCase() !== ZERO, `invalid contract address: ${key}`);
}
for (const key of requiredOperators) {
  const value = manifest.operators?.[key];
  if (unresolved && value === null) continue;
  assert(ADDRESS.test(value ?? "") && value.toLowerCase() !== ZERO, `invalid operator address: ${key}`);
}
for (const [name, [domain, operatorRef]] of expectedGames) {
  const game = manifest.games?.find((g) => g.name === name);
  assert(game, `${name} runtime registration missing`);
  assert(game.gameIdDomain === domain, `${name} game ID domain mismatch`);
  assert(game.operatorRef === operatorRef, `${name} operator binding mismatch`);
  assert(game.active === true, `${name} must be active in reference testnet manifest`);
}
const serialized = JSON.stringify(manifest).toLowerCase();
for (const forbidden of ["privatekey","private_key","seedphrase","seed_phrase","mnemonic","sessionkey","session_key"]) assert(!serialized.includes(forbidden), `forbidden secret field in runtime manifest: ${forbidden}`);
console.log(`420 Gaming runtime manifest verified: ${path} (${unresolved ? "deployment-pending" : "deployment-resolved"})`);
