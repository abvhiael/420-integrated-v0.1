// Public marketing only. Backend rider consent, permission and dispatch remain protected.
const features = Object.freeze([
  {image:'liftd-rider-dispensaries.png',alt:'A winding mountain road beside a forested alpine lake',heading:'DISPENSARIES',description:'Explore destinations and responsible transportation.'},
  {image:'liftd-rider-events.png',alt:'Outdoor concert crowd beneath a mountain sunset',heading:'EVENTS & CONCERTS',description:'From concerts to festivals, plan your journey.'},
  {image:'liftd-rider-explore.png',alt:'An alpine lake beneath rugged peaks at sunset',heading:'EXPLORE MORE',description:'Beautiful places and new destinations.'}
]);
export function renderRiderLanding() {
 const page=document.createElement('div');
 page.className='rider-landing';
 page.innerHTML=`
  <section class="rider-hero" aria-labelledby="rider-hero-title">
   <img class="rider-hero-image" src="./assets/liftd-rider-hero.png" alt="Dark sedan on a curving mountain highway beside a lake at sunset" width="1648" height="928" fetchpriority="high">
   <div class="rider-hero-shade"></div>
   <div class="rider-hero-content">
    <h1 id="rider-hero-title">PEOPLE<br>PLACES<br>CANNABIS<br><span>TOGETHER</span></h1>
    <p class="rider-subtitle">A CANNABIS FRIENDLY RIDESHARE</p>
    <a class="rider-cta" href="/rider" data-route>RIDER PORTAL PREVIEW <span aria-hidden="true">→</span></a>
   </div>
   <ul class="rider-promises" aria-label="LIFTd values">
    <li><span aria-hidden="true">✳</span><strong>Cannabis Friendly</strong><small>Ride your way.</small></li>
    <li><span aria-hidden="true">⌖</span><strong>Higher Destinations</strong><small>Discover places &amp; events.</small></li>
    <li><span aria-hidden="true">●●●</span><strong>Good People</strong><small>Respectful, friendly rides.</small></li>
   </ul>
  </section>
  <section class="rider-more" aria-labelledby="rider-more-title">
   <div class="rider-intro">
    <p class="rider-kicker">MORE THAN A RIDE</p>
    <h2 id="rider-more-title">A HIGHER WAY<br>TO GET THERE</h2>
    <p>LIFTd is building a cannabis-friendly rideshare experience that connects people and places with safety, consent and responsible transportation at its core.</p>
    <a class="rider-cta rider-cta-small" href="/rider" data-route>VIEW RIDER PORTAL <span aria-hidden="true">→</span></a>
    <p class="rider-launch-notice">Vancouver pilot in preparation. Booking, payments and live dispatch are not yet available. Drivers must remain unimpaired.</p>
   </div>
   <div class="rider-card-grid">${features.map(f=>`<article class="rider-feature"><img src="./assets/${f.image}" alt="${f.alt}" loading="lazy"><div class="rider-feature-body"><h3>${f.heading}</h3><p>${f.description}</p></div></article>`).join('')}</div>
  </section>`;
 return page;
}
