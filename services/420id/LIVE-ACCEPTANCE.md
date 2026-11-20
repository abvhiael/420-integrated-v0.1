# AUTH-2 live email and authenticator acceptance

## Scope and activation boundary

Proposed stable relying-party domain: **auth.420integrated.org**. Use
https://auth.420integrated.org as the exact origin and auth.420integrated.org
as the RP ID only after the operator confirms domain control and DNS/TLS.
A credential enrolled for an unrelated preview hostname is not transferable
to this host. This is a restricted real-world acceptance harness, not an
AUTH-3 session authority, SSO service, public general-registration rollout,
wallet or reward product. Do not activate unrestricted access before those
subsequent gates. Use an isolated database and explicitly approved test
mailboxes; never point the harness at a real-user account database.

## Deployment preparation

Render native Go service (paid plan permitting outbound TCP 465):
- Repository: abvhiael/420-integrated-v0.1; deploy the explicitly qualified
  revision/branch; record the deploy ID and git SHA.
- Build command: go build -trimpath -o 420id ./cmd/420id
- Start command: ./420id
- Health check: /healthz; port from PORT (default 10000).
- Alternatively build services/420id/Dockerfile with repository root context.
  The image runs as non-root and includes system CA certificates.
- Do not use Render's free compute plan for SMTP: it blocks ports 25, 465
  and 587. The service requires implicit TLS on port 465. No plaintext or
  anonymous mail delivery fallback exists.

Add the approved custom hostname in Render and use the exact target displayed
by Render to configure DNS at the authoritative provider. For Cloudflare,
use DNS-only CNAME to the assigned Render hostname during verification, no
conflicting A/AAAA records, verify the domain in Render and verify the public
TLS certificate. Do not invent a target or overwrite unrelated DNS. Require
HTTPS, do not allow a public bypass around the trusted TLS proxy; disable the
default host if possible. The app rejects noncanonical Host and Origin, and
trusts X-Forwarded-Proto only when the operator explicitly configures a trusted
TLS-terminating ingress which overwrites client-supplied forwarded protocol.
A spoofable forwarded header is not acceptable deployment topology.
See https://render.com/docs/custom-domains and
https://render.com/docs/configure-cloudflare-dns.

## Secret and environment configuration

Populate these in the hosting secret manager, not in GitHub, terminal history,
browser code or chat transcripts. No sample credential authenticates.

| Variable | Required value |
| --- | --- |
| AUTH420_MODE | acceptance (otherwise the server refuses to start) |
| AUTH420_ORIGIN | https://auth.420integrated.org, if approved and verified |
| AUTH420_RP_ID | auth.420integrated.org, exact approved hostname |
| AUTH420_TLS_TERMINATION | trusted-proxy, only with verified ingress |
| AUTH420_DATABASE_URL | Dedicated acceptance DB runtime PostgreSQL URL, sslmode=verify-full, explicit trusted CA as necessary |
| AUTH420_MIGRATION_DATABASE_URL | Separate operator PostgreSQL URL for migration only; never add this credential to the serving runtime |
| AUTH420_SMTP_HOST | Actual verified transactional relay SMTP hostname |
| AUTH420_SMTP_PORT | 465 |
| AUTH420_SMTP_USERNAME | Actual scoped SMTP credential |
| AUTH420_SMTP_PASSWORD | Actual scoped SMTP secret |
| AUTH420_SMTP_FROM | Verified sender address authorized by that provider |
| AUTH420_ACCEPTANCE_EMAILS | Comma-separated approved controlled test mailboxes, max 50 |
| AUTH420_RATE_KEY | 32 random bytes, base64url without padding, same secret across replicas |

Generate a rate key in the operator's trusted secret provisioning environment
(e.g. Python: import secrets; print(secrets.token_urlsafe(32))). Do not emit
the generated value to application logs. Rotate deliberately; the global
limits remain intact. The SMTP credentials must be created through the
chosen mail provider's authenticated console and kept separate from a
personal mailbox password. Configure the provider's exact sender-domain
verification, DKIM, SPF and return-path records; reconcile existing SPF
rather than adding a contradictory second SPF record. Configure DMARC with
the domain operator's existing policy. Never copy example DNS values into
a real domain. Verify provider status and domain alignment from actual mail
headers. SMTP queue's 250 response alone is not inbox delivery.

## Database

Create a dedicated acceptance PostgreSQL database/role through the selected
provider. Use a certificate-verified URL with sslmode=verify-full and CA
configuration if needed (container CA bundle:
 /etc/ssl/certs/ca-certificates.crt). Run the binary with the migrate argument
using the separate migration credential, then grant the runtime role scoped
DML. Example below assumes the operator has created an isolated role named
account420_runtime; substitute the actual provider role and ensure PUBLIC
does not have schema access.

    ./420id migrate

    REVOKE ALL ON SCHEMA account420 FROM PUBLIC;
    GRANT USAGE ON SCHEMA account420 TO account420_runtime;
    GRANT SELECT,INSERT,UPDATE ON account420.accounts TO account420_runtime;
    GRANT SELECT,INSERT ON account420.email_identities TO account420_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON account420.email_throttle TO account420_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON account420.email_challenges TO account420_runtime;
    GRANT SELECT,INSERT,DELETE ON account420.passkey_challenges TO account420_runtime;
    GRANT SELECT,INSERT,UPDATE ON account420.passkeys TO account420_runtime;
    GRANT SELECT,INSERT,DELETE ON account420.acceptance_flows TO account420_runtime;
    GRANT SELECT,INSERT,UPDATE,DELETE ON account420.acceptance_rate TO account420_runtime;
    GRANT INSERT,DELETE ON account420.acceptance_receipts TO account420_runtime;
    GRANT SELECT(created_at) ON account420.acceptance_receipts TO account420_runtime;

Do not give serving runtime migration/DDL permissions, superuser, ownership
or broader database access. Keep the production database separate and the
acceptance allowlist restricted. Full receipt read access is operator-only; the runtime can read only the timestamp required for expiry.

## Secure request handling

The UI is same-origin; POST requires exact approved HTTPS authority and Origin.
No CORS allowance, no redirects, no query secrets, no inline scripts, no
external analytics, no token in web storage. Secure HttpOnly SameSite=Strict
host-only cookie binds each issued ceremony to its initiating browser;
PostgreSQL enforces binding across replicas. Body is limited to 32 KiB,
strict JSON object/known fields, no duplicate fields, no compression.
Requests have timeouts; responses use no-store, CSP, HSTS and no framing.
Email start returns a generic challenge for unknown/nonapproved/throttled
addresses; only allowlisted mailboxes can receive real codes. A code and
challenge may only verify together from the initiating browser. Server
enforces per-recipient cooldown, per-challenge attempts, per-browser,
immediate-peer and global limits (including 30 email starts/hour).
Immediate-peer limits deliberately do not trust forwarded client IP
headers; reverse-proxy source addresses may be shared. Apply ingress
DDoS/source protections before opening general access. Rate limits are
fixed-window bounds, not a complete public abuse-control system.
No AUTH-3 session, wallet or financial permission is issued; the flow cookie
only binds challenge issuance to a browser. Receipts contain random ID,
ceremony kind and timestamps, not an account or device identifier.

## Live acceptance execution (operator/tester)

1. On the actual deployed hostname, confirm trusted TLS, expected certificate
   hostname, canonical origin, no fallback host, /healthz ready, no-store
   security headers and no leaked secrets. Record deployed git SHA/deploy ID.
2. Use approved disposable mailbox accounts at representative mail providers
   (e.g. Gmail and Outlook, if available and controlled). Start a request
   from the page; never paste code into chat or screenshots. Verify actual
   inbox arrival (record provider, receipt time, latency, spam folder and
   authentication-results SPF/DKIM/DMARC alignment, redact addresses).
   Enter the code in the same browser. Retain the email_verified receipt.
   A successfully redeemed code establishes mailbox access in that test;
   it does not establish provider-wide delivery or legal identity.
3. Create a real user-verified discoverable passkey. Retain the
   passkey_registered receipt. Then click Verify with passkey and complete a
   fresh signed assertion; retain the passkey_verified receipt. Registration
   alone or a simulated response is not successful device authentication.
4. Repeat on representative physical devices/browsers: Windows Hello
   (Chrome/Edge), Apple Touch ID/iCloud Keychain (Safari on macOS/iOS),
   Android screen lock/Google Password Manager (Chrome), and a compatible
   PIN/user-verification-capable FIDO2 hardware key. Use separate approved
   mailbox accounts per initial credential because AUTH-2 permits only one
   initial credential per account/RP. No silent credential replacement.
   Test genuine repeated login on the same credential, synchronized passkey
   if applicable, cancelled ceremony and different browser rejection.
   Record actual OS/browser/authenticator class, test date, evidence IDs and
   pass/fail; none attestation does not cryptographically identify hardware.
   Report unsupported attestation/extension/algorithm profiles instead of
   mislabeling them as passing.
5. On a privileged operator connection, verify returned receipt IDs exist
   against the isolated acceptance database:
   
       SELECT id,kind,created_at
       FROM account420.acceptance_receipts
       WHERE id IN ('<email UUID>','<enrollment UUID>','<assertion UUID>');

   Record only the opaque receipt IDs, method, date and result. Associate
   them with the release SHA/deploy ID and human-observed device/provider
   metadata, not personal identifiers. Receipts are purged after 30 days.
   Document actual failure and any unsupported authenticator. Do not claim
   production compatibility based on unit, mock SMTP or virtual authenticator
   output. Do not start unrestricted registration or sessions from this page.

## Qualification commands

Run the repository account/auth tests against disposable PostgreSQL
account420_test (ACCOUNT420_TEST_DSN):
go test -race -tags account420_integration -count=1 -v ./services/420id

The SMTP socket regression uses an in-process TLS relay with disposable
credentials and a locally generated CA; it tests real encrypted transport
and certificate rejection, NOT external recipient deliverability. The
HTTP integration suite verifies same-origin, host, cookie, cross-browser,
rate, replay, body validation, receipt and passkey paths against a database.
The workflow also tests existing AUTH-1/2 regressions, bounded WebAuthn fuzz,
browser adapter, build and fail-closed startup. External mail and physical
devices must supply separate retained live evidence.

## Live acceptance status

Repository code supports the acceptance flow; no real relay credentials,
DNS target, verified certificate, external delivery result or physical
authenticator result is asserted in this file. Operator completes the
above with the actual provider, hosting workspace, domain and devices.
