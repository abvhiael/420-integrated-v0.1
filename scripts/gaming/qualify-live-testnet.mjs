import fs from "node:fs";

const path = process.argv[2] ?? "deployments/gaming/testnet.runtime.json";
const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
if (manifest.status === "UNRESOLVED_UNTIL_DEPLOYMENT") {
  console.error("420GP-15 live qualification blocked: testnet runtime is unresolved until deployment.");
  process.exit(2);
}
if (!process.env.GAMING_TESTNET_RPC_URL) {
  console.error("420GP-15 live qualification blocked: GAMING_TESTNET_RPC_URL is required.");
  process.exit(2);
}

const rpc = process.env.GAMING_TESTNET_RPC_URL;
async function rpcCall(method, params = []) {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const chainIdHex = await rpcCall("eth_chainId");
const chainId = Number.parseInt(chainIdHex, 16);
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);

for (const [name, address] of Object.entries(manifest.contracts)) {
  const code = await rpcCall("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") throw new Error(`no deployed code at ${name}: ${address}`);
}

console.log(`420GP-15 live testnet RPC/code qualification passed on chain ${chainId}.`);
