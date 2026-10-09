//go:build grow_integration

package dashboard

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

func TestMutualTLSIdentitySessionAndCertificateRevocation(t *testing.T) {
	db := integrationDB(t)
	adminDSN := os.Getenv("GROW_MIGRATION_DATABASE_URL")
	if adminDSN == "" {
		t.Fatal("operator database DSN required for client certificate enrolment fixture")
	}
	admin, err := sql.Open("postgres", adminDSN)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()

	now := time.Now().UTC()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), NotBefore: now.Add(-time.Minute),
		NotAfter: now.Add(time.Hour), IsCA: true, BasicConstraintsValid: true,
		KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageCRLSign}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	parsedCA, err := x509.ParseCertificate(caDER)
	if err != nil {
		t.Fatal(err)
	}

	clientKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	san, err := url.Parse("spiffe://420integrated.org/grow/tenants/" + tenantA + "/subjects/ci-owner")
	if err != nil {
		t.Fatal(err)
	}
	leaf := &x509.Certificate{SerialNumber: big.NewInt(2), NotBefore: now.Add(-time.Minute),
		NotAfter: now.Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, URIs: []*url.URL{san}}
	leafDER, err := x509.CreateCertificate(rand.Reader, leaf, parsedCA, &clientKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	fp := sha256.Sum256(leafDER)
	_, err = admin.Exec(`INSERT INTO grow_private.dashboard_identities
(tenant_id,subject_id,cert_fingerprint,enabled)
VALUES($1::uuid,'ci-owner',$2,true)`, tenantA, fp[:])
	if err != nil {
		t.Fatalf("certificate enrollment: %v", err)
	}

	mux := http.NewServeMux()
	if err = MountPrivate(mux, db); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewUnstartedServer(mux)
	pool := x509.NewCertPool()
	pool.AddCert(parsedCA)
	srv.TLS = &tls.Config{MinVersion: tls.VersionTLS13, ClientAuth: tls.VerifyClientCertIfGiven, ClientCAs: pool}
	srv.StartTLS()
	defer srv.Close()
	transport := srv.Client().Transport.(*http.Transport).Clone()
	transport.TLSClientConfig.Certificates = []tls.Certificate{{
		Certificate: [][]byte{leafDER, caDER}, PrivateKey: clientKey,
	}}
	client := &http.Client{Transport: transport, Timeout: 5 * time.Second}

	request, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/private/login", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", srv.URL)
	resp, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != 204 || len(resp.Cookies()) != 1 {
		t.Fatalf("mTLS certificate sign-in rejected: %d", resp.StatusCode)
	}
	cookie := resp.Cookies()[0]
	visit := func(client *http.Client) (int, error) {
		r, e := http.NewRequest(http.MethodGet, srv.URL+"/v1/private/session", nil)
		if e != nil {
			return 0, e
		}
		r.AddCookie(cookie)
		response, e := client.Do(r)
		if e != nil {
			return 0, e
		}
		defer response.Body.Close()
		return response.StatusCode, nil
	}
	status, err := visit(client)
	if err != nil || status != 200 {
		t.Fatalf("mTLS session read %d %v", status, err)
	}

	// Forged identity headers and a subject string alone are never accepted.
	untrusted := srv.Client()
	bad, err := http.NewRequest(http.MethodPost, srv.URL+"/v1/private/login", nil)
	if err != nil {
		t.Fatal(err)
	}
	bad.Header.Set("Origin", srv.URL)
	bad.Header.Set("X-Forwarded-Client-Cert", "spiffe://420integrated.org/grow/tenants/"+tenantA+"/subjects/ci-owner")
	denied, err := untrusted.Do(bad)
	if err != nil {
		t.Fatal(err)
	}
	_ = denied.Body.Close()
	if denied.StatusCode != 401 {
		t.Fatalf("unverified proxy certificate spoof accepted: %d", denied.StatusCode)
	}

	_, err = admin.Exec(`UPDATE grow_private.dashboard_identities
SET enabled=false,revoked_at=now()
WHERE tenant_id=$1::uuid AND subject_id='ci-owner' AND cert_fingerprint=$2`, tenantA, fp[:])
	if err != nil {
		t.Fatal(err)
	}
	status, err = visit(client)
	if err != nil || status != 401 {
		t.Fatalf("revoked enrolled certificate retained session: %d %v", status, err)
	}
}
