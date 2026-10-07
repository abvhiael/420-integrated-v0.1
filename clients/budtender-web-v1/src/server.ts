import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";
import { BudtenderApplicationService } from "../../../src/budtender/BudtenderApplicationService.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAX_BODY_BYTES = 16 * 1024;

type Json = Record<string, unknown>;

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
};

const readJson = async (req: IncomingMessage): Promise<Json> => {
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

export const createBudtenderWebServer = (
  application = new BudtenderApplicationService(),
) => createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");

  try {
    if (url.pathname === "/api/state" && method === "GET") {
      return json(res, 200, application.snapshot());
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
      res.writeHead(200, {
        "content-type": mime(path),
        "content-length": content.length,
        "cache-control": "no-store",
      });
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
  const port = Number(process.env.PORT ?? 4207);
  const server = createBudtenderWebServer();
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Budtender web client: http://127.0.0.1:${port}\n`);
  });
}
