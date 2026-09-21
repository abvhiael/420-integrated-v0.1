// Cloudflare Pages Functions: only the two explicitly registered public GET routes
// import this helper. TRAVEL_PUBLIC_ORIGIN is a server-side deployment setting.
const PATHS = new Set(['/travel/api/v1/places', '/travel/api/v1/events']);
const STATES = new Set(['ready', 'empty', 'invalid', 'unavailable', 'disconnected']);
const json = (status, state) => new Response(JSON.stringify({state}), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const clean = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
function validRecord(item, isEvent) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (!clean(item.id,128) || !/^[a-zA-Z0-9_-]+$/.test(item.id)) return false;
  if (isEvent) {
    return clean(item.title,500) && clean(item.starts_at,64) && !Number.isNaN(Date.parse(item.starts_at)) &&
      ['place_id','place_name','city','region'].every(k => item[k] === undefined || clean(item[k],500));
  }
  return clean(item.name,500) && ['category','city','region','country'].every(k => clean(item[k],500)) && typeof item.approximate === 'boolean';
}
export async function publicTravelRead(context, path) {
  const request = context.request;
  if (request.method !== 'GET') return json(405,'method_not_allowed');
  if (!PATHS.has(path) || new URL(request.url).pathname !== path) return json(404,'not_found');
  const source = new URL(request.url);
  for (const name of source.searchParams.keys()) if (!['destination', ...(path.endsWith('/events') ? ['date'] : [])].includes(name)) return json(400,'invalid');
  const destination = source.searchParams.get('destination') || '';
  const date = source.searchParams.get('date');
  if (!clean(destination,80) || (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return json(400,'invalid');
  const raw = context.env.TRAVEL_PUBLIC_ORIGIN;
  if (!raw) return json(503,'disconnected');
  let origin;
  try {
    origin = new URL(raw);
    if (origin.protocol !== 'https:' || !origin.hostname || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || origin.port && origin.port !== '443') throw Error('invalid origin');
    if (origin.hostname === source.hostname) throw Error('proxy recursion');
  } catch { return json(503,'disconnected'); }
  const target = new URL(path,origin);
  target.search = source.search;
  try {
    const response = await fetch(target.toString(), {method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(4500),cf:{cacheTtl:0,cacheEverything:false}});
    if (response.status !== 200 && response.status !== 400 && response.status !== 502 && response.status !== 503) return json(502,'unavailable');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') || '')) return json(502,'unavailable');
    if (Number(response.headers.get('Content-Length')) > 131072) return json(502,'unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 131072) return json(502,'unavailable');
    const data = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if (!data || typeof data !== 'object' || !STATES.has(data.state)) return json(502,'unavailable');
    if (response.status !== 200) return json(response.status === 400 ? 400 : 503,response.status === 400 ? 'invalid' : 'unavailable');
    const field = path.endsWith('/events') ? 'events' : 'places';
    const other = field === 'events' ? 'places' : 'events';
    if (data[other] !== undefined || (data.state !== 'ready' && data.state !== 'empty') || (data.state === 'ready' && (!Array.isArray(data[field]) || data[field].length === 0)) || (data.state === 'empty' && data[field] !== undefined && (!Array.isArray(data[field]) || data[field].length))) return json(502,'unavailable');
    if (data[field] !== undefined && (!Array.isArray(data[field]) || data[field].length > 100 || !data[field].every(item => validRecord(item,field === 'events')))) return json(502,'unavailable');
    // Only copy approved public fields; no upstream response headers, cookies or additional attributes.
    const safe = (data[field] || []).map(item => field === 'events' ? ({id:item.id,title:item.title,starts_at:item.starts_at,place_id:item.place_id || '',place_name:item.place_name || '',city:item.city || '',region:item.region || ''}) : ({id:item.id,name:item.name,category:item.category,city:item.city,region:item.region,country:item.country,approximate:item.approximate}));
    return new Response(JSON.stringify({state:data.state,[field]:safe}),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  } catch { return json(503,'unavailable'); }
}
