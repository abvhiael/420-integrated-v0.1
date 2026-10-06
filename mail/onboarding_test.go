package mail

import (
	"context"
	"errors"
	"testing"
	"time"
)

type onboardingAuthorityStub struct {
	result OnboardingResult
	err    error
	calls  []OnboardingMethod
}

func (s *onboardingAuthorityStub) Google(context.Context, string) (OnboardingResult, error) {
	s.calls = append(s.calls, OnboardingGoogle)
	return s.result, s.err
}
func (s *onboardingAuthorityStub) Apple(context.Context, string) (OnboardingResult, error) {
	s.calls = append(s.calls, OnboardingApple)
	return s.result, s.err
}
func (s *onboardingAuthorityStub) Passkey(context.Context, string) (OnboardingResult, error) {
	s.calls = append(s.calls, OnboardingPasskey)
	return s.result, s.err
}
func (s *onboardingAuthorityStub) ExistingWallet(context.Context, string, string, string) (OnboardingResult, error) {
	s.calls = append(s.calls, OnboardingExistingWallet)
	return s.result, s.err
}

func validOnboardingResult(method OnboardingMethod) OnboardingResult {
	return OnboardingResult{
		Method:           method,
		Identity:         "alice.420",
		WalletAddress:    "0x1111111111111111111111111111111111111111",
		SessionToken:     "opaque-wallet-identity-session",
		SessionExpiresAt: time.Unix(1700003600, 0).UTC(),
		NonCustodial:     true,
	}
}

func TestOnboardingMethodsDelegateToCanonicalAuthority(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	cases := []struct {
		name   string
		method OnboardingMethod
		call   func(*OnboardingService) (OnboardingResult, error)
	}{
		{"google", OnboardingGoogle, func(s *OnboardingService) (OnboardingResult, error) {
			return s.Google(context.Background(), GoogleOnboardingRequest{IDToken: "google-id-token"})
		}},
		{"apple", OnboardingApple, func(s *OnboardingService) (OnboardingResult, error) {
			return s.Apple(context.Background(), AppleOnboardingRequest{IDToken: "apple-id-token"})
		}},
		{"passkey", OnboardingPasskey, func(s *OnboardingService) (OnboardingResult, error) {
			return s.Passkey(context.Background(), PasskeyOnboardingRequest{Assertion: "webauthn-assertion"})
		}},
		{"wallet", OnboardingExistingWallet, func(s *OnboardingService) (OnboardingResult, error) {
			return s.ExistingWallet(context.Background(), WalletOnboardingRequest{
				Address: "0x1111111111111111111111111111111111111111", Challenge: "nonce-bound-challenge", Signature: "0xsigned",
			})
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			authority := &onboardingAuthorityStub{result: validOnboardingResult(tc.method)}
			svc := NewOnboardingService(authority)
			svc.Now = func() time.Time { return now }
			got, err := tc.call(svc)
			if err != nil {
				t.Fatal(err)
			}
			if got.Method != tc.method || got.Identity != "alice.420" || !got.NonCustodial {
				t.Fatalf("unexpected result: %+v", got)
			}
			if len(authority.calls) != 1 || authority.calls[0] != tc.method {
				t.Fatalf("wrong authority call: %+v", authority.calls)
			}
		})
	}
}

func TestOnboardingRejectsInvalidOrCustodialAuthorityResults(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	cases := []OnboardingResult{
		func() OnboardingResult {
			r := validOnboardingResult(OnboardingGoogle)
			r.NonCustodial = false
			return r
		}(),
		func() OnboardingResult { r := validOnboardingResult(OnboardingGoogle); r.WalletAddress = ""; return r }(),
		func() OnboardingResult { r := validOnboardingResult(OnboardingGoogle); r.SessionToken = ""; return r }(),
		func() OnboardingResult {
			r := validOnboardingResult(OnboardingGoogle)
			r.SessionExpiresAt = now
			return r
		}(),
		func() OnboardingResult { r := validOnboardingResult(OnboardingApple); return r }(),
	}
	for i, result := range cases {
		authority := &onboardingAuthorityStub{result: result}
		svc := NewOnboardingService(authority)
		svc.Now = func() time.Time { return now }
		_, err := svc.Google(context.Background(), GoogleOnboardingRequest{IDToken: "token"})
		if !errors.Is(err, ErrOnboardingInvalidResult) {
			t.Fatalf("case %d expected invalid result, got %v", i, err)
		}
	}
}

func TestOnboardingRejectsMalformedInputsBeforeAuthority(t *testing.T) {
	authority := &onboardingAuthorityStub{}
	svc := NewOnboardingService(authority)
	if _, err := svc.Google(context.Background(), GoogleOnboardingRequest{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty google token: %v", err)
	}
	if _, err := svc.Passkey(context.Background(), PasskeyOnboardingRequest{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty passkey assertion: %v", err)
	}
	if _, err := svc.ExistingWallet(context.Background(), WalletOnboardingRequest{Address: "not-an-address", Challenge: "x", Signature: "y"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("bad wallet address: %v", err)
	}
	if len(authority.calls) != 0 {
		t.Fatalf("invalid input reached authority: %+v", authority.calls)
	}
}

func TestOnboardingPropagatesAuthorityFailureWithoutFallback(t *testing.T) {
	dep := errors.New("replay rejected")
	authority := &onboardingAuthorityStub{err: dep}
	svc := NewOnboardingService(authority)
	_, err := svc.Apple(context.Background(), AppleOnboardingRequest{IDToken: "token"})
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
}
