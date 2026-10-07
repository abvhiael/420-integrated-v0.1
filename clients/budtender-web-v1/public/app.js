const $ = (selector) => document.querySelector(selector);
const cash = $("#cash");
const inventory = $("#inventory");
const queue = $("#queue");
const upgrades = $("#upgrades");
const expansions = $("#expansions");
const demandProfile = $("#demand-profile");
const error = $("#error");
const customerForm = $("#customer-form");

const upgradeTracks = [
  ["counterSpeed", "counter speed"],
  ["shelfCapacity", "shelf capacity"],
  ["saleValue", "sale value"],
  ["customerPatience", "customer patience"],
  ["tipChance", "tip chance"],
  ["restockCapacity", "restock capacity"],
  ["decorAppeal", "decor appeal"],
];

const expansionOrder = [
  "tinyShop", "largerRetailFloor", "secondCounter", "premiumSection",
  "storageRoom", "cannabisCafe", "lounge", "deliveryDesk",
];

let state = null;
let customerSequence = 1;

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "request failed");
  return body;
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
  window.clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => { error.hidden = true; }, 4200);
};

const mutate = async (action) => {
  try {
    const result = await action();
    state = result.state ?? result;
    render();
  } catch (cause) {
    showError(cause instanceof Error ? cause.message : "request failed");
  }
};

const renderInventory = () => {
  inventory.replaceChildren();
  for (const [key, item] of Object.entries(state.store.products)) {
    const node = $("#inventory-card").content.cloneNode(true);
    node.querySelector("[data-name]").textContent = key === "preroll" ? "pre-roll" : key;
    node.querySelector("[data-stock]").textContent = item.stock;
    node.querySelector("[data-capacity]").textContent = item.capacity;
    node.querySelector("[data-price]").textContent = "sale $" + item.basePrice;
    node.querySelector("[data-restock]").addEventListener("click", () => mutate(() =>
      request("/api/restock", { method: "POST", body: JSON.stringify({ product: key, units: 1 }) })
    ));
    inventory.append(node);
  }
};

const renderQueue = () => {
  queue.replaceChildren();
  const waiting = state.customers.customers.filter((customer) => customer.status === "queued");
  if (waiting.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "queue is clear.";
    queue.append(empty);
    return;
  }
  for (const customer of waiting) {
    const item = document.createElement("article");
    item.className = "queue-item";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = customer.product === "preroll" ? "pre-roll customer" : customer.product + " customer";
    const meta = document.createElement("p");
    meta.className = "subtitle";
    meta.textContent = customer.archetype + " · patience " + customer.patienceRemaining;
    copy.append(title, meta);
    const serve = document.createElement("button");
    serve.textContent = "serve";
    serve.addEventListener("click", () => mutate(() =>
      request("/api/customers/" + encodeURIComponent(customer.id) + "/serve", { method: "POST", body: "{}" })
    ));
    item.append(copy, serve);
    queue.append(item);
  }
};

const renderUpgrades = () => {
  upgrades.replaceChildren();
  for (const [track, label] of upgradeTracks) {
    const item = document.createElement("article");
    item.className = "card";
    const level = state.progression.upgrades[track];
    const title = document.createElement("h3");
    title.textContent = label;
    const copy = document.createElement("p");
    copy.textContent = "level " + level + " / 5";
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = level >= 5 ? "maxed" : "upgrade";
    button.disabled = level >= 5;
    button.addEventListener("click", () => mutate(() =>
      request("/api/upgrades", { method: "POST", body: JSON.stringify({ track }) })
    ));
    item.append(title, copy, button);
    upgrades.append(item);
  }
};

const renderExpansions = () => {
  expansions.replaceChildren();
  const unlocked = new Set(state.progression.unlockedExpansions);
  for (const stage of expansionOrder) {
    const row = document.createElement("article");
    row.className = "queue-item";
    const label = document.createElement("span");
    label.textContent = stage.replace(/([A-Z])/g, " $1").toLowerCase();
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = unlocked.has(stage) ? "unlocked" : "locked";
    row.append(label, badge);
    if (!unlocked.has(stage)) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "unlock";
      button.addEventListener("click", () => mutate(() =>
        request("/api/expansions", { method: "POST", body: JSON.stringify({ stage }) })
      ));
      row.append(button);
    }
    expansions.append(row);
  }
};

const render = () => {
  cash.textContent = "$" + state.store.cash;
  const traffic = state.customers.demandProfile === "fourTwentyRush" ? "4:20 rush" : "normal traffic";
  $("#status-line").textContent = state.customers.queue.length + " waiting · " + traffic;
  demandProfile.value = state.customers.demandProfile;
  renderInventory();
  renderQueue();
  renderUpgrades();
  renderExpansions();
};

$("#tick").addEventListener("click", () => mutate(() => request("/api/tick", { method: "POST", body: "{}" })));
$("#add-customer").addEventListener("click", () => { customerForm.hidden = !customerForm.hidden; });
customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = {
    id: "web-" + customerSequence++,
    product: $("#customer-product").value,
    archetype: $("#customer-archetype").value,
  };
  mutate(() => request("/api/customers", { method: "POST", body: JSON.stringify(body) }));
});
demandProfile.addEventListener("change", () => mutate(() =>
  request("/api/demand", { method: "POST", body: JSON.stringify({ profile: demandProfile.value }) })
));

try {
  state = await request("/api/state");
  render();
} catch (cause) {
  showError(cause instanceof Error ? cause.message : "unable to load Budtender");
}
