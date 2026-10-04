"use strict";

const $ = (id) => document.getElementById(id);
const warning = "verification only means published source/build inputs correspond to deployed code; it does not mean audited, safe, official, immutable, authorized, or non-malicious";

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.panel).classList.add("active");
  });
});

function setStatus(id, text, kind = "") {
  const node = $(id);
  node.className = "status" + (kind ? " " + kind : "");
  node.textContent = text;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = {error: text || "invalid JSON response"}; }
  if (!response.ok) throw new Error(body.error || "request failed with HTTP " + response.status);
  return body;
}

function diagnosticList(record) {
  const items = record?.classification?.diagnostics || [];
  if (!items.length) return "<p class=\"muted\">no diagnostics recorded.</p>";
  return "<ul class=\"diagnostics\">" + items.map((item) =>
    "<li><strong>" + escapeHTML(item.reason) + "</strong> — " + escapeHTML(item.message) + "</li>"
  ).join("") + "</ul>";
}

function renderRecord(target, payload) {
  const record = payload.record || payload;
  const integration = payload.integration || {};
  const deployment = record.deployment || {};
  const submitted = record.submission || {};
  const build = record.build || {};
  const classification = record.classification || {};
  const settings = submitted.build || {};
  const explorer = integration.explorerAddressPath
    ? '<a href="' + escapeHTML(integration.explorerAddressPath) + '">open in 420Explorer</a>'
    : '<span class="muted">Explorer link unavailable</span>';
  const sources = submitted.sources?.length
    ? "<pre>" + escapeHTML(submitted.sources.map((s) => "// " + s.path + "\n" + s.content).join("\n\n")) + "</pre>"
    : submitted.flattened
      ? "<pre>" + escapeHTML(submitted.flattened) + "</pre>"
      : submitted.standardJson
        ? "<pre>" + escapeHTML(JSON.stringify(submitted.standardJson, null, 2)) + "</pre>"
        : '<p class="muted">source payload not published in this record.</p>';

  target.innerHTML =
    '<article class="result-card">' +
      '<div class="result-head"><div><strong>verification evidence</strong><div class="muted">' + escapeHTML(record.recordHash) + '</div></div>' +
      '<span class="badge ' + escapeHTML(classification.class) + '">' + escapeHTML(classification.class || "UNVERIFIABLE") + '</span></div>' +
      '<dl class="kv">' +
        '<dt>chain ID</dt><dd>' + escapeHTML(deployment.chainId) + '</dd>' +
        '<dt>address</dt><dd>' + escapeHTML(deployment.address) + '</dd>' +
        '<dt>runtime code hash</dt><dd>' + escapeHTML(deployment.runtimeCodeHash) + '</dd>' +
        '<dt>binding</dt><dd>' + escapeHTML(record.bindingKey) + '</dd>' +
        '<dt>compiler</dt><dd>' + escapeHTML(build.compilerVersion || settings.compilerVersion) + '</dd>' +
        '<dt>optimizer</dt><dd>' + escapeHTML(settings.optimizerEnabled) + ' · runs ' + escapeHTML(settings.optimizerRuns) + '</dd>' +
        '<dt>EVM / viaIR</dt><dd>' + escapeHTML(settings.evmVersion) + ' / ' + escapeHTML(settings.viaIR) + '</dd>' +
        '<dt>metadata mode</dt><dd>' + escapeHTML(settings.metadataHashMode) + '</dd>' +
        '<dt>constructor args</dt><dd>' + escapeHTML(settings.constructorArgsKnown ? (settings.constructorArguments || "0x") : "unknown") + '</dd>' +
        '<dt>libraries</dt><dd>' + escapeHTML(JSON.stringify(settings.libraries || [])) + '</dd>' +
        '<dt>compiler input hash</dt><dd>' + escapeHTML(build.inputSha256) + '</dd>' +
        '<dt>compiler output hash</dt><dd>' + escapeHTML(build.outputSha256) + '</dd>' +
        '<dt>creation compared</dt><dd>' + escapeHTML(classification.creationCompared) + '</dd>' +
        '<dt>Explorer</dt><dd>' + explorer + '</dd>' +
      '</dl>' +
      '<h3>diagnostics</h3>' + diagnosticList(record) +
      '<h3>published source/build input</h3>' + sources +
      '<details><summary>raw reproducibility evidence</summary><pre>' + escapeHTML(JSON.stringify(payload, null, 2)) + '</pre></details>' +
      '<p class="warning"><strong>verification is not an audit.</strong> ' + escapeHTML(integration.warning || warning) + '</p>' +
    '</article>';
}

function lookupPath(history = false) {
  const chain = encodeURIComponent($("lookup-chain").value.trim());
  const address = encodeURIComponent($("lookup-address").value.trim());
  const hash = encodeURIComponent($("lookup-hash").value.trim());
  return "/v1/verify/" + chain + "/" + address + "/" + hash + (history ? "/history" : "");
}

$("lookup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("lookup-status", "loading verification evidence…");
  $("lookup-result").innerHTML = "";
  try {
    const payload = await requestJSON(lookupPath(false));
    renderRecord($("lookup-result"), payload);
    setStatus("lookup-status", "latest evidence loaded.", "ok");
  } catch (error) {
    setStatus("lookup-status", error.message, "error");
  }
});

$("history-button").addEventListener("click", async () => {
  setStatus("lookup-status", "loading append-only history…");
  $("lookup-result").innerHTML = "";
  try {
    const payload = await requestJSON(lookupPath(true));
    const records = payload.records || [];
    $("lookup-result").innerHTML = '<article class="result-card"><div class="result-head"><strong>verification history</strong><span class="badge">' + records.length + ' records</span></div><div id="history-records"></div></article>';
    const holder = $("history-records");
    records.slice().reverse().forEach((record) => {
      const item = document.createElement("div");
      item.className = "history-item";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = "#" + record.sequence + " · " + (record.classification?.class || "UNVERIFIABLE") + " · " + record.recordHash;
      button.addEventListener("click", () => renderRecord($("lookup-result"), {record, integration:{warning}}));
      item.appendChild(button);
      holder.appendChild(item);
    });
    setStatus("lookup-status", "history loaded.", "ok");
  } catch (error) {
    setStatus("lookup-status", error.message, "error");
  }
});

function buildSubmission() {
  const kind = $("submit-kind").value;
  const sourceRaw = $("source-input").value;
  const build = {
    compilerVersion: $("compiler-version").value.trim(),
    optimizerEnabled: $("optimizer-enabled").value === "true",
    optimizerRuns: Number($("optimizer-runs").value),
    evmVersion: $("evm-version").value.trim(),
    viaIR: $("via-ir").value === "true",
    metadataHashMode: $("metadata-mode").value.trim(),
    libraries: $("libraries-input").value.trim() ? JSON.parse($("libraries-input").value) : [],
    constructorArguments: $("constructor-known").value === "true" ? ($("constructor-args").value.trim() || "0x") : "",
    constructorArgsKnown: $("constructor-known").value === "true"
  };
  const submission = {
    kind,
    targetSource: $("target-source").value.trim(),
    targetContract: $("target-contract").value.trim(),
    build
  };
  if (!submission.targetSource) delete submission.targetSource;
  if (!submission.targetContract) delete submission.targetContract;

  if (kind === "STANDARD_JSON") {
    submission.standardJson = JSON.parse(sourceRaw);
  } else if (kind === "MULTI_FILE") {
    const files = JSON.parse(sourceRaw);
    submission.sources = Object.entries(files).map(([path, content]) => ({path, content}));
  } else {
    submission.flattened = sourceRaw;
    submission.sources = [{path: "Flattened.sol", content: sourceRaw}];
  }

  // The server derives the deterministic source commitment when it is omitted,
  // then validates it before compilation and records the computed value.
  return submission;
}

$("submission-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("submit-status", "submitting source/build evidence…");
  $("submit-result").innerHTML = "";
  try {
    const submission = buildSubmission();
    const payload = await requestJSON("/v1/verify/submissions", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        chainId: Number($("submit-chain").value),
        address: $("submit-address").value.trim(),
        submission
      })
    });
    renderRecord($("submit-result"), payload);
    setStatus("submit-status", "verification completed and evidence recorded.", "ok");
  } catch (error) {
    setStatus("submit-status", error.message, "error");
  }
});

$("evidence-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("evidence-status", "loading immutable evidence record…");
  $("evidence-result").innerHTML = "";
  try {
    const hash = encodeURIComponent($("record-hash").value.trim());
    const payload = await requestJSON("/v1/verify/evidence/" + hash);
    renderRecord($("evidence-result"), payload);
    setStatus("evidence-status", "evidence loaded.", "ok");
  } catch (error) {
    setStatus("evidence-status", error.message, "error");
  }
});
