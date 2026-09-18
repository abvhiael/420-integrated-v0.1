const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

const clampRating = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
};

export function loadingState(message="Loading reputation…") {
  return `<div class="rep-state rep-loading" role="status" aria-live="polite">${esc(message)}</div>`;
}

export function errorState(message="Reputation is unavailable.") {
  return `<div class="rep-state rep-error" role="alert">${esc(message)}</div>`;
}

export function emptyState(message="No reviews yet.") {
  return `<div class="rep-state rep-empty">${esc(message)}</div>`;
}

export function domainLabel(domain) {
  const label = String(domain ?? "").trim().replaceAll("_"," ");
  return `<span class="rep-domain" aria-label="Reputation domain">${esc(label || "UNKNOWN")}</span>`;
}

export function verifiedBadge(verification) {
  const verified = String(verification ?? "").toUpperCase() === "VERIFIED_INTERACTION";
  return verified
    ? '<span class="rep-badge rep-badge-verified" title="Backed by a verified interaction">verified interaction</span>'
    : '<span class="rep-badge rep-badge-opinion" title="Not backed by a verified interaction">unverified opinion</span>';
}

export function policyDisclosure(policyVersion) {
  return `<p class="rep-policy">domain-scoped application reputation · policy <code>${esc(policyVersion || "unknown")}</code> · not a universal score</p>`;
}

export function ratingSummary(summary={}) {
  const avg = clampRating(summary.averageRating ?? summary.AverageRating ?? 0);
  const count = Number(summary.visibleReviewCount ?? summary.VisibleReviewCount ?? 0);
  const verified = Number(summary.verifiedReviewCount ?? summary.VerifiedReviewCount ?? 0);
  const unverified = Number(summary.unverifiedReviewCount ?? summary.UnverifiedReviewCount ?? 0);
  return `<section class="rep-summary" aria-label="Reputation summary">
    <div class="rep-score"><strong>${avg.toFixed(1)}</strong><span aria-hidden="true">/5</span></div>
    <div class="rep-summary-meta">
      <span>${esc(count)} visible review${count===1?"":"s"}</span>
      <span>${esc(verified)} verified · ${esc(unverified)} unverified</span>
    </div>
  </section>`;
}

function distributionValue(distribution,key,legacyKey) {
  return Number(distribution?.[key] ?? distribution?.[legacyKey] ?? 0);
}

export function ratingHistogram(distribution={}) {
  const rows = [[5,"five"],[4,"four"],[3,"three"],[2,"two"],[1,"one"]];
  const counts = rows.map(([rating,key]) => [rating, distributionValue(distribution,key,key[0].toUpperCase()+key.slice(1))]);
  const total = counts.reduce((sum,[,count]) => sum+count,0);
  return `<div class="rep-histogram" aria-label="Rating distribution">${counts.map(([rating,count]) => {
    const pct = total ? Math.round((count/total)*100) : 0;
    return `<div class="rep-hist-row"><span>${rating}★</span><div class="rep-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${rating} star reviews: ${count}"><span style="width:${pct}%"></span></div><span>${count}</span></div>`;
  }).join("")}</div>`;
}

export function responseCard(response={}) {
  if (!response || !response.bodyRef) return "";
  return `<aside class="rep-response" aria-label="Response from reviewed subject">
    <strong>response from subject</strong>
    <p data-body-ref="${esc(response.bodyRef)}">response content reference: <code>${esc(response.bodyRef)}</code></p>
  </aside>`;
}

export function moderationState(review={}) {
  const status = String(review.status ?? review.Status ?? "ACTIVE").toUpperCase();
  if (status === "ACTIVE") return "";
  return `<div class="rep-moderation rep-moderation-${esc(status.toLowerCase())}" role="status">review status: ${esc(status)}</div>`;
}

export function reviewCard(review={},response=null) {
  const rating = clampRating(review.rating ?? review.Rating);
  const author = review.author ?? review.Author ?? {};
  const bodyRef = review.bodyRef ?? review.BodyRef ?? "";
  return `<article class="rep-review" data-review-id="${esc(review.id ?? review.ID ?? "")}">
    <header>
      <div class="rep-stars" aria-label="${rating} out of 5 stars">${"★".repeat(Math.round(rating))}${"☆".repeat(5-Math.round(rating))}</div>
      ${verifiedBadge(review.verification ?? review.Verification)}
    </header>
    <p class="rep-author">reviewer: <code>${esc(author.id ?? author.ID ?? "unknown")}</code></p>
    ${bodyRef ? `<p class="rep-body-ref" data-body-ref="${esc(bodyRef)}">review content reference: <code>${esc(bodyRef)}</code></p>` : ""}
    ${moderationState(review)}
    ${responseCard(response)}
  </article>`;
}

export function reviewComposer({domain="",subjectType="",subjectId="",allowUnverified=true}={}) {
  return `<form class="rep-composer" data-reputation-composer>
    <fieldset>
      <legend>write a review</legend>
      ${domainLabel(domain)}
      <input type="hidden" name="domain" value="${esc(domain)}">
      <input type="hidden" name="subjectType" value="${esc(subjectType)}">
      <input type="hidden" name="subjectId" value="${esc(subjectId)}">
      <label>rating <select name="rating" required>
        <option value="">choose</option>
        <option value="5">5 — excellent</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1 — poor</option>
      </select></label>
      <label>review content reference <input name="bodyRef" autocomplete="off" placeholder="storage://…"></label>
      <label>verification <select name="verification" required>
        <option value="VERIFIED_INTERACTION">verified interaction</option>
        ${allowUnverified?'<option value="UNVERIFIED_OPINION">unverified opinion</option>':""}
      </select></label>
      <label>interaction evidence <input name="evidenceRef" autocomplete="off"></label>
      <button type="submit">submit review</button>
    </fieldset>
  </form>`;
}

export function reportControl(reviewId="") {
  return `<form class="rep-report" data-review-id="${esc(reviewId)}">
    <label>report reason
      <select name="reason" required>
        <option value="">choose</option>
        <option>SPAM</option><option>CONFLICT_OF_INTEREST</option><option>HARASSMENT</option><option>FRAUD</option>
        <option>DUPLICATE</option><option>IRRELEVANT</option><option>PERSONAL_INFORMATION</option><option>RIGHTS_VIOLATION</option>
      </select>
    </label>
    <button type="submit">report review</button>
  </form>`;
}

export function reputationPanel({domain,summary,reviews=[],responses={},policyVersion}={}) {
  if (!summary) return emptyState();
  const dist = summary.ratingDistribution ?? summary.RatingDistribution ?? {};
  const avg = summary.averageRating ?? summary.AverageRating ?? 0;
  const policy = policyVersion ?? summary.policyVersion ?? summary.PolicyVersion ?? "unknown";
  return `<section class="rep-panel">
    <header class="rep-panel-header">${domainLabel(domain)}<h2>reputation</h2></header>
    ${ratingSummary({...summary,averageRating:avg})}
    ${ratingHistogram(dist)}
    ${policyDisclosure(policy)}
    <div class="rep-review-list">${reviews.length ? reviews.map(r => reviewCard(r,responses[r.id ?? r.ID])).join("") : emptyState()}</div>
  </section>`;
}
