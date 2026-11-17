//go:build blst

package main

// LOCAL QUALIFICATION ONLY: the seed is public and must never protect value.
// This adapter requires the production typed-duty process and remote witnessed
// signer for seat zero; it cannot substitute the known fixture key on failure.
import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/signing"
	"github.com/420integrated/420-integrated/consensus/slashing"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

type protectedConfig struct {
	Policy   signing.Policy
	NodeArgs []string
}

func provisionProtected(dir string) {
	t, ks := keys()
	for _, k := range ks {
		defer k.Destroy()
	}
	p := signing.Policy{Identity: slashing.HistoryIdentity{ChainID: 420, Genesis: t.Genesis.Root, ValidatorID: 96, PublicKey: t.Members[0].PublicKey}, ProtocolVersion: 1, CommitteeRoot: t.CommitteeRoot, Seat: 0}
	must := func(e error) {
		if e != nil {
			panic(e)
		}
	}
	for _, d := range []string{"signer", "validator"} {
		must(os.Mkdir(filepath.Join(dir, d), 0700))
	}
	raw, e := json.Marshal(p)
	must(e)
	for _, d := range []string{"signer", "validator"} {
		must(os.WriteFile(filepath.Join(dir, d, "policy.json"), raw, 0600))
	}
	seed := sha256.Sum256([]byte("INSECURE-LOCAL-RECOVERY-KEY-0"))
	must(os.WriteFile(filepath.Join(dir, "signer", "bls.hex"), []byte(hex.EncodeToString(seed[:])), 0600))
	must(slashing.InitializeHistory(filepath.Join(dir, "validator", "history.json"), p.Identity))
	json.NewEncoder(os.Stdout).Encode(p)
}
func protectedVote(configPath string, cert ct.QuorumCertificate, source ct.Checkpoint) (ct.BLSSignature, error) {
	var c protectedConfig
	raw, e := os.ReadFile(configPath)
	if e != nil {
		return ct.BLSSignature{}, e
	}
	if e = json.Unmarshal(raw, &c); e != nil {
		return ct.BLSSignature{}, e
	}
	duty := signing.Duty{ChainID: 420, Genesis: c.Policy.Identity.Genesis, ValidatorID: c.Policy.Identity.ValidatorID, ProtocolVersion: 1, Kind: "qc-vote", Vote: &ct.AttestationData{Slot: cert.Slot, BlockRoot: cert.BlockRoot, ParentRoot: cert.ParentRoot, Source: source, Target: ct.Checkpoint{Slot: cert.Slot, Root: cert.BlockRoot}}}
	raw, e = json.Marshal(duty)
	if e != nil {
		return ct.BLSSignature{}, e
	}
	cmd := exec.Command(c.NodeArgs[0], c.NodeArgs[1:]...)
	cmd.Stdin = bytes.NewReader(append(raw, '\n'))
	cmd.Stderr = os.Stderr
	out, e := cmd.Output()
	if e != nil {
		return ct.BLSSignature{}, fmt.Errorf("protected quorum vote unavailable")
	}
	var response struct{ Result signing.Result }
	if e = json.Unmarshal(out, &response); e != nil {
		return ct.BLSSignature{}, e
	}
	root, e := c.Policy.Root(duty)
	if e != nil {
		return ct.BLSSignature{}, e
	}
	if response.Result.PublicKey != c.Policy.Identity.PublicKey || response.Result.SigningRoot != root || !bls.Verify(response.Result.PublicKey, root[:], response.Result.Signature) {
		return ct.BLSSignature{}, fmt.Errorf("protected vote verification failed")
	}
	return response.Result.Signature, nil
}
