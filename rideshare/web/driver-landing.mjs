// Public presentation only: no recruitment submission, dispatch, live income claim or privileged session.
const base = './assets/';
const featureCards = Object.freeze([
  {file:'liftd-driver-earn-more.png',alt:'Mountain road at sunset',icon:'$',title:'EARN MORE',copy:'Clear fare and earnings information when the pilot is authorized.'},
  {file:'liftd-driver-drive-your-way.png',alt:'Driver view of a winding mountain road',icon:'◷',title:'DRIVE YOUR WAY',copy:'Availability and scheduling tools for approved drivers.'},
  {file:'liftd-driver-community.png',alt:'Scenic mountain lake with a car',icon:'●',title:'A RESPECTFUL COMMUNITY',copy:'Community-minded riders and responsible journeys.'}
]);
export function renderDriverLanding() {
  const page = document.createElement('div');
  page.className = 'driver-landing';
  page.innerHTML = `
    <section class="driver-hero" aria-labelledby="driver-headline">
      <div class="driver-hero-photo"><img src="${base}liftd-driver-hero.png" alt="Smiling driver in a LIFTd cap seated in a vehicle" width="1104" height="1024"></div>
      <div class="driver-hero-copy">
        <p class="driver-eyebrow">DRIVER OPPORTUNITIES</p>
        <h1 id="driver-headline">DRIVE PEOPLE<br>TO <span>HIGHER PLACES</span></h1>
        <p class="driver-lead">A community-minded, cannabis-friendly rideshare experience built around responsible transport and approved drivers.</p>
        <ul class="driver-benefits">
          <li><span class="driver-benefit-icon" aria-hidden="true">$</span><div><strong>Transparent earnings</strong><small>Review approved fares and compensation when service launches.</small></div></li>
          <li><span class="driver-benefit-icon" aria-hidden="true">◷</span><div><strong>Flexible availability</strong><small>Driver scheduling tools built for verified participants.</small></div></li>
          <li><span class="driver-benefit-icon" aria-hidden="true">✳</span><div><strong>Cannabis-friendly community</strong><small>Respectful, adult-oriented service; sober driving is mandatory.</small></div></li>
          <li><span class="driver-benefit-icon" aria-hidden="true">✓</span><div><strong>Verified &amp; authorized</strong><small>Transport eligibility, insurance and safety approvals come first.</small></div></li>
        </ul>
        <a class="driver-cta" href="/driver" data-route>DRIVER PORTAL PREVIEW <span aria-hidden="true">→</span></a>
        <p class="driver-hold">Vancouver pilot preparation only. Driver enrolment and live rides are not available.</p>
      </div>
    </section>
    <section class="driver-lower" aria-labelledby="driver-community-title">
      <div class="driver-lower-intro">
        <p class="driver-eyebrow">WHY DRIVE WITH LIFTd</p>
        <h2 id="driver-community-title">BETTER RIDES.<br>BETTER COMMUNITY.</h2>
        <p>Discover the vision behind LIFTd: transparent journey information, driver tools and a respectful approach to getting people where they need to go.</p>
        <a class="driver-cta driver-cta-small" href="/driver" data-route>VIEW DRIVER PORTAL <span aria-hidden="true">→</span></a>
      </div>
      <div class="driver-cards">
        ${featureCards.map(card=>`<article class="driver-feature-card"><img src="${base}${card.file}" alt="${card.alt}" loading="lazy"><div class="driver-card-content"><span class="driver-card-icon" aria-hidden="true">${card.icon}</span><h3>${card.title}</h3><p>${card.copy}</p></div></article>`).join('')}
      </div>
    </section>`;
  return page;
}
