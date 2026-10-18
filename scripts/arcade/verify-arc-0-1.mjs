import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const docPath="docs/arcade/ARC-0.1-CANONICAL-REPOSITORY-AND-ASSET-AUDIT.md";
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const audit=read(docPath);
const required=["config/genesis-applications.json","packages/420-gaming-sdk/README.md","packages/420-gaming-sdk/src/client.js","docs/developers/gaming-protocol-integration.md","docs/developers/gaming-onboarding.md","docs/gaming/420GP-17-DEVELOPER-PORTAL-GAME-ONBOARDING.md","docs/gaming/420GP-15-LIVE-TESTNET.md",".github/workflows/gaming-sdk.yml","contracts/src/gaming/GameRegistry420.sol","contracts/src/gaming/GameIdentity420.sol","contracts/src/gaming/GameEntitlements420.sol","contracts/src/gaming/GameClaims420.sol","contracts/src/gaming/CrossGameRegistry420.sol","contracts/src/gaming/GamingAuthorization420.sol"];
for(const f of required) assert.ok(fs.statSync(path.join(root,f)).isFile(),`Missing source: ${f}`);
const genesis=JSON.parse(read("config/genesis-applications.json"));
assert.equal(genesis.status,"FROZEN");
assert.ok(genesis.apps.some(x=>x.name==="420 Gaming Protocol"));
assert.ok(!genesis.apps.some(x=>/420\s*Arcade/i.test(x.name)), "Genesis registry amended without authorization");
assert.match(read("packages/420-gaming-sdk/src/client.js"),/createGamingClient420/);
assert.match(read("docs/gaming/420GP-15-LIVE-TESTNET.md"),/UNRESOLVED_UNTIL_DEPLOYMENT/);
for(const m of audit.matchAll(/\]\((\.\.\/[^)]+)\)/g)){
 const target=path.resolve(root,path.dirname(docPath),m[1]);
 assert.ok(target.startsWith(root+path.sep),"Relative link escaped repository");
 assert.ok(fs.existsSync(target),`Broken audit link: ${m[1]}`);
}
const games=["Kush Crush","420Colouring Book","420Buddy","Bong Breaker","Baked Invaders","Puff-Man","Grasshopper","Roach Run","High Climb","Where's Dave?","Mad Bud Delivery"];
for(const game of games)assert.ok(audit.includes(game),`Missing scoped game: ${game}`);
assert.match(audit,/11aad7b9be008c57d70f7f6b1fd1094c48fff03b/);
assert.match(audit,/Kush Krusher, Sativa Steve, Terpene Tina, Hash Gordon, Dabby, Purple Haze, Roach, The Edible, Bongwater Bob, Northern Lights/);
assert.match(audit,/Level 1|LEVEL 1/);
assert.match(audit,/not.*authoriz|not.*authorization|NOT.*authoriz/i);
console.log(`ARC-0.1 Level 1 inventory PASS: ${required.length} canonical files, ${games.length} game names, links, Genesis freeze and source provenance. External Mad Buds source evidence anchored to recorded SHA; not replicated by this local verifier.`);
