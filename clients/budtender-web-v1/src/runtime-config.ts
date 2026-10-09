export interface BudtenderRuntimeConfig {
  host: string;
  port: number;
  publicOrigin: string | null;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

const parsePort = (value: string | undefined): number => {
  if (value === undefined || value === "") return 4207;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be an integer");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT out of range");
  return port;
};

export const loadBudtenderRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): BudtenderRuntimeConfig => {
  const host = (env.HOST ?? "127.0.0.1").trim();
  if (!host) throw new Error("HOST required");

  const port = parsePort(env.PORT);
  const publicOriginRaw = env.BUDTENDER_PUBLIC_ORIGIN?.trim();
  let publicOrigin: string | null = null;

  if (publicOriginRaw) {
    const parsed = new URL(publicOriginRaw);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("BUDTENDER_PUBLIC_ORIGIN must be an origin only");
    }
    publicOrigin = parsed.origin;
  }

  if (!LOOPBACK_HOSTS.has(host)) {
    if (!publicOrigin) throw new Error("non-loopback HOST requires BUDTENDER_PUBLIC_ORIGIN");
    if (!publicOrigin.startsWith("https://")) {
      throw new Error("non-loopback deployment requires HTTPS BUDTENDER_PUBLIC_ORIGIN");
    }
  }

  return { host, port, publicOrigin };
};

export const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS.has(host);
