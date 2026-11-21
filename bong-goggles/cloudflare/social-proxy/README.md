# BongGoggles account-social: Cloudflare-to-Render ingress

The existing public BongGoggles host is `https://bonggoggles.420integrated.org`.
Its **separate** Worker route is `bonggoggles.420integrated.org/social-api/*`.
Do not replace the original site Worker or bind this proxy as a custom domain.

## Why this transport is needed

Cloudflare's Worker fetch to the actual Render hostname
`https://bonggoggles-social.onrender.com` routes correctly, but that
hostname is deliberately rejected by the Go social handler. Rewriting the
`Host` header to the public website instead can cause Render to emit 502
because Render has not registered that hostname for the social service.

This implementation accepts requests to that **one** registered Render
hostname **only** when both of these are true:

- The request has the HTTPS termination signal expected from Render.
- The request includes the exact independent 256-bit Cloudflare Worker
  credential in `X-Social420-Edge-Key`, compared with constant-time equality.

Canonical-host requests retain their existing restrictions. The Worker
overwrites any browser-supplied edge credential before forwarding.
Invalid/missing Worker credentials fail closed (403), including direct
`onrender.com` requests. The credential is unrelated to 420ID SSO
confidential client secret, email settings or the message/session keys.

## Operator activation (required, not supplied with repository source)

1. Merge a qualified implementation before deploying it. Render social
   service `srv-dc0iijm1egvs7382fkag` tracks `main` with auto-deploy OFF;
   manually deploy its updated `main` commit after merging.
2. Generate **a new independent random 32-byte secret**, encode as unpadded
   Base64url (43 ASCII characters). Generate locally with a cryptographic
   random number generator; never put it in source, public config, a ticket,
   screenshot or a chat message. On Windows PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   $rng.Dispose()
   $key = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
   $key | Set-Clipboard
   ```

3. In the Render social service's **Environment**, add secret variable
   `SOCIAL420_EDGE_SECRET` with that value. Keep all existing variables
   and do not put `SOCIAL420_MIGRATION_DATABASE_URL` in the running service.
   Deploy updated code and environment.
4. In **Cloudflare → Workers & Pages → bonggoggles-social-proxy → Settings
   → Variables and Secrets**, add a **Secret** binding named
   `SOCIAL420_EDGE_SECRET` with the identical 43-character value.
5. Under that Worker's **Edit Code**, replace any temporary one-path
   diagnostic script with the entire `worker.mjs` from this directory,
   then **Deploy**. Use the existing **Route**, not Custom Domain:
   `bonggoggles.420integrated.org/social-api/*`.
6. Open `https://bonggoggles.420integrated.org/social-api/healthz`:
   expect HTTP 200 and `{"ready":true}`. A browser request direct to
   `https://bonggoggles-social.onrender.com/social-api/healthz` must
   continue returning HTTP 403. Confirm the ordinary site is unchanged.
7. Test `/social-api/auth/start`, a real approved-mailbox 420ID SSO
   consent and the callback into the same BongGoggles domain; inspect
   Secure/HttpOnly host-only cookies, logout, revoked session denial,
   cross-account access, and rate limiting. If these tests fail, keep
   frontend `features.accountSocial` disabled.
8. Only after full external acceptance enable accountSocial, accountMessaging,
   accountGames and accountXP in the **actual deployed** site config. Keep
   accountMonetization false unless its own separately qualified release is
   authorized. Do not confuse off-chain XP with on-chain rewards.

**Do not disable the Render default hostname while this Worker fetches it.**
The application rejects untrusted requests using that address, but Render
must continue recognizing it as the upstream transport. If the secret
leaks, rotate it in **both** Render and Cloudflare; changing it invalidates
the proxy until both configurations match.

## Focused automated qualification

- `go test ./services/bong-goggles-account-social -run TestTrustedWorkerIngressIsSecretBound -count=1`
- `node --test bong-goggles/web/test/trusted-social-proxy.test.js`

The existing social PostgreSQL/race workflow and BongGoggles web suite
also run these tests. Automated tests do **not** certify live Cloudflare
routing, real SSO browser sign-in, rate/bot rules or production release.


## Free Render cold-start login recovery (November 21, 2026)

**Why users saw 502:** Both `bonggoggles-social` and `420id` were
running on Render Free. Render deliberately suspends a free web service after
15 minutes without incoming requests and may need approximately one minute
to wake it. A successful Render deployment or `/social-api/healthz` response
does not make the service continuously available. The social `/auth/start`
handler first inserts a short-lived flow into Neon; it does **not** call 420ID
until the browser has followed the redirect. Consequently, a Render-generated
502 on `/social-api/auth/start` is **not fixed** by adding frontend login
buttons or redeploying 420ID.

This Worker has a **bounded** browser recovery page for only the exact,
no-query `GET /social-api/auth/start` navigation. If Render returns 502,
503, or 504 (or its HTTPS fetch fails), it serves an uncacheable 503 document,
which retries the normal login entry point after 12 seconds, at most seven
automatic times. The retry count uses a short-lived, Secure/HttpOnly/SameSite
cookie scoped to the exact login path. When Render returns its real 303 SSO
redirect, its original Set-Cookie/Location are preserved and the wake cookie
is cleared. It does not replay a one-use SSO callback, logout, POST or other
request, never caches private data, never loosens Worker edge credentials,
and does not embed SSO tokens or secrets in the page.

**This is a mitigation, not always-on hosting.** It reduces the naked
Render 502 seen by browsers during a social-service cold start. It cannot
prevent the *separate* Render-hosted 420ID service from sleeping when the
browser reaches its own hostname. For reliable public/team sign-in, migrate
or upgrade **both** Render Free web services to always-on hosting only after
the operator approves any recurring charges and validates the new deployment.

**Required manual release:** changes to this GitHub file do not automatically
replace the deployed Cloudflare Worker. After GitHub tests pass and the change
is merged, open Cloudflare → Workers & Pages → **bonggoggles-social-proxy**
→ Edit Code, replace the code with the **complete** latest
`bong-goggles/cloudflare/social-proxy/worker.mjs`, and deploy. Do not touch
the Cloudflare Pages project, the route, the existing
`SOCIAL420_EDGE_SECRET` secret, or the backend Render configuration.
The correct Worker route remains `bonggoggles.420integrated.org/social-api/*`.

Acceptance: verify an awake SSO flow still forwards a 303 with its secure
flow cookie; while social is cold a browser receives the bounded startup
page instead of Render's bare 502; a disconnected origin still fails closed;
a POST, one-use auth callback or authenticated feed is **not** retried; and
after the service wakes, 420ID sign-in/callback, logout and existing feed
work end to end. Do not claim a successful live fix without completing these.
