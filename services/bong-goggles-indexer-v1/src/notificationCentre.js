import { validateBongGogglesNotificationCandidate } from './notificationCatalog.js';

export const BONG_GOGGLES_CANONICALITY_STATES = Object.freeze([
  'pending',
  'finalized',
  'retracted',
  'superseded',
]);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function normalizeCanonicality(value = 'pending') {
  const state = String(value).trim().toLowerCase();
  if (!BONG_GOGGLES_CANONICALITY_STATES.includes(state)) throw new Error(`invalid canonicality state: ${state}`);
  return state;
}

function normalizeCreatedAt(value) {
  const date = value instanceof Date ? value : new Date(required(value, 'createdAt'));
  if (Number.isNaN(date.getTime())) throw new Error('invalid createdAt');
  return date.toISOString();
}

function encode(value) {
  return encodeURIComponent(String(value));
}

export function bongGogglesCanonicalSubjectLink(candidate, baseUrl = 'https://bonggoggles.420integrated.org') {
  const validated = validateBongGogglesNotificationCandidate(candidate);
  const base = String(baseUrl).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('canonical Bong Goggles base URL must use https');
  const subject = validated.subjectId ? `&subjectId=${encode(validated.subjectId)}` : '';
  return `${base}/notifications/resolve?kind=${encode(validated.kind)}&notificationId=${encode(validated.notificationId)}${subject}`;
}

export function notificationCentreItem(candidate, {
  read = false,
  canonicality = 'pending',
  createdAt,
  title = '',
  body = '',
  baseUrl,
} = {}) {
  const validated = validateBongGogglesNotificationCandidate(candidate);
  return Object.freeze({
    notificationId: validated.notificationId,
    recipient: validated.recipient,
    actor: validated.actor,
    kind: validated.kind,
    topic: validated.topic,
    subjectId: validated.subjectId,
    title: String(title),
    body: String(body),
    read: read === true,
    canonicality: normalizeCanonicality(canonicality),
    createdAt: normalizeCreatedAt(createdAt),
    deepLink: bongGogglesCanonicalSubjectLink(validated, baseUrl),
    provenance: Object.freeze({ ...validated.provenance }),
    authoritative: false,
  });
}

function cursor(item) {
  return `${item.createdAt}|${item.notificationId}`;
}

export function notificationCentrePage(items, { after = '', limit = 50 } = {}) {
  if (!Array.isArray(items)) throw new Error('notification centre items must be an array');
  const normalizedLimit = Number(limit);
  if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0 || normalizedLimit > 100) throw new Error('notification centre page limit must be 1..100');

  const ordered = [...items].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    if (byTime !== 0) return byTime;
    return a.notificationId.localeCompare(b.notificationId);
  });

  let start = 0;
  if (after) {
    const index = ordered.findIndex((item) => cursor(item) === after);
    if (index < 0) throw new Error('notification centre cursor not found');
    start = index + 1;
  }

  const pageItems = ordered.slice(start, start + normalizedLimit);
  const hasMore = start + pageItems.length < ordered.length;
  return Object.freeze({
    items: Object.freeze(pageItems),
    unreadCount: items.reduce((count, item) => count + (item.read === true ? 0 : 1), 0),
    nextCursor: hasMore && pageItems.length ? cursor(pageItems[pageItems.length - 1]) : '',
    authoritative: false,
  });
}

export function notificationCentreFallbacks({
  appUrl = 'https://bonggoggles.420integrated.org',
  walletUrl = 'wallet420://home',
  explorerUrl = 'https://explorer.420integrated.org',
} = {}) {
  const app = String(appUrl).trim();
  const wallet = String(walletUrl).trim();
  const explorer = String(explorerUrl).trim();
  if (!/^https:\/\//i.test(app)) throw new Error('canonical app fallback must use https');
  if (!/^wallet420:\/\//i.test(wallet)) throw new Error('wallet fallback must use wallet420 scheme');
  if (!/^https:\/\//i.test(explorer)) throw new Error('explorer fallback must use https');
  return Object.freeze({
    degraded: true,
    message: 'Notifications may be delayed. Check canonical Bong Goggles, Wallet or Explorer state directly.',
    app,
    wallet,
    explorer,
    authoritative: false,
  });
}
