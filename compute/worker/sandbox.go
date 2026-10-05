package worker

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	SandboxSchemaV1        = "420-compute-worker-sandbox-v1"
	DefaultSandboxUser     = "65532:65532"
	DefaultSandboxMaxBytes = 64 << 10
)

var (
	ErrInvalidSandbox  = errors.New("invalid compute worker sandbox request")
	digestImagePattern = regexp.MustCompile("^(?:[a-zA-Z0-9._/:~-]+@)?sha256:[0-9a-f]{64}$")
)

type SandboxPolicy struct {
	Engine          string        `json:"engine"`
	CPUs            float64       `json:"cpus"`
	MemoryBytes     uint64        `json:"memoryBytes"`
	PidsLimit       uint64        `json:"pidsLimit"`
	TempBytes       uint64        `json:"tempBytes"`
	Timeout         time.Duration `json:"timeout"`
	MaxOutputBytes  int           `json:"maxOutputBytes"`
	User            string        `json:"user"`
	NetworkDisabled bool          `json:"networkDisabled"`
	ReadOnlyRootFS  bool          `json:"readOnlyRootFs"`
	DropAllCaps     bool          `json:"dropAllCapabilities"`
	NoNewPrivileges bool          `json:"noNewPrivileges"`
}

type SandboxRequest struct {
	Image   string   `json:"image"`
	Command []string `json:"command"`
}

type SandboxResult struct {
	SchemaVersion   string        `json:"schemaVersion"`
	Engine          string        `json:"engine"`
	ContainerName   string        `json:"containerName"`
	ExitCode        int           `json:"exitCode"`
	Duration        time.Duration `json:"duration"`
	TimedOut        bool          `json:"timedOut"`
	Output          string        `json:"output"`
	OutputTruncated bool          `json:"outputTruncated"`
	StdoutSHA256    string        `json:"stdoutSha256"`
	StdoutBytes     uint64        `json:"stdoutBytes"`
}

type CommandRunner interface {
	Run(context.Context, string, []string, io.Reader, io.Writer, io.Writer) error
}

type OSCommandRunner struct{}

func (OSCommandRunner) Run(ctx context.Context, name string, args []string, stdin io.Reader, stdout, stderr io.Writer) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdin = stdin
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	return cmd.Run()
}

type Sandbox struct {
	policy SandboxPolicy
	runner CommandRunner
}

func DefaultSandboxPolicy(engine string) SandboxPolicy {
	return SandboxPolicy{
		Engine:          engine,
		CPUs:            1,
		MemoryBytes:     512 << 20,
		PidsLimit:       128,
		TempBytes:       64 << 20,
		Timeout:         30 * time.Second,
		MaxOutputBytes:  DefaultSandboxMaxBytes,
		User:            DefaultSandboxUser,
		NetworkDisabled: true,
		ReadOnlyRootFS:  true,
		DropAllCaps:     true,
		NoNewPrivileges: true,
	}
}

func (p SandboxPolicy) Validate() error {
	if p.Engine != "docker" && p.Engine != "podman" {
		return fmt.Errorf("%w: engine must be docker or podman", ErrInvalidSandbox)
	}
	if p.CPUs <= 0 || p.CPUs > 64 {
		return fmt.Errorf("%w: CPUs out of bounds", ErrInvalidSandbox)
	}
	if p.MemoryBytes < 32<<20 || p.MemoryBytes > 1<<40 {
		return fmt.Errorf("%w: memory limit out of bounds", ErrInvalidSandbox)
	}
	if p.PidsLimit == 0 || p.PidsLimit > 4096 {
		return fmt.Errorf("%w: PID limit out of bounds", ErrInvalidSandbox)
	}
	if p.TempBytes < 1<<20 || p.TempBytes > 16<<30 {
		return fmt.Errorf("%w: tmpfs limit out of bounds", ErrInvalidSandbox)
	}
	if p.Timeout <= 0 || p.Timeout > 24*time.Hour {
		return fmt.Errorf("%w: timeout out of bounds", ErrInvalidSandbox)
	}
	if p.MaxOutputBytes < 1024 || p.MaxOutputBytes > 16<<20 {
		return fmt.Errorf("%w: output limit out of bounds", ErrInvalidSandbox)
	}
	if p.User == "" || p.User == "0" || p.User == "0:0" || strings.HasPrefix(p.User, "root") {
		return fmt.Errorf("%w: sandbox user must be non-root", ErrInvalidSandbox)
	}
	if !p.NetworkDisabled || !p.ReadOnlyRootFS || !p.DropAllCaps || !p.NoNewPrivileges {
		return fmt.Errorf("%w: mandatory isolation control disabled", ErrInvalidSandbox)
	}
	return nil
}

func ValidateSandboxRequest(request SandboxRequest) error {
	if !digestImagePattern.MatchString(request.Image) {
		return fmt.Errorf("%w: image must be pinned by lowercase sha256 digest or immutable image ID", ErrInvalidSandbox)
	}
	if len(request.Command) == 0 || len(request.Command) > 128 {
		return fmt.Errorf("%w: command argument count invalid", ErrInvalidSandbox)
	}
	for _, arg := range request.Command {
		if strings.ContainsRune(arg, '\x00') {
			return fmt.Errorf("%w: command contains NUL", ErrInvalidSandbox)
		}
	}
	return nil
}

func NewSandbox(policy SandboxPolicy, runner CommandRunner) (*Sandbox, error) {
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	if runner == nil {
		return nil, fmt.Errorf("%w: nil command runner", ErrInvalidSandbox)
	}
	return &Sandbox{policy: policy, runner: runner}, nil
}

func (s *Sandbox) Run(parent context.Context, request SandboxRequest) (SandboxResult, error) {
	return s.RunWithInput(parent, request, nil)
}

func (s *Sandbox) RunWithInput(parent context.Context, request SandboxRequest, input io.Reader) (SandboxResult, error) {
	if err := ValidateSandboxRequest(request); err != nil {
		return SandboxResult{}, err
	}
	name, err := sandboxContainerName()
	if err != nil {
		return SandboxResult{}, fmt.Errorf("create sandbox name: %w", err)
	}

	ctx, cancel := context.WithTimeout(parent, s.policy.Timeout)
	defer cancel()

	args := s.runArgs(name, request, input != nil)
	output := newLimitedBuffer(s.policy.MaxOutputBytes)
	stdout := newHashingWriter(output)
	started := time.Now()
	runErr := s.runner.Run(ctx, s.policy.Engine, args, input, stdout, output)
	duration := time.Since(started)

	result := SandboxResult{
		SchemaVersion:   SandboxSchemaV1,
		Engine:          s.policy.Engine,
		ContainerName:   name,
		ExitCode:        exitCode(runErr),
		Duration:        duration,
		TimedOut:        errors.Is(ctx.Err(), context.DeadlineExceeded),
		Output:          output.String(),
		OutputTruncated: output.Truncated(),
		StdoutSHA256:    stdout.SHA256(),
		StdoutBytes:     stdout.Bytes(),
	}

	if ctx.Err() != nil {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cleanupCancel()
		_ = s.runner.Run(cleanupCtx, s.policy.Engine, []string{"rm", "-f", name}, nil, io.Discard, io.Discard)
		return result, fmt.Errorf("sandbox execution: %w", ctx.Err())
	}
	if runErr != nil {
		return result, fmt.Errorf("sandbox execution: %w", runErr)
	}
	return result, nil
}

func (s *Sandbox) runArgs(name string, request SandboxRequest, interactive bool) []string {
	p := s.policy
	args := []string{
		"run",
		"--rm",
		"--name", name,
		"--network", "none",
		"--read-only",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		"--pids-limit", strconv.FormatUint(p.PidsLimit, 10),
		"--memory", strconv.FormatUint(p.MemoryBytes, 10),
		"--cpus", strconv.FormatFloat(p.CPUs, 'f', -1, 64),
		"--user", p.User,
		"--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=" + strconv.FormatUint(p.TempBytes, 10),
	}
	if interactive {
		args = append(args, "--interactive")
	}
	args = append(args, request.Image)
	args = append(args, request.Command...)
	return args
}

func sandboxContainerName() (string, error) {
	var raw [12]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return "cmp-sandbox-" + hex.EncodeToString(raw[:]), nil
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return exitErr.ExitCode()
	}
	return -1
}

type limitedBuffer struct {
	buffer    bytes.Buffer
	limit     int
	truncated bool
}

func newLimitedBuffer(limit int) *limitedBuffer {
	return &limitedBuffer{limit: limit}
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	original := len(p)
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.truncated = true
		return original, nil
	}
	if len(p) > remaining {
		_, _ = b.buffer.Write(p[:remaining])
		b.truncated = true
		return original, nil
	}
	_, _ = b.buffer.Write(p)
	return original, nil
}

func (b *limitedBuffer) String() string {
	return b.buffer.String()
}

func (b *limitedBuffer) Truncated() bool {
	return b.truncated
}


type hashingWriter struct {
	writer io.Writer
	hash   hash.Hash
	bytes  uint64
}

func newHashingWriter(writer io.Writer) *hashingWriter {
	return &hashingWriter{writer: writer, hash: sha256.New()}
}

func (w *hashingWriter) Write(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if _, err := w.hash.Write(p); err != nil {
		return 0, err
	}
	n, err := w.writer.Write(p)
	w.bytes += uint64(n)
	return n, err
}

func (w *hashingWriter) SHA256() string {
	return hex.EncodeToString(w.hash.Sum(nil))
}

func (w *hashingWriter) Bytes() uint64 {
	return w.bytes
}
