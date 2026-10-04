package compiler

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
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
	CompilerVersion  string          `json:"compilerVersion"`
	CompilerSHA256   string          `json:"compilerSha256"`
	BundleHash       string          `json:"bundleHash"`
	InputSHA256      string          `json:"inputSha256"`
	OutputSHA256     string          `json:"outputSha256"`
	NetworkDisabled  bool            `json:"networkDisabled"`
	WorkingDirClean  bool            `json:"workingDirClean"`
	RuntimeBytecode  string          `json:"runtimeBytecode,omitempty"`
	CreationBytecode string          `json:"creationBytecode,omitempty"`
	HasImmutables    bool            `json:"hasImmutables"`
	CompilerOutput   json.RawMessage `json:"compilerOutput"`
}

type Worker struct {
	catalog *Catalog
	limits  Limits
}

func NewWorker(catalog *Catalog, limits Limits) (*Worker, error) {
	if catalog == nil {
		return nil, errors.New("compiler catalogue is required")
	}
	if limits.MaxInputBytes <= 0 || limits.MaxOutputBytes <= 0 || limits.Timeout <= 0 {
		return nil, errors.New("positive compiler limits are required")
	}
	return &Worker{catalog: catalog, limits: limits}, nil
}

func (w *Worker) Compile(ctx context.Context, s submission.Submission) (BuildEvidence, error) {
	if err := s.ValidateCommitment(); err != nil {
		return BuildEvidence{}, err
	}
	input, err := standardJSONFor(s)
	if err != nil {
		return BuildEvidence{}, err
	}
	if int64(len(input)) > w.limits.MaxInputBytes {
		return BuildEvidence{}, errors.New("compiler input exceeds limit")
	}
	release, binary, err := w.catalog.Resolve(s.Build.CompilerVersion)
	if err != nil {
		return BuildEvidence{}, err
	}
	if err := verifyFileSHA256(binary, release.SHA256); err != nil {
		return BuildEvidence{}, err
	}

	workdir, err := os.MkdirTemp("", "420verify-build-")
	if err != nil {
		return BuildEvidence{}, err
	}
	defer os.RemoveAll(workdir)

	timeoutCtx, cancel := context.WithTimeout(ctx, w.limits.Timeout)
	defer cancel()
	cmd := exec.CommandContext(timeoutCtx, binary, "--standard-json")
	cmd.Dir = workdir
	cmd.Env = []string{
		"PATH=/nonexistent",
		"HOME=" + workdir,
		"TMPDIR=" + workdir,
		"NO_PROXY=*",
		"HTTP_PROXY=http://127.0.0.1:9",
		"HTTPS_PROXY=http://127.0.0.1:9",
	}
	cmd.Stdin = bytes.NewReader(input)
	stdout := &limitedBuffer{max: w.limits.MaxOutputBytes}
	stderr := &limitedBuffer{max: 1 << 20}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	err = cmd.Run()
	if timeoutCtx.Err() == context.DeadlineExceeded {
		return BuildEvidence{}, errors.New("compiler timeout exceeded")
	}
	if stdout.exceeded {
		return BuildEvidence{}, errors.New("compiler output exceeds limit")
	}
	if err != nil {
		if stderr.exceeded {
			return BuildEvidence{}, errors.New("compiler stderr exceeds limit")
		}
		return BuildEvidence{}, fmt.Errorf("compiler execution failed: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	output := stdout.Bytes()
	if !json.Valid(output) {
		return BuildEvidence{}, errors.New("compiler output is not valid JSON")
	}

	runtimeCode, creationCode, hasImmutables, err := extractBytecode(output, s.TargetSource, s.TargetContract)
	if err != nil {
		return BuildEvidence{}, err
	}
	inHash := sha256.Sum256(input)
	outHash := sha256.Sum256(output)
	return BuildEvidence{
		CompilerVersion:  release.Version,
		CompilerSHA256:   release.SHA256,
		BundleHash:       s.BundleHash,
		InputSHA256:      "sha256:" + hex.EncodeToString(inHash[:]),
		OutputSHA256:     "sha256:" + hex.EncodeToString(outHash[:]),
		NetworkDisabled:  true,
		WorkingDirClean:  true,
		RuntimeBytecode:  runtimeCode,
		CreationBytecode: creationCode,
		HasImmutables:    hasImmutables,
		CompilerOutput:   append(json.RawMessage(nil), output...),
	}, nil
}

type limitedBuffer struct {
	buf      bytes.Buffer
	max      int64
	exceeded bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if b.exceeded {
		return 0, errors.New("output limit exceeded")
	}
	remaining := b.max - int64(b.buf.Len())
	if remaining <= 0 {
		b.exceeded = true
		return 0, errors.New("output limit exceeded")
	}
	if int64(len(p)) > remaining {
		_, _ = b.buf.Write(p[:remaining])
		b.exceeded = true
		return int(remaining), errors.New("output limit exceeded")
	}
	return b.buf.Write(p)
}

func (b *limitedBuffer) Bytes() []byte  { return b.buf.Bytes() }
func (b *limitedBuffer) String() string { return b.buf.String() }

func standardJSONFor(s submission.Submission) ([]byte, error) {
	if s.Kind == submission.InputStandardJSON {
		var doc map[string]any
		if err := json.Unmarshal(s.StandardJSON, &doc); err != nil {
			return nil, errors.New("standard JSON input must be valid JSON")
		}
		language, ok := doc["language"].(string)
		if !ok || language != "Solidity" {
			return nil, errors.New("standard JSON language must be Solidity")
		}
		if _, ok := doc["sources"].(map[string]any); !ok {
			return nil, errors.New("standard JSON sources object is required")
		}
		if err := validateStandardJSONBuildSettings(s.StandardJSON, s.Build); err != nil {
			return nil, err
		}
		settings, ok := doc["settings"].(map[string]any)
		if !ok {
			return nil, errors.New("standard JSON settings object is required")
		}
		settings["outputSelection"] = requiredOutputSelection()
		return json.Marshal(doc)
	}

	sources := map[string]map[string]string{}
	for _, f := range s.Sources {
		sources[f.Path] = map[string]string{"content": f.Content}
	}
	libraries := map[string]map[string]string{}
	for _, l := range s.Build.Libraries {
		if libraries[l.Source] == nil {
			libraries[l.Source] = map[string]string{}
		}
		libraries[l.Source][l.Library] = l.Address
	}
	settings := map[string]any{
		"optimizer":       map[string]any{"enabled": s.Build.OptimizerEnabled, "runs": s.Build.OptimizerRuns},
		"evmVersion":      s.Build.EVMVersion,
		"viaIR":           s.Build.ViaIR,
		"metadata":        map[string]any{"bytecodeHash": s.Build.MetadataHashMode},
		"libraries":       libraries,
		"outputSelection": requiredOutputSelection(),
	}
	return json.Marshal(map[string]any{"language": "Solidity", "sources": sources, "settings": settings})
}

func requiredOutputSelection() map[string]any {
	return map[string]any{
		"*": map[string]any{
			"*": []string{
				"evm.bytecode.object",
				"evm.deployedBytecode.object",
				"evm.deployedBytecode.immutableReferences",
			},
		},
	}
}

func validateStandardJSONBuildSettings(raw []byte, build submission.BuildSettings) error {
	var doc struct {
		Settings struct {
			Optimizer *struct {
				Enabled *bool   `json:"enabled"`
				Runs    *uint64 `json:"runs"`
			} `json:"optimizer"`
			EVMVersion *string `json:"evmVersion"`
			ViaIR      *bool   `json:"viaIR"`
			Metadata   *struct {
				BytecodeHash *string `json:"bytecodeHash"`
			} `json:"metadata"`
			Libraries map[string]map[string]string `json:"libraries"`
		} `json:"settings"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return errors.New("standard JSON input must be valid JSON")
	}
	if doc.Settings.Optimizer == nil || doc.Settings.Optimizer.Enabled == nil || doc.Settings.Optimizer.Runs == nil {
		return errors.New("standard JSON optimizer.enabled and optimizer.runs must be explicit")
	}
	if *doc.Settings.Optimizer.Enabled != build.OptimizerEnabled || *doc.Settings.Optimizer.Runs != build.OptimizerRuns {
		return errors.New("recorded optimizer settings do not match standard JSON input")
	}
	if doc.Settings.EVMVersion == nil || *doc.Settings.EVMVersion != build.EVMVersion {
		return errors.New("recorded evmVersion does not match explicit standard JSON input")
	}
	if doc.Settings.ViaIR == nil || *doc.Settings.ViaIR != build.ViaIR {
		return errors.New("recorded viaIR does not match explicit standard JSON input")
	}
	if doc.Settings.Metadata == nil || doc.Settings.Metadata.BytecodeHash == nil || *doc.Settings.Metadata.BytecodeHash != build.MetadataHashMode {
		return errors.New("recorded metadata bytecodeHash does not match explicit standard JSON input")
	}
	expectedLibraries := map[string]map[string]string{}
	for _, link := range build.Libraries {
		if expectedLibraries[link.Source] == nil {
			expectedLibraries[link.Source] = map[string]string{}
		}
		expectedLibraries[link.Source][link.Library] = strings.ToLower(link.Address)
	}
	actualLibraries := map[string]map[string]string{}
	for source, libs := range doc.Settings.Libraries {
		actualLibraries[source] = map[string]string{}
		for name, address := range libs {
			actualLibraries[source][name] = strings.ToLower(address)
		}
	}
	if !reflect.DeepEqual(actualLibraries, expectedLibraries) {
		return errors.New("recorded linked libraries do not match standard JSON input")
	}
	return nil
}

func verifyFileSHA256(path, expected string) error {
	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return err
	}
	sum := sha256.Sum256(data)
	actual := hex.EncodeToString(sum[:])
	expected = strings.TrimPrefix(strings.ToLower(expected), "sha256:")
	if actual != expected {
		return fmt.Errorf("compiler sha256 mismatch: expected=%s actual=%s", expected, actual)
	}
	return nil
}

func extractBytecode(raw []byte, targetSource, targetContract string) (string, string, bool, error) {
	type contractOutput struct {
		EVM struct {
			Bytecode struct {
				Object string `json:"object"`
			} `json:"bytecode"`
			Deployed struct {
				Object              string                     `json:"object"`
				ImmutableReferences map[string]json.RawMessage `json:"immutableReferences"`
			} `json:"deployedBytecode"`
		} `json:"evm"`
	}
	var doc struct {
		Contracts map[string]map[string]contractOutput `json:"contracts"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return "", "", false, errors.New("compiler output cannot be decoded")
	}

	if strings.TrimSpace(targetSource) != "" || strings.TrimSpace(targetContract) != "" {
		byName, ok := doc.Contracts[targetSource]
		if !ok {
			return "", "", false, fmt.Errorf("target source %q missing from compiler output", targetSource)
		}
		c, ok := byName[targetContract]
		if !ok {
			return "", "", false, fmt.Errorf("target contract %q missing from compiler output source %q", targetContract, targetSource)
		}
		return "0x" + c.EVM.Deployed.Object, "0x" + c.EVM.Bytecode.Object, len(c.EVM.Deployed.ImmutableReferences) > 0, nil
	}

	var selected *contractOutput
	count := 0
	for _, byName := range doc.Contracts {
		for _, c := range byName {
			copy := c
			selected = &copy
			count++
		}
	}
	if count == 0 || selected == nil {
		return "", "", false, errors.New("compiler output contains no contract bytecode")
	}
	if count != 1 {
		return "", "", false, errors.New("compiler output contains multiple contracts; targetSource and targetContract are required")
	}
	return "0x" + selected.EVM.Deployed.Object, "0x" + selected.EVM.Bytecode.Object, len(selected.EVM.Deployed.ImmutableReferences) > 0, nil
}
