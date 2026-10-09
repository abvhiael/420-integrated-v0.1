import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [server, config, pkg, manifest] = await Promise.all([
  readFile(new URL("src/server.ts", root), "utf8"),
  readFile(new URL("src/runtime-config.ts", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("deployment.runtime.json", root), "utf8"),
]);

const requiredServer = ["/healthz", "/readyz", "SIGTERM", "SIGINT", "server.close"];
const requiredConfig = ["non-loopback HOST requires BUDTENDER_PUBLIC_ORIGIN", "non-loopback deployment requires HTTPS"];
for (const token of requiredServer) if (!server.includes(token)) throw new Error(`missing operations control: ${token}`);
for (const token of requiredConfig) if (!config.includes(token)) throw new Error(`missing runtime policy: ${token}`);

const packageJson = JSON.parse(pkg);
if (packageJson.engines?.node !== ">=22") throw new Error("Node runtime contract drift");
if (!packageJson.scripts?.start || !packageJson.scripts?.ops) throw new Error("missing operational package scripts");

const runtime = JSON.parse(manifest);
if (runtime.liveDeployment !== false) throw new Error("repository manifest must not claim live deployment");
if (runtime.testnetQualified !== false) throw new Error("repository manifest must not claim testnet qualification");
if (runtime.healthPath !== "/healthz" || runtime.readinessPath !== "/readyz") throw new Error("health endpoint drift");

process.stdout.write("Budtender deployment/operations verifier: PASS\n");
