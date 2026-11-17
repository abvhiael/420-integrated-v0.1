package telemetry

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestHealthNeverSerializesErrorsCredentialsOrKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "health.json")
	w := New(path, "signer")
	w.Set("READY")
	w.Failure(errors.New("postgres://operator:private-password@host secret-key=0123456789abcdef"))
	w.Close(nil)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var h Health
	if json.Unmarshal(raw, &h) != nil || h.Validate() != nil || h.Status != "SIGNING_PROTECTION_FAILURE" {
		t.Fatal(string(raw))
	}
	for _, secret := range []string{"postgres", "private-password", "0123456789abcdef", "operator", "host"} {
		if strings.Contains(string(raw), secret) {
			t.Fatal("secret exported")
		}
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0644 {
		t.Fatal("categorical health must be readable without private journal access")
	}
}
func TestPersistenceCategoricalAndAtomicFailure(t *testing.T) {
	path := filepath.Join(t.TempDir(), "health.json")
	w := New(path, "settlement")
	w.Failure(&os.PathError{Op: "write", Path: "/private/jwt-or-key", Err: os.ErrPermission})
	w.Close(nil)
	raw, _ := os.ReadFile(path)
	if !strings.Contains(string(raw), "PERSISTENCE_FAILURE") || strings.Contains(string(raw), "private") {
		t.Fatal(string(raw))
	}
	if err := Atomic(filepath.Join(path, "invalid"), []byte("x")); err == nil {
		t.Fatal("write failure hidden")
	}
}

func TestHealthCannotOverwriteAKeyJournalOrCredential(t *testing.T) {
	for _, secret := range []string{"private-signing-key", `{"Schema":"420-stake-systemcall-sequence-v2","lastSequence":7}`, "postgres://user:private@host"} {
		path := filepath.Join(t.TempDir(), "private-file")
		os.WriteFile(path, []byte(secret), 0600)
		w := New(path, "signer")
		w.Set("READY")
		w.Close(nil)
		raw, _ := os.ReadFile(path)
		if string(raw) != secret {
			t.Fatal("telemetry overwrote private authority")
		}
	}
}
func TestSettlementCodesNeverEmitRPCSecrets(t *testing.T) {
	for _, tc := range []struct {
		input, code string
		sequence    uint64
	}{{"execution rejected certified settlement; restart reconciliation required: INVALID secret=abc", "EXECUTION_REJECTED", 0}, {"INVALID 420 system call sequence 7: execution reverted: token=secret", "EXECUTION_NATIVE_CALL_REJECTED", 7}, {"history missing durable settled checkpoint password=secret", "DURABLE_SETTLEMENT_HISTORY_MISSING", 0}, {"https://user:secret@host/", "SETTLEMENT_UNAVAILABLE", 0}} {
		code, sequence := SettlementCode(errors.New(tc.input))
		if code != tc.code || sequence != tc.sequence {
			t.Fatal(code, sequence)
		}
	}
}

func TestUnknownPrivateFieldsCannotBeOverwrittenAsHealth(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private.json")
	raw := []byte(`{"schema":"420-stake-runtime-health-v1","component":"signer","observedAt":"2026-11-17T12:00:00Z","status":"READY","privateKey":"secret"}`)
	os.WriteFile(path, raw, 0600)
	w := New(path, "signer")
	w.Close(nil)
	after, _ := os.ReadFile(path)
	if string(after) != string(raw) {
		t.Fatal("private data was overwritten")
	}
}
