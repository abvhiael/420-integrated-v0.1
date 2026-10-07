"use strict";

const state = {
  route: "latest",
  source: "",
  topic: "",
  newsCursor: "",
  originalsCursor: "",
  newsItems: [],
  originalItems: [],
  sources: [],
  topics: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setStatus(message, isError = false) {
  const node = $("#app-status");
  node.textContent = message || "";
  node.classList.toggle("error", Boolean(isError));
}

async function getJSON(path, options = {}) {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) {
    const error = new Error(body.error || "REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return body;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(date);
}

function textElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value || "";
  return node;
}

function topicButton(topic) {
  const button = textElement("button", "topic-chip", topic);
  button.type = "button";
  button.addEventListener("click", () => {
    state.topic = topic;
    $("#topic-filter").value = topic;
    location.hash = "news";
    resetNews();
    loadNews();
  });
  return button;
}

function externalNewsCard(item) {
  const article = document.createElement("article");
  article.className = "story-card";
  article.dataset.kind = "external-news";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(
    textElement("span", "badge", "External news"),
    textElement("span", "", item.source_name || item.source_id || "Source")
  );
  const date = formatDate(item.published_at || item.discovered_at);
  if (date) meta.append(textElement("time", "", date));
  article.append(meta);

  article.append(textElement("h3", "", item.title || "Untitled"));

  if (item.summary) {
    article.append(textElement("p", "", item.summary));
  }

  if (Array.isArray(item.topics) && item.topics.length) {
    const topics = document.createElement("div");
    topics.className = "topics";
    topics.setAttribute("aria-label", "Topics");
    item.topics.forEach((topic) => topics.append(topicButton(topic)));
    article.append(topics);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  if (item.canonical_url) {
    const link = textElement("a", "read-original", "Read original ↗");
    link.href = item.canonical_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.referrerPolicy = "strict-origin-when-cross-origin";
    link.setAttribute("aria-label", `Read original article at ${item.source_name || "publisher"} (opens in a new tab)`);
    actions.append(link);
  }
  article.append(actions);

  const attribution = item.attribution || `Source: ${item.source_name || item.source_id || "publisher"}`;
  article.append(textElement("small", "attribution", attribution));
  return article;
}

function originalCard(item) {
  const article = document.createElement("article");
  article.className = "story-card";
  article.dataset.kind = "reefer-review-original";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(textElement("span", "badge", "ReeferReview Original"));
  if (item.author) meta.append(textElement("span", "", item.author));
  const date = formatDate(item.published_at || item.created_at);
  if (date) meta.append(textElement("time", "", date));
  article.append(meta);

  article.append(textElement("h3", "", item.title || "Untitled"));
  if (item.summary) article.append(textElement("p", "", item.summary));

  article.append(textElement(
    "small",
    "attribution",
    "Published inside ReeferReview. Full article-reader workflow is scheduled for RR-3."
  ));
  return article;
}

function emptyCard(message) {
  return textElement("p", "empty", message);
}

function renderList(container, items, cardFactory, emptyMessage, append = false) {
  if (!append) container.replaceChildren();
  if (!items.length && !append) {
    container.append(emptyCard(emptyMessage));
    return;
  }
  items.forEach((item) => container.append(cardFactory(item)));
}

function newsQuery(cursor = "") {
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (cursor) params.set("cursor", cursor);
  if (state.source) params.set("source", state.source);
  if (state.topic) params.set("topic", state.topic);
  return params;
}

async function loadNews({ append = false } = {}) {
  try {
    setStatus("Loading cannabis news…");
    const page = await getJSON(`/v1/news?${newsQuery(append ? state.newsCursor : "").toString()}`);
    const items = Array.isArray(page.items) ? page.items : [];
    state.newsCursor = page.next_cursor || "";
    state.newsItems = append ? state.newsItems.concat(items) : items;
    renderList($("#news-feed"), items, externalNewsCard, "No cannabis news matches these filters yet.", append);
    $("#news-more").hidden = !state.newsCursor;
    setStatus(items.length ? `Loaded ${items.length} cannabis news item${items.length === 1 ? "" : "s"}.` : "No matching cannabis news.");
  } catch (error) {
    if (!append) renderList($("#news-feed"), [], externalNewsCard, "Cannabis news is temporarily unavailable.");
    setStatus(`Cannabis news unavailable: ${error.message}`, true);
  }
}

async function loadOriginals({ append = false } = {}) {
  try {
    setStatus("Loading ReeferReview Originals…");
    const params = new URLSearchParams({ limit: "20" });
    if (append && state.originalsCursor) params.set("cursor", state.originalsCursor);
    const page = await getJSON(`/v1/publications?${params.toString()}`);
    const items = Array.isArray(page.items) ? page.items : [];
    state.originalsCursor = page.next_cursor || "";
    state.originalItems = append ? state.originalItems.concat(items) : items;
    renderList($("#originals-feed"), items, originalCard, "No public ReeferReview Originals yet.", append);
    $("#originals-more").hidden = !state.originalsCursor;
    setStatus(items.length ? `Loaded ${items.length} ReeferReview Original${items.length === 1 ? "" : "s"}.` : "No public ReeferReview Originals yet.");
  } catch (error) {
    if (!append) renderList($("#originals-feed"), [], originalCard, "ReeferReview Originals are temporarily unavailable.");
    setStatus(`Originals unavailable: ${error.message}`, true);
  }
}

function latestTimestamp(entry) {
  const value = entry.kind === "news"
    ? (entry.item.published_at || entry.item.discovered_at)
    : (entry.item.published_at || entry.item.created_at);
  return safeDate(value)?.getTime() || 0;
}

async function loadLatest() {
  try {
    setStatus("Loading latest coverage…");
    const [news, originals] = await Promise.all([
      getJSON(`/v1/news?${newsQuery("").toString()}`),
      getJSON("/v1/publications?limit=20"),
    ]);
    const combined = [
      ...(Array.isArray(news.items) ? news.items : []).map((item) => ({ kind: "news", item })),
      ...(Array.isArray(originals.items) ? originals.items : []).map((item) => ({ kind: "original", item })),
    ].sort((a, b) => latestTimestamp(b) - latestTimestamp(a)).slice(0, 30);

    const container = $("#latest-feed");
    container.replaceChildren();
    if (!combined.length) {
      container.append(emptyCard("No coverage is available yet."));
    } else {
      combined.forEach((entry) => {
        container.append(entry.kind === "news" ? externalNewsCard(entry.item) : originalCard(entry.item));
      });
    }
    setStatus(combined.length ? `Loaded ${combined.length} latest item${combined.length === 1 ? "" : "s"}.` : "No coverage is available yet.");
  } catch (error) {
    renderList($("#latest-feed"), [], externalNewsCard, "Latest coverage is temporarily unavailable.");
    setStatus(`Latest coverage unavailable: ${error.message}`, true);
  }
}

async function loadSourcesAndTopics() {
  const [sourcesResult, topicsResult] = await Promise.allSettled([
    getJSON("/v1/news/sources"),
    getJSON("/v1/news/topics"),
  ]);

  if (sourcesResult.status === "fulfilled") {
    state.sources = Array.isArray(sourcesResult.value.sources) ? sourcesResult.value.sources : [];
    const select = $("#source-filter");
    select.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
    state.sources.forEach((source) => {
      const option = document.createElement("option");
      option.value = source.id;
      option.textContent = source.name;
      select.append(option);
    });
  }

  if (topicsResult.status === "fulfilled") {
    state.topics = Array.isArray(topicsResult.value.topics) ? topicsResult.value.topics : [];
    const select = $("#topic-filter");
    select.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
    state.topics.forEach((topic) => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      select.append(option);
    });
    renderTopics();
  }
}

function renderTopics() {
  const container = $("#topic-list");
  container.replaceChildren();
  if (!state.topics.length) {
    container.append(emptyCard("No topics are available yet."));
    return;
  }
  state.topics.forEach((topic) => container.append(topicButton(topic)));
}

async function runSearch(query) {
  const q = query.trim();
  const container = $("#search-results");
  container.replaceChildren();
  if (q.length < 2) {
    container.append(emptyCard("Enter at least two characters to search."));
    setStatus("Search needs at least two characters.", true);
    return;
  }

  try {
    setStatus(`Searching for “${q}”…`);
    const newsParams = new URLSearchParams({ limit: "100", q });
    if (state.source) newsParams.set("source", state.source);
    if (state.topic) newsParams.set("topic", state.topic);

    const [newsResult, originalsResult] = await Promise.allSettled([
      getJSON(`/v1/news?${newsParams.toString()}`),
      getJSON("/v1/publications?limit=100"),
    ]);

    const news = newsResult.status === "fulfilled" && Array.isArray(newsResult.value.items)
      ? newsResult.value.items : [];

    const lower = q.toLowerCase();
    const originals = originalsResult.status === "fulfilled" && Array.isArray(originalsResult.value.items)
      ? originalsResult.value.items.filter((item) =>
          `${item.title || ""}\n${item.summary || ""}\n${item.author || ""}`.toLowerCase().includes(lower))
      : [];

    const combined = [
      ...news.map((item) => ({ kind: "news", item })),
      ...originals.map((item) => ({ kind: "original", item })),
    ].sort((a, b) => latestTimestamp(b) - latestTimestamp(a));

    if (!combined.length) {
      container.append(emptyCard(`No results for “${q}”.`));
    } else {
      combined.forEach((entry) => container.append(entry.kind === "news" ? externalNewsCard(entry.item) : originalCard(entry.item)));
    }
    setStatus(`${combined.length} result${combined.length === 1 ? "" : "s"} for “${q}”.`);
  } catch (error) {
    container.append(emptyCard("Search is temporarily unavailable."));
    setStatus(`Search unavailable: ${error.message}`, true);
  }
}

function resetNews() {
  state.newsCursor = "";
  state.newsItems = [];
  $("#news-more").hidden = true;
}

function routeFromHash() {
  const route = location.hash.replace(/^#/, "").split("?")[0];
  return ["latest", "news", "originals", "topics", "search"].includes(route) ? route : "latest";
}

function showRoute(route) {
  state.route = route;
  $$(".view").forEach((view) => {
    view.hidden = view.dataset.view !== route;
  });
  $$("[data-route]").forEach((link) => {
    if (link.dataset.route === route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (route === "latest") loadLatest();
  if (route === "news") loadNews();
  if (route === "originals") loadOriginals();
  if (route === "topics") renderTopics();
  if (route === "search") $("#search-query").focus();
}

$("#source-filter").addEventListener("change", (event) => {
  state.source = event.target.value;
  resetNews();
  if (state.route === "news") loadNews();
  else if (state.route === "latest") loadLatest();
});

$("#topic-filter").addEventListener("change", (event) => {
  state.topic = event.target.value;
  resetNews();
  if (state.route === "news") loadNews();
  else if (state.route === "latest") loadLatest();
});

$("#clear-filters").addEventListener("click", () => {
  state.source = "";
  state.topic = "";
  $("#source-filter").value = "";
  $("#topic-filter").value = "";
  resetNews();
  if (state.route === "news") loadNews();
  else if (state.route === "latest") loadLatest();
  setStatus("News filters cleared.");
});

$("#news-more").addEventListener("click", () => loadNews({ append: true }));
$("#originals-more").addEventListener("click", () => loadOriginals({ append: true }));

$$("[data-refresh]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.refresh === "latest") loadLatest();
    if (button.dataset.refresh === "news") {
      resetNews();
      loadNews();
    }
    if (button.dataset.refresh === "originals") {
      state.originalsCursor = "";
      state.originalItems = [];
      loadOriginals();
    }
  });
});

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch($("#search-query").value);
});

$("#draft-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("#draft-status");
  status.textContent = "Creating draft…";
  try {
    const payload = {
      idempotency_key: crypto.randomUUID(),
      title: $("#draft-title").value,
      body: $("#draft-body").value,
      visibility: $("#visibility").value,
    };
    const result = await getJSON("/v1/publications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-420-Actor": $("#actor").value,
      },
      body: JSON.stringify(payload),
    });
    status.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    status.textContent = `Draft creation failed: ${error.message}`;
  }
});

window.addEventListener("hashchange", () => showRoute(routeFromHash()));

document.addEventListener("DOMContentLoaded", async () => {
  await loadSourcesAndTopics();
  showRoute(routeFromHash());
});
