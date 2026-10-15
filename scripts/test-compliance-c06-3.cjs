"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const model = require("../compliance/web/scenarios.js");
const root = path.resolve(__dirname, "..");
const input = () => ({jurisdiction: "vancouver", topic: "delivery", actor: "independent-courier", stage: "handover", evidence: "unavailable"});
function blocked(r) {
  assert.equal(r.legal_authorization, false);
  assert.equal(r.eligibility_assessed, false);
  assert.ok(r.unresolved.length >= 6);
  assert.ok(r.unresolved.some(x => x.includes("authenticated evaluation")));
}

test("all 1800 supported combinations keep unresolved requirements and never establish permission", () => {
  let count = 0;
  for (const jurisdiction of model.choices.jurisdiction)
    for (const topic of model.choices.topic)
      for (const actor of model.choices.actor)
        for (const stage of model.choices.stage)
          for (const evidence of model.choices.evidence) {
            const r = model.explain({jurisdiction, topic, actor, stage, evidence});
            blocked(r);
            assert.equal(r.status, "INFORMATION_ONLY");
            count++;
          }
  assert.equal(count, 1800);
});
test("self-reported and claimed authenticated evidence cannot clear requirements", () => {
  for (const evidence of ["self-reported", "claimed-authenticated"]) {
    const r = model.explain({...input(), evidence});
    blocked(r);
    assert.ok(r.unresolved.some(x => evidence === "self-reported" ? x.includes("Self-reported") : x.includes("public claim only")));
    assert.ok(r.unresolved.some(x => x.includes("licence")));
  }
});
test("carrier classes retain distinct unvalidated permissions", () => {
  const texts = ["employee", "common-carrier", "independent-courier"].map(actor =>
    model.explain({...input(), actor}).unresolved.join(" "));
  assert.ok(texts[0].includes("employment relationship"));
  assert.ok(texts[1].includes("Carrier classification"));
  assert.ok(texts[2].includes("Independent courier classification"));
});
test("pickup, handover, return and crossings cannot inherit permission", () => {
  for (const [stage, text] of [["pickup", "custody evidence"], ["handover", "prior pickup result"], ["return", "separately reviewed recovery"], ["crossing", "separate review"]]) {
    const r = model.explain({...input(), stage});
    blocked(r);
    assert.ok(r.unresolved.some(x => x.includes(text)));
  }
});
test("unknown/out-of-coverage regions expose gaps without fabricated local links", () => {
  for (const jurisdiction of ["other", "unknown"]) {
    const r = model.explain({...input(), jurisdiction});
    assert.deepEqual(r.sourcePages, []);
    assert.ok(r.unresolved.some(x => x.includes("outside the discovery catalogue")));
    blocked(r);
  }
});
test("invalid/private/authorization inputs fail closed with no reflected payload", () => {
  for (const bad of [null, [], "ALLOW", {}, {...input(), address: "PRIVATE"}, {...input(), legal_authorization: true},
    {...input(), evidence: "verified"}, {...input(), jurisdiction: '<script>PRIVATE</script>'}, {...input(), topic: "medical"}]) {
    const r = model.explain(bad);
    assert.equal(r.status, "INFORMATION_UNAVAILABLE");
    blocked(r);
    assert.ok(!JSON.stringify(r).includes("PRIVATE"));
  }
});
test("all emitted source routes exist and never contain credentials, query or fragments", () => {
  for (const jurisdiction of model.choices.jurisdiction)
    for (const topic of model.choices.topic) {
      for (const link of model.explain({...input(), jurisdiction, topic}).sourcePages) {
        assert.match(link.href, /^\.\/rule-[a-z-]+\.html$/);
        assert.ok(fs.existsSync(path.join(root, "compliance/web", link.href)));
        assert.ok(!/[?#@]/.test(link.href));
      }
    }
});
test("model output is deterministic, independent and leaves input unchanged", () => {
  const i = Object.freeze(input());
  const r = model.explain(i);
  assert.deepEqual(r, model.explain(i));
  r.unresolved.length = 0;
  blocked(model.explain(i));
  assert.equal(i.stage, "handover");
  assert.ok(Object.isFrozen(model));
});
test("product/business/travel explanations keep public coverage distinct from eligibility/supply", () => {
  for (const topic of ["product", "business", "travel"]) {
    const r = model.explain({...input(), topic});
    assert.ok(r.guidance.length >= 3);
    blocked(r);
  }
  assert.match(model.explain({...input(), topic: "travel"}).guidance.join(" "), /courier availability are separate/);
});

class Element {
  constructor(id = "") {this.id = id; this.children = []; this.textContent = ""; this.value = ""; this.dataset = {}; this.handlers = {}; this.hidden = false;}
  replaceChildren() {this.children = [];}
  appendChild(child) {this.children.push(child);}
  addEventListener(event, fn) {this.handlers[event] = fn;}
  focus() {this.focused = true;}
}
function harness(api = model) {
  const elements = {};
  for (const [key, value] of Object.entries(input())) {
    const e = new Element("scenario-" + key);
    e.value = value;
    e.dataset.default = {jurisdiction:"unknown", topic:"delivery", actor:"unknown", stage:"planning", evidence:"unavailable"}[key];
    elements[e.id] = e;
  }
  for (const id of ["result", "status", "guidance", "unresolved", "sources", "reset"]) elements["scenario-" + id] = new Element("scenario-" + id);
  const context = {ComplianceScenarios: api, document: {
    getElementById: id => elements[id],
    createElement: tag => new Element(tag)
  }};
  vm.runInNewContext(fs.readFileSync(path.join(root,"compliance/web/scenarios-ui.js"), "utf8"), context);
  return elements;
}
test("actual UI controller renders initial state and updates all five selectors", () => {
  const e = harness();
  assert.equal(e["scenario-status"].textContent, "Information only — eligibility not assessed");
  assert.ok(e["scenario-unresolved"].children.length >= 8);
  for (const [key,value] of Object.entries({jurisdiction:"other",topic:"travel",actor:"traveller",stage:"crossing",evidence:"claimed-authenticated"})) {
    e["scenario-"+key].value = value;
    e["scenario-"+key].handlers.change();
  }
  assert.equal(e["scenario-sources"].children.length, 0);
  assert.ok(e["scenario-unresolved"].children.some(x => x.textContent.includes("public claim only")));
});
test("reset restores safe defaults, renders gaps and returns keyboard focus", () => {
  const e = harness();
  e["scenario-reset"].handlers.click();
  assert.equal(e["scenario-jurisdiction"].value, "unknown");
  assert.equal(e["scenario-evidence"].value, "unavailable");
  assert.equal(e["scenario-jurisdiction"].focused, true);
  assert.equal(e["scenario-sources"].children.length, 0);
  assert.ok(e["scenario-unresolved"].children.length >= 8);
});
test("missing model/provider failure or forged positive result produces visible safe error", () => {
  for (const api of [null, {explain(){throw Error("outage");}}, {explain(){return {legal_authorization:true,eligibility_assessed:true,unresolved:[]};}}]) {
    const e = harness(api);
    assert.match(e["scenario-status"].textContent, /Information unavailable/);
    assert.ok(e["scenario-unresolved"].children.length > 0);
    assert.equal(e["scenario-sources"].children.length, 0);
    assert.equal(e["scenario-result"].hidden, false);
  }
});
test("tampered selector and unsafe links cannot inject private data or navigation", () => {
  const e = harness();
  e["scenario-jurisdiction"].value = "<img src=x onerror=PRIVATE>";
  e["scenario-jurisdiction"].handlers.change();
  assert.match(e["scenario-status"].textContent, /Information unavailable/);
  assert.ok(!JSON.stringify(e["scenario-unresolved"].children).includes("PRIVATE"));
  const unsafe = harness({explain(){return {...model.explain(input()),sourcePages:[{href:"javascript:alert(1)",label:"unsafe"}]};}});
  assert.match(unsafe["scenario-status"].textContent, /Information unavailable/);
  assert.equal(unsafe["scenario-sources"].children.length, 0);
});
test("controller uses text content and local events with no data transport or persistence", () => {
  for (const file of ["scenarios.js", "scenarios-ui.js"]) {
    const s = fs.readFileSync(path.join(root, "compliance/web", file),"utf8");
    assert.doesNotMatch(s, /innerHTML|outerHTML|insertAdjacentHTML|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|location\.|sendBeacon|eval\s*\(/);
  }
});
