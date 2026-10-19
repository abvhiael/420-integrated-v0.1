import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const canonical=JSON.parse(read('config/arcade-game-identities.json'));
const policy=JSON.parse(read('config/arcade-platform-requirements.json'));
export function verify(p,ids=canonical){
  assert.equal(p.schemaVersion,'1.0.0');
  assert.equal(p.application,'420Arcade');
  assert.equal(p.requirementStep,'ARC-0.5');
  assert.equal(p.status,'REQUIREMENTS_FROZEN_NOT_IMPLEMENTATION_CERTIFIED');
  assert.deepEqual(p.browserSupport.desktop,['chromium-current-and-previous','firefox-current-and-previous','safari-current-and-previous']);
  assert.deepEqual(p.browserSupport.mobile,['ios-safari-current-and-previous','android-chrome-current-and-previous']);
  for(const key of ['featureDetectionRequired','unsupportedBrowserMessageRequired','secureContextForServiceWorker']) assert.equal(p.browserSupport[key],true);
  assert.ok(p.desktop.minimumViewportCssPx.width<=320 && p.desktop.minimumViewportCssPx.height<=568);
  assert.deepEqual(p.desktop.supportedInputs,['keyboard','pointer']);
  for(const key of ['responsiveLayout','zoom200PercentNoLoss'])assert.equal(p.desktop[key],true);
  assert.ok(p.mobile.minimumViewportCssPx.width<=320 && p.mobile.minimumViewportCssPx.height<=568);
  assert.deepEqual(p.mobile.supportedInputs,['touch','external-keyboard']);
  assert.ok(p.mobile.touchTargetMinimumCssPx>=44);
  for(const key of ['orientationRecovery','noHoverOnlyFunctions']) assert.equal(p.mobile[key],true);
  assert.equal(p.accessibility.standard,'WCAG-2.2-AA');
  for(const key of ['keyboardComplete','visibleFocus','screenReaderLabels','colorIndependentSignals','reducedMotion','pausingAvailable','scalableText','highContrastMode','nonAudioEquivalent'])assert.equal(p.accessibility[key],true);
  assert.ok(p.accessibility.contrastTextMinimum>=4.5 && p.accessibility.contrastLargeTextMinimum>=3);
  assert.equal(p.offline.cacheBudgetMiB,100);
  assert.equal(p.offline.cacheEviction,'per-game-lru');
  for(const key of ['guestCoreNeverRequiresWallet','offlineGuestSavesRequired','assetsVersionPinned','noExecutableRemoteCodeCaching','privateDrawingsNeverCachedInServiceWorker','serviceWorkerOptInInstall','networkUncertaintyDisablesOnlyOnlineFeatures'])assert.equal(p.offline[key],true);
  assert.equal(p.offline.verifiedScoresAndEconomicsOffline,false);
  for(const key of ['loadGamesLazily','perGameErrorIsolation','abortLoadOnUnmount','assetIntegrityRequired']) assert.equal(p.performance[key],true);
  assert.equal(ids.games.length,11);
  assert.equal(p.games.length,11);
  const slugs=new Set();
  for(const [i,g] of p.games.entries()){
    assert.equal(g.slug,ids.games[i].slug);
    assert.ok(!slugs.has(g.slug),'duplicate game');slugs.add(g.slug);
    assert.deepEqual(g.platforms,['desktop-browser','mobile-browser']);
    assert.equal(g.offlineCore,'REQUIRED');
    assert.equal(g.offlineOptionalProtocol,'UNAVAILABLE');
    assert.equal(g.offlineCompetitiveVerification,'UNVERIFIED_LOCAL_ONLY');
    assert.equal(g.accessibilityStatus,'IMPLEMENTATION_PENDING');
    assert.equal(g.offlineStatus,'IMPLEMENTATION_PENDING');
    const expected=g.slug==='420colouring-book'?'private-exports-consent-and-bounded-memory':g.slug==='420buddy'?'bounded-clock-and-no-punitive-absence':g.slug==='wheres-dave'?'accessible-zoom-pan-and-target-alternative':'keyboard-touch-and-pause';
    assert.equal(g.specialCase,expected);
  }
  return true;
}
verify(policy);
const mutate=(fn)=>{const bad=structuredClone(policy);fn(bad);assert.throws(()=>verify(bad));};
[
 p=>p.games.pop(), p=>p.games[2].slug=p.games[1].slug, p=>p.games.reverse(),
 p=>p.games[0].offlineCore='ONLINE_ONLY', p=>p.games[3].offlineCompetitiveVerification='VERIFIED',
 p=>p.games[0].accessibilityStatus='CERTIFIED', p=>p.games[0].specialCase='none',
 p=>p.offline.guestCoreNeverRequiresWallet=false, p=>p.offline.verifiedScoresAndEconomicsOffline=true,
 p=>p.offline.privateDrawingsNeverCachedInServiceWorker=false, p=>p.offline.assetsVersionPinned=false,
 p=>p.offline.noExecutableRemoteCodeCaching=false, p=>p.accessibility.screenReaderLabels=false,
 p=>p.accessibility.contrastTextMinimum=3, p=>p.mobile.touchTargetMinimumCssPx=20,
 p=>p.desktop.minimumViewportCssPx.width=1024, p=>p.browserSupport.mobile.pop(),
 p=>p.performance.perGameErrorIsolation=false, p=>p.status='PRODUCTION_CERTIFIED'
].forEach(mutate);
console.log('ARC-0.5 requirements and 19 negative/boundary fixtures PASS');
