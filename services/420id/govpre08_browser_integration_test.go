//go:build account420_integration

package account

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	appgateway "github.com/420integrated/420-integrated/services/420id/app-gateway"
)

type govPre08AuthorityTransport struct{ authority http.Handler }

func (t govPre08AuthorityTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.Scheme != "https" || request.URL.Host != "auth.420integrated.org" {
		return nil, errors.New("unexpected SSO authority")
	}
	backend := request.Clone(request.Context())
	backend.Host = request.URL.Host
	backend.RemoteAddr = "127.0.0.2:42008"
	backend.Header.Set("X-Forwarded-Proto", "https")
	response := httptest.NewRecorder()
	t.authority.ServeHTTP(response, backend)
	return response.Result(), nil
}

// Chromium exercises the production HTTP handlers and durable SSO stores.
// The loopback-only test entry point supplies the verified test mailbox.
func TestServeGOVPRE08WalletIdentity(t *testing.T) {
	if os.Getenv("GOVPRE08_BROWSER_IDENTITY") != "local-only" {
		t.Skip("requires isolated GOV-PRE-08 browser qualification")
	}
	ctx := context.Background()
	db := sessionDB(t)
	store, err := NewStore(db, []string{"420id", "420wallet", "bong-goggles", "420town", "doobtube"})
	if err != nil {
		t.Fatal(err)
	}
	const centralHost = "auth.420integrated.org"
	const walletHost = "wallet.420integrated.org"
	const email = "govpre08-browser@example.org"
	mailer := &testMailer{}
	auth, err := NewAuth(store, mailer, "https://"+centralHost, centralHost)
	if err != nil {
		t.Fatal(err)
	}
	clients := ssoIntegrationClients()
	authority, err := NewAcceptanceHandler(auth, AcceptanceConfig{
		Emails: []string{email}, RateKey: bytes.Repeat([]byte{76}, 32),
		SessionApp: "420id", SSOClients: clients, TrustedTLSProxy: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := appgateway.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	const permissions = `
		GRANT USAGE ON SCHEMA app420_sso TO govpre08_wallet;
		GRANT SELECT,INSERT,DELETE ON app420_sso.login_flows,app420_sso.sessions TO govpre08_wallet;
		GRANT SELECT,INSERT,UPDATE,DELETE ON app420_sso.rate_buckets TO govpre08_wallet;`
	if _, err := db.ExecContext(ctx, permissions); err != nil {
		t.Fatal(err)
	}
	runtimeDB, err := sql.Open("postgres", os.Getenv("GOVPRE08_WALLET_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer runtimeDB.Close()
	secret, err := decodeToken(clients[2].Secret)
	if err != nil {
		t.Fatal(err)
	}
	gateway, err := appgateway.New(appgateway.Config{
		AppID: "420wallet", DB: runtimeDB, ClientSecret: secret,
		SessionKey: bytes.Repeat([]byte{77}, 32), TrustedTLSProxy: true,
		Client: &http.Client{Transport: govPre08AuthorityTransport{authority}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := gateway.Ready(ctx); err != nil {
		t.Fatal(err)
	}
	grants := make(chan SessionGrant, 3)
	for i := 0; i < cap(grants); i++ {
		verified := freshEmail(t, auth, mailer, email)
		grants <- mustIssueSession(t, authority.sessions, verified.Proof)
	}
	close(grants)
	root := os.Getenv("GOVPRE08_WALLET_WEB_ROOT")
	runtime, err := os.ReadFile(os.Getenv("GOVPRE08_WALLET_CONFIG"))
	if root == "" || err != nil {
		t.Fatal("source-bound Wallet assets and runtime required", err)
	}
	indexer, err := url.Parse("http://127.0.0.1:18784")
	if err != nil {
		t.Fatal(err)
	}
	files := http.FileServer(http.Dir(root))
	proxy := httputil.NewSingleHostReverseProxy(indexer)
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Host {
		case walletHost:
			switch {
			case strings.HasPrefix(r.URL.Path, appgateway.APIPath):
				gateway.ServeHTTP(w, r)
			case r.URL.Path == "/runtime-config.json":
				reply(w, http.StatusOK, json.RawMessage(runtime))
			case r.URL.Path == "/v1/protocols/events":
				proxy.ServeHTTP(w, r)
			default:
				files.ServeHTTP(w, r)
			}
		case centralHost:
			if r.URL.Path == "/__qualification/session" && r.Method == http.MethodGet {
				grant, available := <-grants
				if !available {
					http.Error(w, "qualification mailbox unavailable", http.StatusGone)
					return
				}
				setSessionCookie(w, grant)
				w.Header().Set("Cache-Control", "no-store")
				w.WriteHeader(http.StatusOK)
				return
			}
			authority.ServeHTTP(w, r)
		default:
			http.NotFound(w, r)
		}
	}))
	server.Listener.Close()
	server.Listener, err = net.Listen("tcp4", "127.0.0.1:18785")
	if err != nil {
		t.Fatal(err)
	}
	server.Config.ReadHeaderTimeout = 5 * time.Second
	server.StartTLS()
	defer server.Close()
	select {}
}
