// L02.1: pure, fail-closed UI routing policy. Backend authorization remains mandatory.
export const ROUTES = Object.freeze({
  "/": { title: "Service status", role: null },
  "/drive": { title: "Drive with LIFTd", role: null },
  "/rider": { title: "Rider", role: "rider" },
  "/driver": { title: "Driver", role: "driver" },
  "/operator": { title: "Operator", role: "operator" }
});
export const AVAILABILITY = Object.freeze({ state: "not_live", label: "Not available for bookings", market: "Vancouver, BC", payments: "Payments are not enabled" });
export function normalizePath(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[%\\]/.test(path)) return null;
  const result = path.replace(/\/+$/, "") || "/";
  return Object.hasOwn(ROUTES, result) ? result : null;
}
export function routeDecision(path, session) {
  const key = normalizePath(path);
  if (!key) return { kind: "not-found", title: "Page not found" };
  const route = ROUTES[key];
  if (!route.role) return { kind: "public", title: route.title, path: key };
  if (!session || session.status === "loading") return { kind: "loading", title: "Checking access" };
  if (session.status === "error") return { kind: "error", title: "Access could not be verified" };
  if (session.status !== "authenticated" || session.revoked === true || !session.subject || !Array.isArray(session.roles)) return { kind: "sign-in", title: "Sign in required" };
  if (!session.roles.includes(route.role)) return { kind: "forbidden", title: "Access denied" };
  return { kind: "protected", title: route.title, path: key, role: route.role };
}
export function sanitizeReturnPath(path) {
  return normalizePath(path) || "/";
}
