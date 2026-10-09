//go:build grow_integration

package dashboard

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

const tenantA = "aaaaaaaa-1111-4111-8111-111111111111"
const tenantB = "bbbbbbbb-2222-4222-8222-222222222222"
const facilityA = "aaaaaaaa-3333-4333-8333-333333333333"
const zoneA = "aaaaaaaa-4444-4444-8444-444444444444"
const zoneB = "aaaaaaaa-4444-4444-8444-444444444445"

func integrationDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("GROW_DASHBOARD_TEST_DSN")
	if dsn == "" {
		t.Fatal("grow_integration requires a real, non-superuser PostgreSQL DSN")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err = db.PingContext(context.Background()); err != nil {
		t.Fatal(err)
	}
	return db
}

func verifiedCertificateRequest(subject, tenant string) (*http.Request, []byte) {
	raw := []byte("grow-ci-cert-" + strings.TrimPrefix(subject, "ci-"))
	uri, _ := url.Parse("spiffe://420integrated.org/grow/tenants/" + tenant + "/subjects/" + subject)
	cert := &x509.Certificate{Raw: raw, URIs: []*url.URL{uri}}
	r := httptest.NewRequest(http.MethodPost, "https://grow.example/v1/private/login", nil)
	r.Header.Set("Origin", "https://grow.example")
	r.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert},
		VerifiedChains: [][]*x509.Certificate{{cert}}}
	return r, raw
}
func makeSession(t *testing.T, db *sql.DB, subject, tenant string) (*http.Cookie, *http.ServeMux) {
	t.Helper()
	req, raw := verifiedCertificateRequest(subject, tenant)
	gotTenant, gotSubject, fp, err := (CertificateIdentity{DB: db}).Authenticate(req)
	if err != nil || gotTenant != tenant || gotSubject != subject {
		t.Fatalf("certificate authentication rejected or mismatched: %v", err)
	}
	digest := sha256.Sum256(raw)
	if string(fp) != string(digest[:]) {
		t.Fatal("certificate fingerprint mismatch")
	}
	id, err := uuidV4()
	if err != nil {
		t.Fatal(err)
	}
	cookie, err := (SQLAuthenticator{DB: db}).Issue(req.Context(), tenant, subject, id, time.Now(), fp)
	if err != nil {
		t.Fatalf("session issuance: %v", err)
	}
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" {
		t.Fatal("insecure dashboard session cookie")
	}
	mux := http.NewServeMux()
	if err := MountPrivate(mux, db); err != nil {
		t.Fatal(err)
	}
	return cookie, mux
}
func api(t *testing.T, mux *http.ServeMux, cookie *http.Cookie, method, path string, body any, csrf bool) *httptest.ResponseRecorder {
	t.Helper()
	var payload *strings.Reader
	if body == nil {
		payload = strings.NewReader("")
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		payload = strings.NewReader(string(raw))
	}
	req := httptest.NewRequest(method, "https://grow.example"+path, payload)
	req.AddCookie(cookie)
	if method == http.MethodPost {
		req.Header.Set("Origin", "https://grow.example")
		if csrf {
			req.Header.Set("X-CSRF-Token", csrfToken(cookie.Value))
		}
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}
func requestID(t *testing.T) string {
	t.Helper()
	id, err := uuidV4()
	if err != nil {
		t.Fatal(err)
	}
	return id
}
func action(t *testing.T, mux *http.ServeMux, cookie *http.Cookie, section string, input map[string]any, want int) string {
	t.Helper()
	input["requestId"] = requestID(t)
	w := api(t, mux, cookie, "POST", "/v1/private/action/"+section, input, true)
	if w.Code != want {
		t.Fatalf("%s %v: status %d expected %d body %s", section, input, w.Code, want, w.Body.String())
	}
	return w.Body.String()
}
func TestPrivatePostgresRealSessionsScopedReadsWritesAndRevocation(t *testing.T) {
	db := integrationDB(t)
	owner, mux := makeSession(t, db, "ci-owner", tenantA)
	zoneUser, _ := makeSession(t, db, "ci-zone", tenantA)
	reviewer, _ := makeSession(t, db, "ci-reviewer", tenantA)
	other, _ := makeSession(t, db, "ci-other", tenantB)
	ownerView := api(t, mux, owner, "GET", "/v1/private/dashboard/plants", nil, false)
	if ownerView.Code != 200 {
		t.Fatalf("owner read: %d %s", ownerView.Code, ownerView.Body.String())
	}
	if ownerFacilities := api(t, mux, owner, "GET", "/v1/private/dashboard/facilities", nil, false); ownerFacilities.Code != 200 {
		t.Fatalf("owner facilities unavailable: %d", ownerFacilities.Code)
	}
	if !strings.Contains(ownerView.Body.String(), "Other zone plant") {
		t.Fatal("owner lost second zone")
	}
	zoneView := api(t, mux, zoneUser, "GET", "/v1/private/dashboard/plants", nil, false)
	if zoneView.Code != 200 || strings.Contains(zoneView.Body.String(), "Other zone plant") ||
		!strings.Contains(zoneView.Body.String(), "Mother") {
		t.Fatalf("facility/zone scope failed: %d %s", zoneView.Code, zoneView.Body.String())
	}
	otherView := api(t, mux, other, "GET", "/v1/private/dashboard/plants", nil, false)
	if otherView.Code != 200 || strings.Contains(otherView.Body.String(), "Mother") {
		t.Fatalf("cross tenant data exposed: %d %s", otherView.Code, otherView.Body.String())
	}
	// A zone-restricted user cannot enumerate a different facility even within their tenant.
	if zoneFacilities := api(t, mux, zoneUser, "GET", "/v1/private/dashboard/facilities", nil, false); zoneFacilities.Code != 200 ||
		!strings.Contains(zoneFacilities.Body.String(), "Test Facility") ||
		strings.Contains(zoneFacilities.Body.String(), "Restricted other facility") {
		t.Fatalf("zone member facility scope broken: %d %s", zoneFacilities.Code, zoneFacilities.Body.String())
	}
	if got := api(t, mux, reviewer, "GET", "/v1/private/dashboard/equipment", nil, false); got.Code != 403 {
		t.Fatalf("reviewer equipment authorization: %d", got.Code)
	}
	if got := api(t, mux, zoneUser, "POST", "/v1/private/action/plants", map[string]any{"operation": "create", "label": "No CSRF"}, false); got.Code != 403 {
		t.Fatalf("missing CSRF accepted: %d", got.Code)
	}
	action(t, mux, zoneUser, "facilities", map[string]any{"operation": "create", "kind": "FACILITY", "label": "Cross role"}, 403)
	action(t, mux, reviewer, "inventory", map[string]any{"operation": "adjust", "facilityId": facilityA, "zoneId": zoneA, "sourceId": "aaaaaaaa-0000-4000-8000-000000000321", "kind": "RECEIVE", "amount": 1, "reason": "No authority"}, 403)
	action(t, mux, owner, "facilities", map[string]any{"operation": "create", "kind": "FACILITY", "label": "Additional facility"}, 204)
	action(t, mux, owner, "facilities", map[string]any{"operation": "rename", "kind": "FACILITY", "id": facilityA, "label": "Renamed private facility", "revision": 1}, 204)
	action(t, mux, zoneUser, "plants", map[string]any{"operation": "create", "facilityId": facilityA, "zoneId": zoneA, "label": "New authorized seed", "state": "SEED"}, 204)
	action(t, mux, owner, "plants", map[string]any{"operation": "transition", "id": "aaaaaaaa-6666-4666-8666-666666666666", "state": "FLOWERING", "revision": 1}, 204)
	action(t, mux, zoneUser, "cultivation", map[string]any{"operation": "record", "facilityId": facilityA, "zoneId": zoneA,
		"kind": "ENVIRONMENT", "metric": "ENV_TEMPERATURE", "unit": "C", "amount": 24.5, "reason": "Manual observed reading"}, 204)
	action(t, mux, owner, "harvests", map[string]any{"operation": "record", "facilityId": facilityA, "zoneId": zoneA,
		"sourceId": "aaaaaaaa-6666-4666-8666-666666666668", "amount": 22.5}, 204)
	action(t, mux, owner, "inventory", map[string]any{"operation": "create", "facilityId": facilityA, "zoneId": zoneA,
		"kind": "INPUT", "unit": "g", "label": "Counted supply", "amount": 10}, 204)
	action(t, mux, owner, "inventory", map[string]any{"operation": "adjust", "facilityId": facilityA, "zoneId": zoneA,
		"sourceId": "aaaaaaaa-0000-4000-8000-000000000321", "kind": "RECEIVE", "amount": 5, "reason": "Counted delivery"}, 204)
	exportInput := map[string]any{"operation": "export", "facilityId": facilityA, "zoneId": zoneA,
		"sourceId": "aaaaaaaa-0000-4000-8000-000000000321", "jurisdiction": "GENERIC"}
	body := action(t, mux, reviewer, "inventory", exportInput, 200)
	if !strings.Contains(body, "INTERNAL_UNVERIFIED") || !strings.Contains(body, "LEDGER") {
		t.Fatal("CSV missing provenance and disclaimer")
	}
	action(t, mux, owner, "advice", map[string]any{"operation": "review", "facilityId": facilityA, "zoneId": zoneA,
		"sourceId": "aaaaaaaa-0000-4000-8000-000000000324", "state": "REJECTED", "reason": "Human rejected synthetic advice"}, 204)
	postLogout := api(t, mux, owner, "POST", "/v1/private/logout", nil, true)
	if postLogout.Code != 204 {
		t.Fatalf("logout: %d %s", postLogout.Code, postLogout.Body.String())
	}
	if after := api(t, mux, owner, "GET", "/v1/private/session", nil, false); after.Code != 401 {
		t.Fatalf("revoked owner cookie accepted: %d", after.Code)
	}
	// Revocation and role changes are checked against the database for every request.
	adminDSN := os.Getenv("GROW_MIGRATION_DATABASE_URL")
	admin, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	if _, err := admin.Exec(`UPDATE grow_private.memberships SET state='SUSPENDED'
	WHERE tenant_id=$1::uuid AND subject_id='ci-zone'`, tenantA); err != nil {
		t.Fatal(err)
	}
	if got := api(t, mux, zoneUser, "GET", "/v1/private/dashboard/plants", nil, false); got.Code != 401 {
		t.Fatalf("suspended member retained access: %d", got.Code)
	}
	if got := api(t, mux, zoneUser, "POST", "/v1/private/action/plants", map[string]any{
		"operation": "create", "requestId": requestID(t), "facilityId": facilityA, "zoneId": zoneA,
		"label": "revoked race", "state": "SEED"}, true); got.Code != 401 {
		t.Fatalf("suspended member could mutate: %d", got.Code)
	}
	// Outage responses must never disclose cached private records.
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	if got := api(t, mux, other, "GET", "/v1/private/dashboard/plants", nil, false); got.Code == 200 ||
		strings.Contains(got.Body.String(), "Mother") {
		t.Fatalf("database outage leaked private data: %d", got.Code)
	}
}
