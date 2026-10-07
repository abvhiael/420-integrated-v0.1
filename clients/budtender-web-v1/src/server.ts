import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";
import { BudtenderApplicationService } from "../../../src/budtender/BudtenderApplicationService.ts";
import { loadBudtenderRuntimeConfig } from "./runtime-config.ts";
import {
  BudtenderGamingIntegration,
  evaluateBudtenderAccess,
} from "../../budtender-access-v1/src/access.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAX_BODY_BYTES = 16 * 1024;

type Json = Record<string, unknown>;

const SECURITY_HEADERS = Object.freeze({
  "content-security-policy": "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-resource-policy": "same-origin",
});

const responseHeaders = (extra: Record<string, string | number> = {}) => ({
  ...SECURITY_HEADERS,
  ...extra,
});

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, responseHeaders({
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  }));
  res.end(payload);
};

const assertSameOrigin = (req: IncomingMessage): void => {
  const origin = req.headers.origin;
  if (!origin) return;

  const host = req.headers.host;
  if (!host) throw new Error("host header required");

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("invalid origin");
  }

  if (originHost !== host) throw new Error("cross-origin mutation rejected");
};

const readJson = async (req: IncomingMessage): Promise<Json> => {
  assertSameOrigin(req);
  const contentType = req.headers["content-type"] ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new Error("application/json required");
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error("request body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("JSON object required");
  }
  return parsed as Json;
};

const mime = (path: string): string => {
  switch (extname(path)) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    default: return "application/octet-stream";
  }
};

const staticPath = (urlPath: string): string | null => {
  const requested = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const normalized = normalize(requested);
  if (normalized.startsWith("..") || normalized.includes("../") || normalized.includes("..\\")) {
    return null;
  }
  return join(ROOT, normalized);
};

export interface BudtenderOperationalState {
  ready: boolean;
  shuttingDown: boolean;
}

export const createBudtenderWebServer = (
  application = new BudtenderApplicationService(),
  operational: BudtenderOperationalState = { ready: true, shuttingDown: false },
) => createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");

  try {
    if (url.pathname === "/healthz" && method === "GET") {
      return json(res, 200, { status: "ok", service: "budtender-web-v1" });
    }

    if (url.pathname === "/readyz" && method === "GET") {
      return json(res, operational.ready && !operational.shuttingDown ? 200 : 503, {
        status: operational.ready && !operational.shuttingDown ? "ready" : "not-ready",
        service: "budtender-web-v1",
      });
    }

    if (url.pathname === "/api/state" && method === "GET") {
      return json(res, 200, application.snapshot());
    }

    if (url.pathname === "/api/gaming" && method === "GET") {
      return json(res, 200, {
        ...BudtenderGamingIntegration,
        runtime: "deployment-pending",
        authoritativeSessionState: false,
      });
    }

    if (url.pathname === "/api/gaming/access" && method === "POST") {
      const body = await readJson(req);
      const before = application.snapshot();
      const decision = evaluateBudtenderAccess({
        feature: String(body.feature ?? ""),
        registered: body.registered === true,
        walletLinked: body.walletLinked === true,
        walletConnected: body.walletConnected === true,
      });
      const after = application.snapshot();
      return json(res, 200, {
        decision,
        gameStateUnchanged: JSON.stringify(before) === JSON.stringify(after),
        authoritativeSessionState: false,
      });
    }

    if (url.pathname === "/api/customers" && method === "POST") {
      const body = await readJson(req);
      application.arriveCustomer({
        id: String(body.id ?? ""),
        product: body.product as "flower" | "preroll" | "edible",
        archetype: body.archetype as any,
      });
      return json(res, 201, application.snapshot());
    }

    const serve = url.pathname.match(/^\/api\/customers\/([^/]+)\/serve$/);
    if (serve && method === "POST") {
      const sale = application.serveCustomer(decodeURIComponent(serve[1]));
      return json(res, 200, { sale, state: application.snapshot() });
    }

    if (url.pathname === "/api/tick" && method === "POST") {
      application.tickCustomers();
      return json(res, 200, application.snapshot());
    }

    if (url.pathname === "/api/restock" && method === "POST") {
      const body = await readJson(req);
      application.restock(body.product as "flower" | "preroll" | "edible", Number(body.units));
      return json(res, 200, application.snapshot());
    }

    if (url.pathname === "/api/upgrades" && method === "POST") {
      const body = await readJson(req);
      application.purchaseUpgrade(body.track as any);
      return json(res, 200, application.snapshot());
    }

    if (url.pathname === "/api/expansions" && method === "POST") {
      const body = await readJson(req);
      const cost = application.unlockExpansion(body.stage as any);
      return json(res, 200, { cost, state: application.snapshot() });
    }

    if (url.pathname === "/api/demand" && method === "POST") {
      const body = await readJson(req);
      application.setDemandProfile(body.profile as any);
      return json(res, 200, application.snapshot());
    }

    if (url.pathname.startsWith("/api/")) {
      return json(res, 404, { error: "unknown API route" });
    }

    if (method !== "GET") {
      return json(res, 405, { error: "method not allowed" });
    }

    const path = staticPath(url.pathname);
    if (!path) return json(res, 400, { error: "invalid path" });

    try {
      const content = await readFile(path);
      res.writeHead(200, responseHeaders({
        "content-type": mime(path),
        "content-length": content.length,
        "cache-control": "no-store",
      }));
      res.end(content);
    } catch {
      json(res, 404, { error: "not found" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    json(res, 400, { error: message });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadBudtenderRuntimeConfig();
  const operational: BudtenderOperationalState = { ready: true, shuttingDown: false };
  const server = createBudtenderWebServer(new BudtenderApplicationService(), operational);
  let closing = false;

  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    operational.ready = false;
    operational.shuttingDown = true;
    process.stdout.write(`Budtender shutdown requested: ${signal}\n`);
    server.close((error) => {
      if (error) {
        process.stderr.write(`Budtender shutdown failed: ${error.message}\n`);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  server.listen(config.port, config.host, () => {
    const origin = config.publicOrigin ?? `http://${config.host}:${config.port}`;
    process.stdout.write(`Budtender web client: ${origin}\n`);
  });
}
