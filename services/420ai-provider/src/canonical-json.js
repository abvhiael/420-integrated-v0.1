import { createHash, sign, verify } from "node:crypto";

function normalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = normalize(value[key]);
    return out;
  }
  throw new TypeError("unsupported canonical value");
}

export function canonicalJson420(value) {
  return JSON.stringify(normalize(value));
}

export function digestObject420(value) {
  return createHash("sha256").update(canonicalJson420(value)).digest("hex");
}

export function signObject420(value, privateKey) {
  if (!privateKey) throw new TypeError("privateKey required");
  const payload = Buffer.from(canonicalJson420(value));
  return {
    payload: structuredClone(value),
    digest: createHash("sha256").update(payload).digest("hex"),
    signature: sign(null, payload, privateKey).toString("base64")
  };
}

export function verifySignedObject420(signed, publicKey) {
  if (!signed || !publicKey || typeof signed.signature !== "string") return false;
  const payload = Buffer.from(canonicalJson420(signed.payload));
  const digest = createHash("sha256").update(payload).digest("hex");
  if (digest !== signed.digest) return false;
  try {
    return verify(null, payload, publicKey, Buffer.from(signed.signature, "base64"));
  } catch {
    return false;
  }
}
