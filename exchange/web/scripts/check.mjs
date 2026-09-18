import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html',
  'app.js',
  'styles.css',
  'package.json',
  'runtime-config.json',
  'runtime-config.example.json',
  'core/config.js',
  'core/router.js',
  'core/design-system.js',
  'core/exchange-client.js',
  'core/exchange-store.js',
  'core/exchange-stream.js',
  'core/exchange-cache.js',
  'core/exchange-data.js',
  'test/config.test.js',
  'test/router.test.js',
  'test/design-system.test.js',
  'test/exchange-client.test.js',
  'test/exchange-store.test.js',
  'test/exchange-stream.test.js',
  'test/exchange-cache.test.js',
  'test/exchange-data.test.js',
  'v14.1-qualification.json',
  'v14.2-qualification.json',
  'v14.3-qualification.json',
  'v14.4-qualification.json',
  'v14.5-qualification.json',
  'v14.6-qualification.json',
  'v14.7-qualification.json',
  'v14.8-qualification.json',
  'v14.9-qualification.json',
  'v14.10-qualification.json',
  'v14.11-qualification.json',
  'v14.12-qualification.json',
  'core/security.js',
  'test/security.test.js',
  'security-headers.json',
  'core/reliability.js',
  'test/reliability.test.js',
  'core/wallet-session.js',
  'test/wallet-session.test.js',
  'core/portfolio.js',
  'test/portfolio.test.js',
  'fixtures/portfolio-balances.json',
  'fixtures/portfolio-activity.json',
  'core/bridge.js',
  'test/bridge.test.js',
  'fixtures/bridge-routes.json',
  'fixtures/bridge-settlements.json',
  'core/limit-orders.js',
  'test/limit-orders.test.js',
  'fixtures/limit-orders.json',
  'core/swap.js',
  'test/swap.test.js',
  'fixtures/swap-quote.json',
  'core/market-detail.js',
  'test/market-detail.test.js',
  'fixtures/market-detail.json',
  'core/markets.js',
  'test/markets.test.js',
  'fixtures/markets.json',
];

for (const relative of required) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`missing required Exchange web file: ${relative}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.name !== '@420integrated/exchange-web') throw new Error('unexpected Exchange package name');

const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
if (config.site?.productionOrigin !== 'https://exchange.420integrated.org') throw new Error('production origin drift');
if (config.api?.schemaMajor !== 14 || config.api?.schemaMinor !== 0) throw new Error('V14 client schema drift');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const needle of ['420Exchange', 'app-view', 'app.js', 'market-search', 'market-sort', 'market-rows', 'exchange-table']) {
  if (!html.includes(needle)) throw new Error(`application shell missing marker: ${needle}`);
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
if (!app.includes("fetch('./runtime-config.json'")) throw new Error('application does not load runtime-config.json');
if (!app.includes('validateRuntimeConfig')) throw new Error('application does not validate runtime configuration');
if (!app.includes('createStatusBadge')) throw new Error('application does not consume shared V14.2 semantic status components');
for (const needle of ['normalizeMarket', 'filterMarkets', 'sortMarkets', 'freshnessState', 'Watchlist']) {
  if (!app.includes(needle)) throw new Error(`application does not consume V14.4 market operation: ${needle}`);
}

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
for (const needle of ['--positive:', '--warning:', '--info:', '--danger:', ':focus-visible', '.exchange-status', '.exchange-table']) {
  if (!styles.includes(needle)) throw new Error(`design system missing token or primitive: ${needle}`);
}

const client = fs.readFileSync(path.join(root, 'core/exchange-client.js'), 'utf8');
for (const needle of ['UNSUPPORTED_VERSION', 'PAGE_LIMIT_EXCEEDED', 'x-420-client-schema', 'validateStreamEvent']) {
  if (!client.includes(needle)) throw new Error(`V14.3 client missing contract marker: ${needle}`);
}

const dataLayer = fs.readFileSync(path.join(root, 'core/exchange-data.js'), 'utf8');
for (const needle of ['loadSnapshot', 'loadHistory', 'connectStream', 'freshness']) {
  if (!dataLayer.includes(needle)) throw new Error(`V14.3 data layer missing operation: ${needle}`);
}

const markets = fs.readFileSync(path.join(root, 'core/markets.js'), 'utf8');
for (const needle of ['normalizeMarket', 'filterMarkets', 'sortMarkets', 'freshnessState', 'Watchlist']) {
  if (!markets.includes(needle)) throw new Error(`V14.4 market model missing operation: ${needle}`);
}
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/markets.json'), 'utf8'));
if (!Array.isArray(fixture) || !fixture.length || fixture.some((market) => market.demo !== true)) {
  throw new Error('V14.4 demo fixtures must be explicitly labeled demo');
}
const detail = fs.readFileSync(path.join(root, 'core/market-detail.js'), 'utf8');
for (const needle of ['normalizeCandle', 'normalizeTrade', 'candleGeometry', 'aggregateTradesToCandles', 'reconcileHistory']) {
  if (!detail.includes(needle)) throw new Error(`V14.5 detail model missing operation: ${needle}`);
}
const detailFixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/market-detail.json'), 'utf8'));
if (detailFixture.demo !== true) throw new Error('V14.5 detail fixture must be explicitly labeled demo');
const swap = fs.readFileSync(path.join(root, 'core/swap.js'), 'utf8');
for (const needle of ['normalizeRouteQuote', 'buildSwapIntent', 'canSubmitSwap', 'SwapLifecycle']) {
  if (!swap.includes(needle)) throw new Error(`V14.6 swap model missing operation: ${needle}`);
}
const swapFixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/swap-quote.json'), 'utf8'));
if (swapFixture.demo !== true) throw new Error('V14.6 quote fixture must be explicitly labeled demo');
const orders = fs.readFileSync(path.join(root, 'core/limit-orders.js'), 'utf8');
for (const needle of ['buildLimitOrderDraft', 'minimumBuyForFill', 'normalizeOrderRecord', 'canCancelOrder']) {
  if (!orders.includes(needle)) throw new Error(`V14.7 order model missing operation: ${needle}`);
}
const orderFixtures = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/limit-orders.json'), 'utf8'));
if (!Array.isArray(orderFixtures) || !orderFixtures.length || orderFixtures.some((order)=>order.demo !== true)) {
  throw new Error('V14.7 order fixtures must be explicitly labeled demo');
}
const bridge = fs.readFileSync(path.join(root, 'core/bridge.js'), 'utf8');
for (const needle of ['normalizeBridgeRoute', 'bridgeQualification', 'buildBridgeIntent', 'normalizeSettlement', 'settlementProgress', 'canSubmitBridge']) {
  if (!bridge.includes(needle)) throw new Error(`V14.8 bridge model missing operation: ${needle}`);
}
const bridgeRoutes = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/bridge-routes.json'), 'utf8'));
const bridgeSettlements = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/bridge-settlements.json'), 'utf8'));
if (!Array.isArray(bridgeRoutes) || !bridgeRoutes.length || bridgeRoutes.some((route)=>route.demo !== true)) throw new Error('V14.8 route fixtures must be explicitly labeled demo');
if (!Array.isArray(bridgeSettlements) || !bridgeSettlements.length || bridgeSettlements.some((record)=>record.demo !== true)) throw new Error('V14.8 settlement fixtures must be explicitly labeled demo');
const portfolio = fs.readFileSync(path.join(root, 'core/portfolio.js'), 'utf8');
for (const needle of ['normalizeBalance', 'normalizeActivity', 'mergeActivity', 'activityState', 'explorerHref', 'portfolioSummary']) {
  if (!portfolio.includes(needle)) throw new Error(`V14.9 portfolio model missing operation: ${needle}`);
}
const portfolioBalances = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/portfolio-balances.json'), 'utf8'));
const portfolioActivity = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/portfolio-activity.json'), 'utf8'));
if (!Array.isArray(portfolioBalances) || !portfolioBalances.length || portfolioBalances.some((row)=>row.demo !== true)) throw new Error('V14.9 balance fixtures must be explicitly labeled demo');
if (!Array.isArray(portfolioActivity) || !portfolioActivity.length || portfolioActivity.some((row)=>row.demo !== true)) throw new Error('V14.9 activity fixtures must be explicitly labeled demo');
const walletSession = fs.readFileSync(path.join(root, 'core/wallet-session.js'), 'utf8');
for (const needle of ['WalletSession', 'WalletController', 'validateNetwork', 'signingGate', 'buildSigningRequest']) {
  if (!walletSession.includes(needle)) throw new Error(`V14.10 wallet model missing operation: ${needle}`);
}
const reliability = fs.readFileSync(path.join(root, 'core/reliability.js'), 'utf8');
for (const needle of ['classifyApiFailure', 'loadingCopy', 'responsiveTableLabel', 'focusAfterRender', 'onlineState']) {
  if (!reliability.includes(needle)) throw new Error(`V14.11 reliability model missing operation: ${needle}`);
}
const security = fs.readFileSync(path.join(root, 'core/security.js'), 'utf8');
for (const needle of ['sanitizeSubjectId', 'sanitizePathname', 'freezeReviewedIntent', 'reviewedIntentDigest', 'assertReviewedIntentUnchanged']) {
  if (!security.includes(needle)) throw new Error(`V14.12 security model missing operation: ${needle}`);
}
const headers = JSON.parse(fs.readFileSync(path.join(root, 'security-headers.json'), 'utf8'));
for (const required of ['Content-Security-Policy','Referrer-Policy','Permissions-Policy','X-Content-Type-Options','X-Frame-Options']) {
  if (!headers[required]) throw new Error(`V14.12 security header missing: ${required}`);
}
const sourceFiles = fs.readdirSync(root, { recursive:true, withFileTypes:true })
  .filter((entry)=>{
    if (!entry.isFile() || !/\.(js|mjs|json|html|css)$/.test(entry.name)) return false;
    const parent = entry.parentPath ?? entry.path;
    const full = path.join(parent, entry.name);
    const relative = path.relative(root, full).replaceAll('\\\\','/');
    if (relative === 'scripts/check.mjs') return false;
    if (relative.startsWith('test/')) return false;
    if (/^v14\.\d+-qualification\.json$/.test(relative)) return false;
    return true;
  });
const sourceScan = sourceFiles
  .map((entry)=>fs.readFileSync(path.join(entry.parentPath ?? entry.path, entry.name),'utf8'))
  .join('\n');
const secretPattern = new RegExp([
  'BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY',
  'mnemonic\\\\s*[:=]\\\\s*["\\\'][^"\\\']+',
  'seed[_ -]?phrase\\\\s*[:=]\\\\s*["\\\'][^"\\\']+',
  'private[_-]?key\\\\s*[:=]\\\\s*["\\\'][^"\\\']+'
].join('|'),'i');
if (secretPattern.test(sourceScan)) {
  throw new Error('V14.12 secret-like material detected in frontend source');
}
console.log('420Exchange V14.1/V14.2/V14.3/V14.4/V14.5/V14.6/V14.7/V14.8/V14.9/V14.10/V14.11/V14.12 static qualification passed');
