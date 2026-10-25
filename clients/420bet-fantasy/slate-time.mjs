// Exact pre-entry UTC cutoff using the runtime's IANA America/New_York database.
// Return exclusive midnight after the day following the last original game.
const zone = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(milliseconds) {
  return Object.fromEntries(zone.formatToParts(new Date(milliseconds))
    .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

export function cutoffForSlate(originalStarts) {
  if (!Array.isArray(originalStarts) || !originalStarts.length || originalStarts.length > 32 ||
      originalStarts.some(t => !Number.isSafeInteger(t) || t <= 0)) throw new Error('invalid original schedule');
  const last = Math.max(...originalStarts);
  if (last - Math.min(...originalStarts) > 86400) throw new Error('daily slate exceeds 24 hours');
  const p = parts(last * 1000);
  const target = Date.UTC(p.year, p.month - 1, p.day + 2, 0, 0, 0);
  let instant = target;
  // New York clock changes happen at 02:00; this midnight is unambiguous.
  for (let i = 0; i < 5; i++) {
    const q = parts(instant);
    const local = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second);
    if (local === target) {
      const cutoff = instant / 1000;
      if (cutoff - last < 23 * 3600 || cutoff - last > 49 * 3600) throw new Error('invalid cutoff');
      return {cutoff, exclusiveUTC: new Date(instant).toISOString(), timeZone: 'America/New_York',
        icuVersion: process.versions.icu};
    }
    instant += target - local;
  }
  throw new Error('cannot establish exact IANA cutoff');
}
