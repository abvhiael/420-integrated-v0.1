package mail

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func seedCrossPlatformIdentity(t *testing.T, store MailStore) {
	t.Helper()
	err := store.Update(context.Background(), func(data *storeData) error {
		data.DiscordSync[discordSyncStateKey("alice.420", "discord:123456789012345678")] = DiscordSyncState{
			Owner: "alice.420", ConnectionID: "discord:123456789012345678", Cursor: "d1",
			LastSyncAt: time.Unix(1700001100, 0).UTC(), Version: 1,
		}
		data.TelegramSync[telegramSyncStateKey("alice.420", "telegram:1234567890")] = TelegramSyncState{
			Owner: "alice.420", ConnectionID: "telegram:1234567890", Cursor: "t1",
			LastSyncAt: time.Unix(1700001200, 0).UTC(), Version: 1,
		}
		data.DiscordSync[discordSyncStateKey("charlie.420", "discord:223456789012345678")] = DiscordSyncState{
			Owner: "charlie.420", ConnectionID: "discord:223456789012345678", Cursor: "d2",
			LastSyncAt: time.Unix(1700001300, 0).UTC(), Version: 1,
		}
		data.DiscordWalletVerifications["handoff-wallet"] = DiscordWalletVerificationState{
			HandoffID: "handoff-wallet", Owner: "alice.420", ConnectionID: "discord:123456789012345678",
			DiscordUserID: "123456789012345678", ChainID: 1, Account: "0x1111111111111111111111111111111111111111",
			PayloadDigest: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			ExpiresAt:     time.Unix(1700001800, 0).UTC(), Verified: true,
			VerifiedAt: time.Unix(1700001400, 0).UTC(), Version: 2,
		}
		data.DiscordWalletVerifications["handoff-unverified"] = DiscordWalletVerificationState{
			HandoffID: "handoff-unverified", Owner: "alice.420", ConnectionID: "discord:323456789012345678",
			DiscordUserID: "323456789012345678", ChainID: 1, Account: "0x2222222222222222222222222222222222222222",
			PayloadDigest: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			ExpiresAt:     time.Unix(1700001900, 0).UTC(), Verified: false, Version: 1,
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCrossPlatformIdentityUnifiesQualifiedEvidence(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	svc := NewService(nil, nil, nil, nil, store)

	out, err := svc.CrossPlatformIdentity(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if out.Identity != "alice.420" || len(out.Accounts) != 2 {
		t.Fatalf("unexpected identity: %+v", out)
	}
	if out.Accounts[0].Provider != DiscordProvider || out.Accounts[0].Assurance != VerifiedIdentityWallet {
		t.Fatalf("Discord wallet proof did not supersede provider evidence: %+v", out.Accounts[0])
	}
	if out.Accounts[0].ExternalID != "123456789012345678" ||
		out.Accounts[0].ChainID != 1 ||
		out.Accounts[0].Account != "0x1111111111111111111111111111111111111111" ||
		!out.Accounts[0].VerifiedAt.Equal(time.Unix(1700001400, 0).UTC()) {
		t.Fatalf("Discord wallet identity mismatch: %+v", out.Accounts[0])
	}
	if out.Accounts[1].Provider != TelegramProvider ||
		out.Accounts[1].Assurance != VerifiedIdentityProviderAuthority ||
		out.Accounts[1].ExternalID != "1234567890" {
		t.Fatalf("Telegram provider identity mismatch: %+v", out.Accounts[1])
	}
}

func TestCrossPlatformIdentityDoesNotPromoteUnverifiedDiscordWalletState(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	svc := NewService(nil, nil, nil, nil, store)
	out, err := svc.CrossPlatformIdentity(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, account := range out.Accounts {
		if account.ConnectionID == "discord:323456789012345678" {
			t.Fatalf("unverified Discord wallet state promoted: %+v", account)
		}
	}
}

func TestCrossPlatformIdentityIsOwnerIsolated(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	svc := NewService(nil, nil, nil, nil, store)
	out, err := svc.CrossPlatformIdentity(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, account := range out.Accounts {
		if account.ConnectionID == "discord:223456789012345678" {
			t.Fatalf("foreign identity leaked: %+v", account)
		}
	}
}

func TestCrossPlatformIdentityRejectsUnauthenticatedActor(t *testing.T) {
	svc := NewService(nil, nil, nil, nil, NewMemoryStore())
	if _, err := svc.CrossPlatformIdentity(context.Background(), ""); err != ErrUnauthorized {
		t.Fatalf("unauthenticated identity accepted: %v", err)
	}
}

func TestCrossPlatformIdentityProviderEvidenceHasNoWalletFields(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	svc := NewService(nil, nil, nil, nil, store)
	out, err := svc.CrossPlatformIdentity(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	for _, account := range out.Accounts {
		if account.Assurance == VerifiedIdentityProviderAuthority && (account.ChainID != 0 || account.Account != "") {
			t.Fatalf("provider-only evidence was falsely promoted to wallet proof: %+v", account)
		}
	}
}

func TestCrossPlatformIdentityOrderingIsDeterministic(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	svc := NewService(nil, nil, nil, nil, store)
	out, err := svc.CrossPlatformIdentity(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Accounts) != 2 || out.Accounts[0].Provider != DiscordProvider || out.Accounts[1].Provider != TelegramProvider {
		t.Fatalf("unexpected deterministic ordering: %+v", out.Accounts)
	}
}

func TestHTTPCrossPlatformIdentity(t *testing.T) {
	store := NewMemoryStore()
	seedCrossPlatformIdentity(t, store)
	h := HTTPHandler{
		Service: NewService(nil, nil, nil, nil, store),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/identity", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out CrossPlatformVerifiedIdentity
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Identity != "alice.420" || len(out.Accounts) != 2 {
		t.Fatalf("unexpected response: %+v", out)
	}
}

func TestHTTPCrossPlatformIdentityRequiresAuthentication(t *testing.T) {
	h := HTTPHandler{
		Service: NewService(nil, nil, nil, nil, NewMemoryStore()),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/integrations/identity", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}
