//go:build blst

package signing

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestReadOnlySemanticHealthPreservesProtectionAndRejectsDivergence(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	signer, protector, _, path := protected(t, p, ikm, db)
	before, _ := protector.Snapshot()
	var generation uint64
	if err := db.QueryRow(`select generation from stake_signing_witness_v1 where identity=$1`, identityKey(p)).Scan(&generation); err != nil {
		t.Fatal(err)
	}
	f := transportFiles(t)
	serverConfig, _ := MutualTLS(f.certs["server"], f.roots, f.pins["client"], true)
	observed := make(chan error, 10)
	server := httptest.NewUnstartedServer(ObservingHandler(signer, f.pins["client"], func(err error) { observed <- err }))
	server.TLS = serverConfig
	server.StartTLS()
	defer server.Close()
	clientConfig, _ := MutualTLS(f.certs["client"], f.roots, f.pins["server"], false)
	_, local := history(t, p)
	defer local.Close()
	client, err := NewClient(server.URL, clientConfig, p, local)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	for i := 0; i < 3; i++ {
		if err = client.Health(context.Background()); err != nil {
			t.Fatal(err)
		}
		if e := <-observed; e != nil {
			t.Fatal(e)
		}
	}
	after, _ := protector.Snapshot()
	if !bytes.Equal(before, after) {
		t.Fatal("health probe reserved history")
	}
	var next uint64
	db.QueryRow(`select generation from stake_signing_witness_v1 where identity=$1`, identityKey(p)).Scan(&next)
	if next != generation {
		t.Fatal("health probe advanced witness")
	}
	if err = os.WriteFile(path, []byte("corrupted private history"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = client.Health(context.Background()); err == nil {
		t.Fatal("health accepted corrupt protection")
	}
	if e := <-observed; e == nil {
		t.Fatal("failure not observed")
	}
	unauth := httptest.NewRecorder()
	Handler(signer, f.pins["client"]).ServeHTTP(unauth, httptest.NewRequest(http.MethodGet, "/v1/health", nil))
	if unauth.Code != http.StatusUnauthorized {
		t.Fatal("health bypassed mTLS")
	}
}
