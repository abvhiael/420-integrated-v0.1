import { readFile } from 'node:fs/promises';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SCHEMA_VERSION = '1.0.0';

export class IntegrationGuideError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'IntegrationGuideError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new IntegrationGuideError420(message);
}

function object420(value, path) {
  assert420(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value;
}

function string420(value, path) {
  assert420(typeof value === 'string' && value.trim().length > 0, `${path} must be a non-empty string`);
  return value.trim();
}

function normalizeStep420(stepInput, path) {
  const step = object420(stepInput, path);
  const allowed = new Set(['id', 'component', 'authority', 'canonical', 'action']);
  for (const key of Object.keys(step)) assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);
  const id = string420(step.id, `${path}.id`);
  assert420(ID_RE.test(id), `${path}.id is invalid`);
  assert420(typeof step.canonical === 'boolean', `${path}.canonical must be boolean`);
  return Object.freeze({
    id,
    component: string420(step.component, `${path}.component`),
    authority: string420(step.authority, `${path}.authority`),
    canonical: step.canonical,
    action: string420(step.action, `${path}.action`)
  });
}

function normalizeGuide420(guideInput, index) {
  const path = `guides[${index}]`;
  const guide = object420(guideInput, path);
  const allowed = new Set(['id', 'title', 'summary', 'document', 'steps']);
  for (const key of Object.keys(guide)) assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);
  const id = string420(guide.id, `${path}.id`);
  assert420(ID_RE.test(id), `${path}.id is invalid`);
  assert420(typeof guide.document === 'string' && guide.document.startsWith('docs/') && !guide.document.includes('..'), `${path}.document must be a safe docs path`);
  assert420(Array.isArray(guide.steps) && guide.steps.length >= 2, `${path}.steps must contain at least two steps`);
  const steps = guide.steps.map((step, stepIndex) => normalizeStep420(step, `${path}.steps[${stepIndex}]`));
  const stepIds = new Set();
  for (const step of steps) {
    assert420(!stepIds.has(step.id), `${path} contains duplicate step id: ${step.id}`);
    stepIds.add(step.id);
  }
  assert420(steps.some((step) => step.canonical), `${path} must include at least one canonical authority step`);
  return Object.freeze({
    id,
    title: string420(guide.title, `${path}.title`),
    summary: string420(guide.summary, `${path}.summary`),
    document: guide.document,
    steps: Object.freeze(steps)
  });
}

export function validateIntegrationGuideRegistry420(input) {
  const registry = object420(input, 'guide registry');
  const allowed = new Set(['schemaVersion', 'guides']);
  for (const key of Object.keys(registry)) assert420(allowed.has(key), `guide registry contains unsupported field: ${key}`);
  assert420(registry.schemaVersion === SCHEMA_VERSION, 'unsupported integration guide registry schemaVersion');
  assert420(Array.isArray(registry.guides) && registry.guides.length > 0, 'guide registry must contain guides');
  const guides = registry.guides.map(normalizeGuide420);
  const ids = new Set();
  for (const guide of guides) {
    assert420(!ids.has(guide.id), `duplicate integration guide id: ${guide.id}`);
    ids.add(guide.id);
  }
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, guides: Object.freeze(guides) });
}

export async function loadIntegrationGuideRegistry420(path) {
  let raw;
  try { raw = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw new IntegrationGuideError420(`cannot read integration guide registry: ${error.message}`); }
  return validateIntegrationGuideRegistry420(raw);
}

export function listIntegrationGuides420(registryInput) {
  const registry = validateIntegrationGuideRegistry420(registryInput);
  return Object.freeze(registry.guides.map((guide) => Object.freeze({ id: guide.id, title: guide.title, summary: guide.summary, document: guide.document })));
}

export function getIntegrationGuide420(registryInput, idInput) {
  const registry = validateIntegrationGuideRegistry420(registryInput);
  const id = string420(idInput, 'guide id');
  assert420(ID_RE.test(id), 'guide id is invalid');
  const guide = registry.guides.find((item) => item.id === id);
  assert420(Boolean(guide), `unknown integration guide: ${id}`);
  return guide;
}

export function createIntegrationGuideView420(guideInput) {
  const guide = normalizeGuide420(guideInput, 0);
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    id: guide.id,
    title: guide.title,
    summary: guide.summary,
    document: guide.document,
    authorityBoundaryPreserved: true,
    canonicalSteps: Object.freeze(guide.steps.filter((step) => step.canonical).map((step) => step.id)),
    projectionSteps: Object.freeze(guide.steps.filter((step) => !step.canonical).map((step) => step.id)),
    steps: guide.steps
  });
}
