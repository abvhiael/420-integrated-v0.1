import { ROUTES, AVAILABILITY, routeDecision, sanitizeReturnPath } from "./route-policy.mjs";
import { mountRiderAccount } from "./rider-account.mjs";
import { createRiderPreferencesApi } from "./preferences-api.mjs";
import { mountPickupView } from "./pickup-view.mjs";
import { createLocationProviders } from "./location-providers.mjs";
import { mountQuoteView } from "./quote-view.mjs";
import { createQuoteApi } from "./quote-api.mjs";
import { mountTripExperience } from "./trip-experience-view.mjs";
import { createTripExperienceApi } from "./trip-experience-api.mjs";

const root = document.getElementById("main");
const menu = document.getElementById("menu-toggle");
const nav = document.getElementById("site-nav");
let session = null;
let requestNumber = 0;
let clearRiderAccount = null;
let clearPickupView = null;
let quotePanel = null;
let tripPanel = null;

// The host must provide an independently authenticated session adapter.
// No localStorage, query-string identity, simulated principal or demo operator bypass.
async function loadSession() {
  const adapter = globalThis.LIFTdSessionAdapter;
  if (!adapter || typeof adapter.getSession !== "function") return { status: "unauthenticated" };
  try {
    const result = await adapter.getSession();
    return result && typeof result === "object" ? result : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function renderDecision(decision) {
  if (clearRiderAccount) { clearRiderAccount(); clearRiderAccount = null; }
  if (clearPickupView) { clearPickupView(); clearPickupView = null; }
  if (quotePanel) { quotePanel.destroy(); quotePanel = null; }
  if (tripPanel) { tripPanel.destroy(); tripPanel = null; }
  root.replaceChildren();
  root.setAttribute("aria-busy", "false");
  const panel = node("section", undefined, "panel");
  panel.append(node("h1", decision.title));
  if (decision.kind === "public") {
    panel.append(node("p", AVAILABILITY.market + " pilot — " + AVAILABILITY.label + ".", "status"));
    panel.append(node("p", AVAILABILITY.payments + ". Driver offers and vehicle availability are not live.", "muted"));
  } else if (decision.kind === "protected") {
    panel.append(node("p", decision.role[0].toUpperCase()+decision.role.slice(1)+" workspace — preview only.", "status"));
    panel.append(node("p", "No live dispatch, ride requests, payment acceptance, or operational approvals are available.", "muted"));
  } else if (decision.kind === "loading") {
    panel.append(node("p", "Verifying your current session. No access is granted until verification completes."));
  } else if (decision.kind === "sign-in") {
    panel.append(node("p", "An independently verified, active session is required. Sign-in is not available in this static preview."));
  } else if (decision.kind === "forbidden") {
    panel.append(node("p", "Your verified session does not have permission to access this workspace."));
  } else if (decision.kind === "error") {
    panel.append(node("p", "Verification failed. Access remains blocked; retry when session services are available."));
    const retry = node("button", "Retry verification");
    retry.type = "button";
    retry.addEventListener("click", () => void refresh());
    panel.append(retry);
  } else {
    panel.append(node("p", "This page is not part of the LIFTd application."));
  }
  root.append(panel);
  if (decision.kind === "protected" && decision.role === "rider") {
    clearRiderAccount = mountRiderAccount(root, createRiderPreferencesApi(globalThis.LIFTdSessionAdapter), session);
    const quoteApi = createQuoteApi(globalThis.LIFTdSessionAdapter);
    tripPanel = mountTripExperience(root, session, createTripExperienceApi(globalThis.LIFTdSessionAdapter));
    quotePanel = mountQuoteView(root, session, quoteApi, tripId => tripPanel?.load(tripId));
    clearPickupView = mountPickupView(root, session, createLocationProviders(globalThis.LIFTdSessionAdapter, {search:globalThis.LIFTdPlaceSearchProvider,resolveAddress:globalThis.LIFTdAddressResolver}), route => quotePanel?.showRoute(route));
  }
  document.title = decision.title + " — LIFTd";
}
function markCurrent(path) {
  for (const a of document.querySelectorAll("[data-route]")) {
    if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}
async function refresh() {
  const token = ++requestNumber;
  const path = sanitizeReturnPath(location.pathname);
  session = null;
  const pending = routeDecision(path, { status: "loading" });
  renderDecision(pending);
  markCurrent(path);
  if (pending.kind === "public" || pending.kind === "not-found") return renderDecision(pending);
  const candidate = await loadSession();
  if (token !== requestNumber) return; // stale session completion must not overwrite new navigation
  session = candidate;
  renderDecision(routeDecision(path, session));
}
function navigate(path) {
  const next = sanitizeReturnPath(path);
  if (location.pathname !== next) history.pushState({}, "", next);
  nav.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
  void refresh();
  root.focus();
}
document.addEventListener("click", event => {
  const anchor = event.target.closest?.("a[data-route]");
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(anchor.getAttribute("href"));
});
menu.addEventListener("click", () => {
  const expanded = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("open", !expanded);
});
window.addEventListener("popstate", () => void refresh());
window.addEventListener("liftd:session-changed", () => void refresh());
void refresh();
