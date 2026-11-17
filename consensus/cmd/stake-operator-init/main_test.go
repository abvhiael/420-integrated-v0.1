//go:build blst

package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/signing"
	"github.com/420integrated/420-integrated/consensus/slashing"
)

func TestFirstUseKeysAndHistoryCannotOverwriteOrLeak(t *testing.T) {
	parent := t.TempDir()
	os.Chmod(parent, 0700)
	dir := filepath.Join(parent, "key")
	var out, diag bytes.Buffer
	if e := run([]string{"--generate-key-dir", dir}, &out, &diag); e != nil {
		t.Fatal(e)
	}
	raw, e := signing.PrivateFile(filepath.Join(dir, "bls.hex"))
	if e != nil {
		t.Fatal(e)
	}
	seed, e := hex.DecodeString(string(raw))
	if e != nil || len(seed) != 32 {
		t.Fatal("invalid private IKM")
	}
	defer clear(seed)
	key, pk, e := bls.SecretFromIKM(seed)
	if e != nil {
		t.Fatal(e)
	}
	defer key.Destroy()
	var pub publicMaterial
	if e = json.Unmarshal(out.Bytes(), &pub); e != nil {
		t.Fatal(e)
	}
	if pub.PublicKey != "0x"+hex.EncodeToString(pk[:]) || bytes.Contains(out.Bytes(), raw) || bytes.Contains(diag.Bytes(), raw) {
		t.Fatal("public output wrong or secret escaped")
	}
	proof, e := key.ProofOfPossession(pk)
	if e != nil || pub.Proof != "0x"+hex.EncodeToString(proof[:]) {
		t.Fatal("wrong proof")
	}
	if e = run([]string{"--generate-key-dir", dir}, &out, &diag); e == nil {
		t.Fatal("key overwritten")
	}
	preserved, _ := os.ReadFile(filepath.Join(dir, "bls.hex"))
	if !bytes.Equal(raw, preserved) {
		t.Fatal("key changed")
	}
	p := signing.Policy{Identity: slashing.HistoryIdentity{ChainID: 420, Genesis: sha256.Sum256([]byte("approved genesis")), ValidatorID: 1, PublicKey: pk}, ProtocolVersion: 1, CommitteeRoot: sha256.Sum256([]byte("approved committee"))}
	policy := filepath.Join(parent, "policy.json")
	b, _ := json.Marshal(p)
	os.WriteFile(policy, b, 0600)
	pin := sha256.Sum256(b)
	history := filepath.Join(parent, "history.json")
	args := []string{"--initialize-never-used-validator-history", "--policy", policy, "--policy-sha256", hex.EncodeToString(pin[:]), "--history", history}
	if e = run(args, &out, &diag); e != nil {
		t.Fatal(e)
	}
	h, e := slashing.OpenProtector(history, p.Identity)
	if e != nil {
		t.Fatal(e)
	}
	h.Close()
	before, _ := os.ReadFile(history)
	if e = run(args, &out, &diag); e == nil {
		t.Fatal("history overwritten")
	}
	after, _ := os.ReadFile(history)
	if !bytes.Equal(before, after) {
		t.Fatal("history changed")
	}
}
func TestFirstUseRejectsAliasedPublicParentsAndAmbiguousMode(t *testing.T) {
	p := t.TempDir()
	os.Chmod(p, 0755)
	var out bytes.Buffer
	if e := generate(filepath.Join(p, "key"), &out); e == nil {
		t.Fatal("public parent accepted")
	}
	os.Chmod(p, 0700)
	alias := filepath.Join(p, "alias")
	os.Symlink(p, alias)
	if e := generate(filepath.Join(alias, "key"), &out); e == nil {
		t.Fatal("aliased parent accepted")
	}
	for _, args := range [][]string{nil, {"--generate-key-dir", filepath.Join(p, "key"), "--initialize-never-used-validator-history"}, {"--generate-key-dir", filepath.Join(p, "key"), "--policy", "unexpected"}} {
		if e := run(args, &out, &out); e == nil {
			t.Fatal("ambiguous operation accepted")
		}
	}
}
