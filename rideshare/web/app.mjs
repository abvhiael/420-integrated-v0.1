import {mountOperatorConsole} from './operator-console.mjs';
import { ROUTES, AVAILABILITY, routeDecision, sanitizeReturnPath } from "./route-policy.mjs";
import { mountRiderAccount } from "./rider-account.mjs";
import { createRiderPreferencesApi } from "./preferences-api.mjs";
import { mountPickupView } from "./pickup-view.mjs";
import { createLocationProviders } from "./location-providers.mjs";
import { mountQuoteView } from "./quote-view.mjs";
import { createQuoteApi } from "./quote-api.mjs";
import { mountTripExperience } from "./trip-experience-view.mjs";
import { createTripExperienceApi } from "./trip-experience-api.mjs";
import { mountDriverOnboarding } from "./driver-onboarding.mjs";
import { createDriverOnboardingApi } from "./driver-onboarding-api.mjs";
import { mountDriverAvailability } from "./driver-availability-view.mjs";
import { createDriverAvailabilityApi } from "./driver-availability-api.mjs";
import { mountDriverTrip } from "./driver-trip-view.mjs";
import { createDriverTripApi } from "./driver-trip-api.mjs";

const root = document.getElementById("main");
const menu = document.getElementById("menu-toggle");
const nav = document.getElementById("site-nav");
let session = null;
let requestNumber = 0;
let clearRiderAccount = null;
let clearPickupView = null;
let quotePanel = null;
let tripPanel = null;
let clearDriverOnboarding = null;
let clearDriverAvailability = null;
let clearDriverTrip = null;
let clearOperatorConsole = null;
let focusAfterNavigation = false;
let connectivityAvailable = globalThis.navigator?.onLine !== false;

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
  if (clearDriverOnboarding) { clearDriverOnboarding(); clearDriverOnboarding = null; }
  if (clearDriverAvailability) { clearDriverAvailability(); clearDriverAvailability = null; }
  if (clearDriverTrip) { clearDriverTrip(); clearDriverTrip = null; }
  if(clearOperatorConsole){clearOperatorConsole();clearOperatorConsole=null;}
  root.replaceChildren();
  root.setAttribute("aria-busy", "false");
  const panel = node("section", undefined, "panel");
  panel.append(node("h1", decision.title));
  if (decision.kind === "public") {
    /* Official LIFTd public logo */
    const officialLogo = document.createElement("img");
    officialLogo.className = "main-logo";
    officialLogo.src = "./assets/liftd-official-logo.png";
    officialLogo.alt = "LIFTd — arrive higher";
    officialLogo.width = 1536;
    officialLogo.height = 1024;
    panel.insertBefore(officialLogo, panel.firstChild);
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
    panel.append(node("p", connectivityAvailable ? "Verification failed. Access remains blocked; retry when session services are available." : "Connection unavailable. Access remains blocked until reconnection and fresh verification."));
    const retry = node("button", "Retry verification");
    retry.type = "button";
    retry.disabled = !connectivityAvailable;
    retry.addEventListener("click", () => void refresh());
    panel.append(retry);
  } else {
    panel.append(node("p", "This page is not part of the LIFTd application."));
  }
  root.append(panel);
  if (focusAfterNavigation) {
    focusAfterNavigation = false;
    root.focus();
  }
  if (decision.kind === "protected" && decision.role === "rider") {
    clearRiderAccount = mountRiderAccount(root, createRiderPreferencesApi(globalThis.LIFTdSessionAdapter), session);
    const quoteApi = createQuoteApi(globalThis.LIFTdSessionAdapter);
    tripPanel = mountTripExperience(root, session, createTripExperienceApi(globalThis.LIFTdSessionAdapter),globalThis.LIFTdSessionAdapter);
    quotePanel = mountQuoteView(root, session, quoteApi, tripId => tripPanel?.load(tripId));
    clearPickupView = mountPickupView(root, session, createLocationProviders(globalThis.LIFTdSessionAdapter, {search:globalThis.LIFTdPlaceSearchProvider,resolveAddress:globalThis.LIFTdAddressResolver}), route => quotePanel?.showRoute(route));
  }
  if (decision.kind === "protected" && decision.role === "driver") {
    clearDriverAvailability = mountDriverAvailability(root, session, createDriverAvailabilityApi(globalThis.LIFTdSessionAdapter));
    const panel = mountDriverTrip(root, session, createDriverTripApi(globalThis.LIFTdSessionAdapter), {
      navigationCapability:globalThis.LIFTdNavigationCapability,
      sessionProvider:globalThis.LIFTdSessionAdapter,
      openNavigation: url => window.open(url, "_blank", "noopener,noreferrer")
    });
    clearDriverTrip = () => panel.destroy();
  }
  if(decision.kind==="protected"&&decision.role==="operator"){
    clearOperatorConsole=mountOperatorConsole(root,session,globalThis.LIFTdSessionAdapter);
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
  const pending = !connectivityAvailable ? {kind:"error",title:"Connection unavailable"} : routeDecision(path, { status: "loading" });
  renderDecision(pending);
  markCurrent(path);
  if (!connectivityAvailable || pending.kind === "public" || pending.kind === "not-found") return renderDecision(pending);
  const candidate = await loadSession();
  if (token !== requestNumber || !connectivityAvailable) return; // stale session completion cannot grant access after disconnect
  session = candidate;
  renderDecision(routeDecision(path, session));
}
function navigate(path) {
  const next = sanitizeReturnPath(path);
  if (location.pathname !== next) history.pushState({}, "", next);
  nav.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
  focusAfterNavigation = true;
  void refresh();
}
document.addEventListener("click", event => {
  const anchor = event.target.closest?.("a[data-route]");
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(anchor.getAttribute("href"));
});
menu.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (menu.getAttribute("aria-expanded") === "true") {
    nav.classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
    menu.focus();
  }
});
nav.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  nav.classList.remove("open");
  menu.setAttribute("aria-expanded", "false");
  menu.focus();
});
menu.addEventListener("click", () => {
  const expanded = menu.getAttribute("aria-expanded") === "true";
  menu.setAttribute("aria-expanded", String(!expanded));
  nav.classList.toggle("open", !expanded);
});
window.addEventListener("popstate", () => { focusAfterNavigation = true; void refresh(); });
window.addEventListener("offline", () => {
  connectivityAvailable = false;
  requestNumber++;
  session = null;
  renderDecision({kind:"error",title:"Connection unavailable"});
});
window.addEventListener("online", () => {
  if (!connectivityAvailable) { connectivityAvailable = true; void refresh(); }
});
window.addEventListener("liftd:session-changed", () => void refresh());
void refresh();
