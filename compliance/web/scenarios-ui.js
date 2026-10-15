/* Local-only public controls: no credentials, storage, network or URL inputs. */
(function () {
  "use strict";
  const keys = ["jurisdiction", "topic", "actor", "stage", "evidence"];
  const fields = keys.map(key => document.getElementById("scenario-" + key));
  const output = document.getElementById("scenario-result");
  const status = document.getElementById("scenario-status");
  const guidance = document.getElementById("scenario-guidance");
  const unresolved = document.getElementById("scenario-unresolved");
  const sources = document.getElementById("scenario-sources");
  const reset = document.getElementById("scenario-reset");
  if (!output || !status || !guidance || !unresolved || !sources || !reset || fields.some(x => !x)) return;
  function list(element, items) {
    element.replaceChildren();
    for (const text of items) {
      const li = document.createElement("li");
      li.textContent = text;
      element.appendChild(li);
    }
  }
  function fail() {
    fields.forEach(field => { field.disabled = true; });
    reset.disabled = true;
    status.textContent = "Information unavailable — eligibility not assessed";
    list(guidance, ["The scenario could not be explained. No permission or eligibility is established."]);
    list(unresolved, ["Current source review, legal applicability, credentials and stage-specific authenticated evaluation remain unresolved."]);
    sources.replaceChildren();
    output.hidden = false;
  }
  function update() {
    try {
      const model = globalThis.ComplianceScenarios;
      if (!model || typeof model.explain !== "function") throw new Error("unavailable");
      const input = Object.fromEntries(keys.map((key, i) => [key, fields[i].value]));
      const result = model.explain(input);
      if (result.legal_authorization !== false || result.eligibility_assessed !== false ||
          !Array.isArray(result.unresolved) || result.unresolved.length < 1) throw new Error("invalid");
      status.textContent = result.status === "INFORMATION_ONLY" ?
        "Information only — eligibility not assessed" : "Information unavailable — eligibility not assessed";
      list(guidance, result.guidance);
      list(unresolved, result.unresolved);
      sources.replaceChildren();
      for (const source of result.sourcePages) {
        if (!/^\.\/rule-(federal-product|bc-travel|bc-delivery|vancouver-business)\.html$/.test(source.href)) throw new Error("unsafe");
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = source.href;
        a.textContent = source.label;
        li.appendChild(a);
        sources.appendChild(li);
      }
      output.hidden = false;
      fields.forEach(field => { field.disabled = false; });
      reset.disabled = false;
    } catch {
      fail();
    }
  }
  fields.forEach(field => field.addEventListener("change", update));
  reset.addEventListener("click", function () {
    fields.forEach(field => { field.value = field.dataset.default; });
    update();
    fields[0].focus();
  });
  update();
})();
