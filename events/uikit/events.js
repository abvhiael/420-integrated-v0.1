// Presentation-only 420Events UI. Supply a trusted events/uikit.Build view from
// the Events service; never send private records directly to this client.
export function mountEvents(root, view, { onSelect = () => {}, onPlace = () => {} } = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('root element required');
  if (!view || !Array.isArray(view.items) || view.items.length > 100) throw new TypeError('invalid event view');
  if (typeof onSelect !== 'function' || typeof onPlace !== 'function') throw new TypeError('invalid event callbacks');
  const items = view.items.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.eventId !== 'string' || !item.eventId || typeof item.title !== 'string' || !item.title) throw new TypeError('invalid event card');
    const start = new Date(item.startAt), end = new Date(item.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new TypeError('invalid event times');
    if (typeof item.timezone !== 'string' || !item.timezone) throw new TypeError('event timezone required');
    return { ...item, tags: Array.isArray(item.tags) ? [...item.tags] : [], start, end };
  });
  root.replaceChildren();
  const section = document.createElement('section'); section.className = 'events-ui-kit'; section.setAttribute('aria-label', 'Public events');
  const heading = document.createElement('h2'); heading.textContent = 'Explore events'; section.append(heading);
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const list = document.createElement('ul'); list.className = 'events-ui-list'; list.setAttribute('aria-label', 'Event dates');
  const buttons = new Map(); let selected = null;
  function choose(id) {
    const card = items.find(item => item.id === id);
    if (!card) return;
    selected = card.id;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', key === id ? 'true' : 'false');
    status.textContent = `Selected ${card.title}`;
    onSelect({ eventId: card.eventId, occurrenceId: card.id, startAt: card.start.toISOString(), version: card.version });
  }
  for (const card of items) {
    const row = document.createElement('li'); const article = document.createElement('article'); article.className = 'events-ui-card';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = card.title; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => choose(card.id)); buttons.set(card.id, button);
    const date = document.createElement('time'); date.dateTime = card.start.toISOString();
    try { date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: card.timezone }).format(card.start); }
    catch { date.textContent = card.start.toISOString(); }
    article.append(button, date);
    if (card.placeId) {
      const place = document.createElement('button'); place.type = 'button'; place.textContent = 'View event place';
      place.addEventListener('click', () => onPlace({ eventId: card.eventId, placeId: card.placeId })); article.append(place);
    }
    if (card.tags.length) { const tags = document.createElement('p'); tags.textContent = card.tags.filter(tag => typeof tag === 'string').join(' · '); article.append(tags); }
    row.append(article); list.append(row);
  }
  if (!items.length) status.textContent = 'No public events to display.';
  section.append(status, list); root.append(section);
  return { select: choose, getSelected: () => selected, destroy: () => root.replaceChildren() };
}
