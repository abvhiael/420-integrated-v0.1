//go:build blst

// stake-operator-init performs explicit local first-use provisioning only.
// It never registers, signs a duty, creates a witness, repairs or resets history.
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/signing"
	"github.com/420integrated/420-integrated/consensus/slashing"
)

type publicMaterial struct {
	PublicKey string `json:"publicKey"`
	Proof     string `json:"proofOfPossession"`
}

func writeExclusive(path string, raw []byte, mode os.FileMode) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
	if e != nil {
		return e
	}
	defer f.Close()
	if _, e = f.Write(raw); e != nil {
		return e
	}
	if e = f.Sync(); e != nil {
		return e
	}
	return f.Close()
}
func syncDir(path string) error {
	f, e := os.Open(path)
	if e != nil {
		return e
	}
	defer f.Close()
	return f.Sync()
}
func generate(dir string, output io.Writer) error {
	abs, e := filepath.Abs(dir)
	if e != nil {
		return e
	}
	parent := filepath.Dir(abs)
	resolved, e := filepath.EvalSymlinks(parent)
	if e != nil || resolved != parent {
		return errors.New("private non-aliased parent required")
	}
	st, e := os.Stat(parent)
	if e != nil || st.Mode().Perm()&0077 != 0 {
		return errors.New("private parent required")
	}
	seed := make([]byte, 32)
	defer clear(seed)
	if _, e = rand.Read(seed); e != nil {
		return e
	}
	key, pk, e := bls.SecretFromIKM(seed)
	if e != nil {
		return e
	}
	defer key.Destroy()
	proof, e := key.ProofOfPossession(pk)
	if e != nil || !bls.VerifyProofOfPossession(pk, proof) {
		return errors.New("BLS proof generation failed")
	}
	// Creating the directory is exclusive. Failed/partial provisioning is retained
	// for investigation, never deleted and retried with a different identity.
	if e = os.Mkdir(abs, 0700); e != nil {
		return e
	}
	raw := make([]byte, hex.EncodedLen(len(seed)))
	defer clear(raw)
	hex.Encode(raw, seed)
	if e = writeExclusive(filepath.Join(abs, "bls.hex"), raw, 0600); e != nil {
		return e
	}
	public := publicMaterial{"0x" + hex.EncodeToString(pk[:]), "0x" + hex.EncodeToString(proof[:])}
	b, e := json.MarshalIndent(public, "", "  ")
	if e != nil {
		return e
	}
	if e = writeExclusive(filepath.Join(abs, "public.json"), append(b, '\n'), 0644); e != nil {
		return e
	}
	if e = syncDir(abs); e != nil {
		return e
	}
	if e = syncDir(parent); e != nil {
		return e
	}
	return json.NewEncoder(output).Encode(public)
}
func run(args []string, output, diagnostic io.Writer) error {
	f := flag.NewFlagSet("stake-operator-init", flag.ContinueOnError)
	f.SetOutput(diagnostic)
	dir := f.String("generate-key-dir", "", "create a NEW private directory containing random BLS IKM and public proof")
	first := f.Bool("initialize-never-used-validator-history", false, "explicitly initialize local validator history for an independently approved NEVER-USED identity")
	policy := f.String("policy", "", "approved policy JSON file")
	pin := f.String("policy-sha256", "", "independent approved policy SHA-256")
	history := f.String("history", "", "new private validator history path; never overwrite")
	if e := f.Parse(args); e != nil {
		return e
	}
	if f.NArg() != 0 || ((*dir != "") == *first) {
		return errors.New("choose exactly one first-use operation")
	}
	if *dir != "" {
		if *policy != "" || *pin != "" || *history != "" {
			return errors.New("key generation excludes history arguments")
		}
		return generate(*dir, output)
	}
	if *history == "" {
		return errors.New("history path required")
	}
	p, e := signing.LoadPolicy(*policy, *pin)
	if e != nil {
		return e
	}
	if e = slashing.InitializeHistory(*history, p.Identity); e != nil {
		return e
	}
	_, e = fmt.Fprintln(output, "never-used validator history initialized")
	return e
}
func main() {
	if e := run(os.Args[1:], os.Stdout, os.Stderr); e != nil {
		if errors.Is(e, flag.ErrHelp) {
			return
		}
		fmt.Fprintln(os.Stderr, "STAKE_OPERATOR_INITIALIZATION_FAILED")
		os.Exit(1)
	}
}
