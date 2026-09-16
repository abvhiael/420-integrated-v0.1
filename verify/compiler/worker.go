package compiler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/verify/submission"
)

type Limits struct {
	MaxInputBytes  int64
	MaxOutputBytes int64
	Timeout        time.Duration
}

type BuildEvidence struct {
	CompilerVersion string `json:"compilerVersion"`
	CompilerSHA256  string `json:"compilerSha256"`
	BundleHash      string `json:"bundleHash"`
	InputSHA256     string `json:"inputSha256"`
	OutputSHA256    string `json:"outputSha256"`
	NetworkDisabled bool   `json:"networkDisabled"`
	WorkingDirClean bool   `json:"workingDirClean"`
	RuntimeBytecode string `json:"runtimeBytecode,omitempty"`
	CreationBytecode string `json:"creationBytecode,omitempty"`
	CompilerOutput  json.RawMessage `json:"compilerOutput"`
}

type Worker struct {
	catalog *Catalog
	limits  Limits
}

func NewWorker(catalog *Catalog, limits Limits) (*Worker, error) {
	if catalog == nil { return nil, errors.New("compiler catalogue is required") }
	if limits.MaxInputBytes <= 0 || limits.MaxOutputBytes <= 0 || limits.Timeout <= 0 { return nil, errors.New("positive compiler limits are required") }
	return &Worker{catalog:catalog, limits:limits}, nil
}

func (w *Worker) Compile(ctx context.Context, s submission.Submission) (BuildEvidence, error) {
	if err := s.ValidateCommitment(); err != nil { return BuildEvidence{}, err }
	input, err := standardJSONFor(s); if err != nil { return BuildEvidence{}, err }
	if int64(len(input)) > w.limits.MaxInputBytes { return BuildEvidence{}, errors.New("compiler input exceeds limit") }
	release, binary, err := w.catalog.Resolve(s.Build.CompilerVersion); if err != nil { return BuildEvidence{}, err }
	if err := verifyFileSHA256(binary, release.SHA256); err != nil { return BuildEvidence{}, err }
	workdir, err := os.MkdirTemp("", "420verify-build-"); if err != nil { return BuildEvidence{}, err }
	defer os.RemoveAll(workdir)

	timeoutCtx, cancel := context.WithTimeout(ctx, w.limits.Timeout); defer cancel()
	cmd := exec.CommandContext(timeoutCtx, binary, "--standard-json")
	cmd.Dir = workdir
	cmd.Env = []string{"PATH=/nonexistent", "HOME=" + workdir, "TMPDIR=" + workdir, "NO_PROXY=*", "HTTP_PROXY=http://127.0.0.1:9", "HTTPS_PROXY=http://127.0.0.1:9"}
	cmd.Stdin = strings.NewReader(string(input))
	output, err := cmd.Output()
	if timeoutCtx.Err() == context.DeadlineExceeded { return BuildEvidence{}, errors.New("compiler timeout exceeded") }
	if err != nil { return BuildEvidence{}, fmt.Errorf("compiler execution failed: %w", err) }
	if int64(len(output)) > w.limits.MaxOutputBytes { return BuildEvidence{}, errors.New("compiler output exceeds limit") }
	if !json.Valid(output) { return BuildEvidence{}, errors.New("compiler output is not valid JSON") }

	runtimeCode, creationCode := extractBytecode(output)
	inHash := sha256.Sum256(input); outHash := sha256.Sum256(output)
	return BuildEvidence{
		CompilerVersion:release.Version, CompilerSHA256:release.SHA256, BundleHash:s.BundleHash,
		InputSHA256:"sha256:"+hex.EncodeToString(inHash[:]), OutputSHA256:"sha256:"+hex.EncodeToString(outHash[:]),
		NetworkDisabled:true, WorkingDirClean:true, RuntimeBytecode:runtimeCode, CreationBytecode:creationCode,
		CompilerOutput:append(json.RawMessage(nil), output...),
	}, nil
}

func standardJSONFor(s submission.Submission) ([]byte,error) {
	if s.Kind == submission.InputStandardJSON { return append([]byte(nil), s.StandardJSON...), nil }
	sources := map[string]map[string]string{}
	for _, f := range s.Sources { sources[f.Path] = map[string]string{"content":f.Content} }
	libraries := map[string]map[string]string{}
	for _, l := range s.Build.Libraries {
		if libraries[l.Source] == nil { libraries[l.Source] = map[string]string{} }
		libraries[l.Source][l.Library] = l.Address
	}
	settings := map[string]any{
		"optimizer":map[string]any{"enabled":s.Build.OptimizerEnabled,"runs":s.Build.OptimizerRuns},
		"evmVersion":s.Build.EVMVersion,"viaIR":s.Build.ViaIR,
		"metadata":map[string]any{"bytecodeHash":s.Build.MetadataHashMode},
		"libraries":libraries,
		"outputSelection":map[string]any{"*":map[string]any{"*":[]string{"evm.bytecode.object","evm.deployedBytecode.object"}}},
	}
	return json.Marshal(map[string]any{"language":"Solidity","sources":sources,"settings":settings})
}

func verifyFileSHA256(path, expected string) error {
	data, err := os.ReadFile(filepath.Clean(path)); if err != nil { return err }
	sum:=sha256.Sum256(data); actual:=hex.EncodeToString(sum[:]); expected=strings.TrimPrefix(strings.ToLower(expected),"sha256:")
	if actual != expected { return fmt.Errorf("compiler sha256 mismatch: expected=%s actual=%s",expected,actual) }
	return nil
}

func extractBytecode(raw []byte) (string,string) {
	var doc struct{ Contracts map[string]map[string]struct{ EVM struct{ Bytecode struct{Object string `json:"object"`} `json:"bytecode"`; Deployed struct{Object string `json:"object"`} `json:"deployedBytecode"` } `json:"evm"` } `json:"contracts"` }
	if json.Unmarshal(raw,&doc)!=nil { return "","" }
	for _, byName := range doc.Contracts { for _, c := range byName { return "0x"+c.EVM.Deployed.Object, "0x"+c.EVM.Bytecode.Object } }
	return "",""
}
