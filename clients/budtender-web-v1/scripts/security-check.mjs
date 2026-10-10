import { readFile } from "node:fs/promises";

const [server, runtimeConfig] = await Promise.all([
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/runtime-config.ts", import.meta.url), "utf8"),
]);

const required = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-resource-policy",
  "application/json required",
  "cross-origin mutation rejected",
];

for (const token of required) {
  if (!server.includes(token)) {
    throw new Error(`missing required Budtender web security control: ${token}`);
  }
}

for (const token of [
  'env.HOST ?? "127.0.0.1"',
  "non-loopback HOST requires BUDTENDER_PUBLIC_ORIGIN",
  "non-loopback deployment requires HTTPS BUDTENDER_PUBLIC_ORIGIN",
]) {
  if (!runtimeConfig.includes(token)) {
    throw new Error(`missing required Budtender runtime security control: ${token}`);
  }
}

const forbidden = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /node:child_process/,
  /\bexecSync\b/,
  /\bspawnSync\b/,
];

for (const pattern of forbidden) {
  if (pattern.test(server)) {
    throw new Error(`forbidden Budtender web host security surface: ${pattern}`);
  }
}

process.stdout.write("Budtender web security verifier: PASS\n");
