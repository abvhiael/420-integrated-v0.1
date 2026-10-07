import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../src/server.ts", import.meta.url), "utf8");

const required = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-resource-policy",
  "application/json required",
  "cross-origin mutation rejected",
  'server.listen(port, "127.0.0.1"',
];

for (const token of required) {
  if (!server.includes(token)) {
    throw new Error(`missing required Budtender web security control: ${token}`);
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
