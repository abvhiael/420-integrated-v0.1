const byId = (id) => document.getElementById(id);

function fmt(value) {
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

function metricValue(metric) {
  if (metric.value !== undefined) return metric.value;
  if (metric.latest !== undefined) return metric.latest;
  return "—";
}

async function loadStatus() {
  const readiness = byId("readiness");
  const notice = byId("backendNotice");
  try {
    const response = await fetch("/v1/status", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const data = await response.json();
    const indexed = Number(data.indexedHeight ?? data.indexed_height ?? 0);
    const safe = Number(data.safeHeight ?? data.safe_height ?? 0);

    byId("chainId").textContent = fmt(data.chainId ?? data.chain_id);
    byId("indexedHeight").textContent = fmt(indexed || data.indexedHeight);
    byId("safeHeight").textContent = fmt(safe || data.safeHeight);
    byId("finalityDepth").textContent = Number.isFinite(indexed - safe) && indexed >= safe ? String(indexed - safe) : "—";
    byId("indexedAt").textContent = fmt(data.indexedAt ?? data.indexed_at);
    readiness.textContent = data.stale ? "stale" : "ready";
    readiness.className = data.stale ? "warn" : "good";
    notice.hidden = true;
  } catch {
    readiness.textContent = "backend pending";
    readiness.className = "warn";
    notice.hidden = false;
  }
}

async function loadMetrics() {
  const grid = byId("metricGrid");
  try {
    const response = await fetch("/v1/metrics", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`metrics ${response.status}`);
    const data = await response.json();
    const metrics = Array.isArray(data) ? data : (data.metrics || data.items || []);
    if (!metrics.length) throw new Error("empty");
    grid.replaceChildren(...metrics.slice(0, 24).map((metric) => {
      const card = document.createElement("article");
      card.className = "card";
      const label = document.createElement("span");
      label.textContent = metric.label || metric.id || metric.metricId || "metric";
      const value = document.createElement("strong");
      value.textContent = `${fmt(metricValue(metric))}${metric.unit ? " " + metric.unit : ""}`;
      card.append(label, value);
      return card;
    }));
  } catch {
    grid.innerHTML = '<article class="card placeholder">No qualified metrics available yet.</article>';
  }
}

async function refresh() {
  await Promise.all([loadStatus(), loadMetrics()]);
}

byId("refresh").addEventListener("click", refresh);
refresh();
