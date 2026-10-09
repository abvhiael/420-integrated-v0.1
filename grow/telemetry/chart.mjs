// Reusable private chart renderer for already-authorized historical observations.
// Does not fetch data, authenticate, or expose any public Grow records.
export function renderHistorySvg(readings, { width = 640, height = 240 } = {}) {
  if (!Array.isArray(readings) || readings.length > 500 ||
      !Number.isSafeInteger(width) || width < 200 || width > 2000 ||
      !Number.isSafeInteger(height) || height < 120 || height > 1000) {
    throw new RangeError("invalid chart bounds");
  }
  if (readings.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240" role="img" aria-label="No historical sensor readings"><text x="24" y="120">No readings for this period</text></svg>';
  }
  const points = readings.map((r) => {
    const value = Number(r.Value ?? r.value);
    const stamp = new Date(r.MeasuredAt ?? r.measuredAt).getTime();
    if (!Number.isFinite(value) || !Number.isFinite(stamp)) throw new RangeError("invalid chart reading");
    return { value, stamp };
  }).sort((a, b) => a.stamp - b.stamp);
  const minV = Math.min(...points.map(x => x.value));
  const maxV = Math.max(...points.map(x => x.value));
  const minT = points[0].stamp;
  const maxT = points[points.length - 1].stamp;
  const pad = 28;
  const drawableW = width - 2 * pad;
  const drawableH = height - 2 * pad;
  const coords = points.map(({ value, stamp }) => {
    const x = pad + (maxT === minT ? drawableW / 2 : ((stamp - minT) / (maxT - minT)) * drawableW);
    const y = pad + (maxV === minV ? drawableH / 2 : (1 - (value - minV) / (maxV - minV)) * drawableH);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical sensor readings"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/><text x="16" y="${height - 7}" font-size="12">UTC • ${points.length} readings</text></svg>`;
}
