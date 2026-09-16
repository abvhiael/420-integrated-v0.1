package storage

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestProductionCredentialRotationOverlapAndExpiry(t *testing.T) {
	manager := NewProductionCredentialManager()
	if err := manager.Register("gateway-a", "old-secret-420"); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	if err := manager.Rotate("gateway-a", "old-secret-420", "new-secret-420", now, 5*time.Minute); err != nil {
		t.Fatal(err)
	}
	if !manager.Validate("gateway-a", "old-secret-420", now.Add(4*time.Minute)) {
		t.Fatal("old credential should remain valid during bounded overlap")
	}
	if manager.Validate("gateway-a", "old-secret-420", now.Add(5*time.Minute)) {
		t.Fatal("old credential remained valid after overlap expiry")
	}
	if !manager.Validate("gateway-a", "new-secret-420", now.Add(30*time.Minute)) {
		t.Fatal("rotated credential should remain active")
	}
}

func TestProductionCredentialImmediateRotationRevokesOldSecret(t *testing.T) {
	manager := NewProductionCredentialManager()
	if err := manager.Register("store-a", "store-secret-old"); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	if err := manager.Rotate("store-a", "store-secret-old", "store-secret-new", now, 0); err != nil {
		t.Fatal(err)
	}
	if manager.Validate("store-a", "store-secret-old", now) {
		t.Fatal("zero-overlap rotation did not revoke prior credential")
	}
	if !manager.Validate("store-a", "store-secret-new", now) {
		t.Fatal("replacement credential not active")
	}
}

func TestProductionCredentialCompromiseRecovery(t *testing.T) {
	manager := NewProductionCredentialManager()
	if err := manager.Register("repair-a", "compromised-secret"); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	if err := manager.Revoke("repair-a"); err != nil {
		t.Fatal(err)
	}
	if manager.Validate("repair-a", "compromised-secret", now) {
		t.Fatal("revoked credential remained valid")
	}
	if err := manager.Recover("repair-a", "recovered-secret"); err != nil {
		t.Fatal(err)
	}
	if !manager.Validate("repair-a", "recovered-secret", now) {
		t.Fatal("recovered credential not active")
	}
	if manager.Validate("repair-a", "compromised-secret", now) {
		t.Fatal("compromised credential became valid after recovery")
	}
}

func TestProductionCredentialRotationRequiresCurrentSecret(t *testing.T) {
	manager := NewProductionCredentialManager()
	if err := manager.Register("relay-a", "current-secret"); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	if err := manager.Rotate("relay-a", "wrong-secret", "next-secret", now, time.Minute); err == nil {
		t.Fatal("rotation accepted without proving current credential")
	}
	if !manager.Validate("relay-a", "current-secret", now) {
		t.Fatal("failed rotation altered active credential")
	}
}

func TestProductionCredentialSnapshotRedactsSecretMaterial(t *testing.T) {
	manager := NewProductionCredentialManager()
	secret := "high-entropy-service-secret-that-must-not-leak"
	if err := manager.Register("gateway-a", secret); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(manager.Snapshot())
	if err != nil {
		t.Fatal(err)
	}
	text := string(encoded)
	if strings.Contains(text, secret) || strings.Contains(strings.ToLower(text), "bearer ") {
		t.Fatalf("credential material leaked into snapshot: %s", text)
	}
	if !strings.Contains(text, "generation") || !strings.Contains(text, "fingerprint") {
		t.Fatalf("snapshot missing redacted qualification evidence: %s", text)
	}
}

func TestProductionCredentialConcurrentRotationValidation(t *testing.T) {
	manager := NewProductionCredentialManager()
	if err := manager.Register("cache-a", "secret-1"); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = manager.Validate("cache-a", "secret-1", now)
			}
		}()
	}
	if err := manager.Rotate("cache-a", "secret-1", "secret-2", now, time.Minute); err != nil {
		t.Fatal(err)
	}
	wg.Wait()
	if !manager.Validate("cache-a", "secret-2", now) {
		t.Fatal("active credential unavailable after concurrent validation")
	}
}
