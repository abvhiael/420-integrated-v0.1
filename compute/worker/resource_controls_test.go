package worker

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type resourceProbeStub struct {
	mu       sync.Mutex
	snapshot HostResourceSnapshot
	err      error
}

func (p *resourceProbeStub) Snapshot(context.Context) (HostResourceSnapshot, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.snapshot, p.err
}

func (p *resourceProbeStub) set(snapshot HostResourceSnapshot) {
	p.mu.Lock()
	p.snapshot = snapshot
	p.mu.Unlock()
}

type gpuLeaseStub struct{ released bool }

func (l *gpuLeaseStub) Release() error {
	l.released = true
	return nil
}

type gpuEnforcerStub struct {
	percent float64
	lease   *gpuLeaseStub
	err     error
}

func (g *gpuEnforcerStub) Acquire(_ context.Context, percent float64) (GPUShareLease, error) {
	g.percent = percent
	if g.err != nil {
		return nil, g.err
	}
	g.lease = &gpuLeaseStub{}
	return g.lease, nil
}

type resourceCaptureRunner struct {
	args []string
}

func (r *resourceCaptureRunner) Run(_ context.Context, _ string, args []string, _ io.Reader, _ io.Writer, _ io.Writer) error {
	r.args = append([]string(nil), args...)
	return nil
}

type fakeBandwidthClock struct {
	mu     sync.Mutex
	now    time.Time
	sleeps []time.Duration
}

func (c *fakeBandwidthClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeBandwidthClock) Sleep(ctx context.Context, d time.Duration) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	c.mu.Lock()
	c.sleeps = append(c.sleeps, d)
	c.now = c.now.Add(d)
	c.mu.Unlock()
	return nil
}

func (c *fakeBandwidthClock) totalSleep() time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	var total time.Duration
	for _, d := range c.sleeps {
		total += d
	}
	return total
}

func TestLocalResourcePolicyValidation(t *testing.T) {
	base := DefaultLocalResourcePolicy()
	if err := base.Validate(); err != nil {
		t.Fatal(err)
	}
	cases := []LocalResourcePolicy{base, base, base, base, base, base}
	cases[0].CPUPercent = 0
	cases[1].GPUPercent = 101
	cases[2].IdleOnly = true
	cases[2].MinIdleDuration = 0
	cases[3].MaxCPUTemperatureC = 151
	cases[4].BandwidthBytesPerSecond = 100
	cases[4].BandwidthBurstBytes = 0
	cases[5].Schedule = []ScheduleWindow{{Weekday: time.Monday, StartMinute: 100, EndMinute: 100}}
	for i, policy := range cases {
		if err := policy.Validate(); err == nil {
			t.Fatalf("invalid policy case %d accepted", i)
		}
	}
}

func TestApplyLocalResourcePolicySetsSandboxCPUQuota(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.CPUPercent = 25
	sandboxPolicy, err := ApplyLocalResourcePolicy(DefaultSandboxPolicy("docker"), policy, 8)
	if err != nil {
		t.Fatal(err)
	}
	if sandboxPolicy.CPUs != 2 {
		t.Fatalf("cpus=%v want=2", sandboxPolicy.CPUs)
	}
	runner := &resourceCaptureRunner{}
	sandbox, err := NewSandbox(sandboxPolicy, runner)
	if err != nil {
		t.Fatal(err)
	}
	_, err = sandbox.Run(context.Background(), SandboxRequest{
		Image: "sha256:" + strings.Repeat("a", 64),
		Command: []string{"/worker"},
	})
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(runner.args, " ")
	if !strings.Contains(joined, "--cpus 2") {
		t.Fatalf("sandbox CPU quota not emitted: %s", joined)
	}
}

func TestParseScheduleWindow(t *testing.T) {
	window, err := ParseScheduleWindow("Mon@18:30-23:00")
	if err != nil {
		t.Fatal(err)
	}
	if window.Weekday != time.Monday || window.StartMinute != 18*60+30 || window.EndMinute != 23*60 {
		t.Fatalf("parsed window=%+v", window)
	}
	for _, raw := range []string{"", "Monday@18:00-19:00", "Mon@24:00-24:00", "Mon@20:00-19:00", "Mon@bad"} {
		if _, err := ParseScheduleWindow(raw); err == nil {
			t.Fatalf("invalid schedule %q accepted", raw)
		}
	}
}

func TestIdleOnlyTracksContinuousLowUtilizationWhenProbeHasNoIdleClock(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.IdleOnly = true
	policy.IdleCPUThresholdPercent = 10
	policy.MinIdleDuration = time.Minute
	probe := &resourceProbeStub{snapshot: HostResourceSnapshot{
		LogicalCPUs: 4, CPUUtilizationKnown: true, CPUUtilizationPercent: 5,
	}}
	controller, err := NewLocalResourceController(policy, probe, nil)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	controller.now = func() time.Time { return now }
	if _, err := controller.Acquire(context.Background()); err == nil {
		t.Fatal("first low-utilization sample incorrectly satisfied minimum idle duration")
	}
	now = now.Add(61 * time.Second)
	lease, err := controller.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := lease.Release(); err != nil {
		t.Fatal(err)
	}
	busy := probe.snapshot
	busy.CPUUtilizationPercent = 50
	probe.set(busy)
	if _, err := controller.Acquire(context.Background()); err == nil {
		t.Fatal("busy sample did not reset idle eligibility")
	}
	now = now.Add(61 * time.Second)
	quiet := busy
	quiet.CPUUtilizationPercent = 5
	probe.set(quiet)
	if _, err := controller.Acquire(context.Background()); err == nil {
		t.Fatal("idle timer was not reset after host became busy")
	}
}

func TestControlledExecutionLifecycleAutomaticallyAppliesCPUQuota(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, _, _, _ := resultFixture(t, runner)
	policy := DefaultLocalResourcePolicy()
	policy.CPUPercent = 50
	controller, err := NewLocalResourceController(policy, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewControlledExecutionLifecycle(lifecycle, controller); err != nil {
		t.Fatal(err)
	}
	want := float64(RuntimeLogicalCPUs()) * 0.5
	if want < 0.01 {
		want = 0.01
	}
	if want > 64 {
		want = 64
	}
	if lifecycle.sandbox.policy.CPUs != want {
		t.Fatalf("controlled sandbox CPUs=%v want=%v", lifecycle.sandbox.policy.CPUs, want)
	}
}

func TestScheduleControlsUseConfiguredTimezone(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.TimeZone = "UTC"
	policy.Schedule = []ScheduleWindow{{Weekday: time.Monday, StartMinute: 9 * 60, EndMinute: 17 * 60}}
	if !scheduleAllows(policy, time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)) {
		t.Fatal("valid Monday schedule rejected")
	}
	if scheduleAllows(policy, time.Date(2026, 10, 5, 18, 0, 0, 0, time.UTC)) {
		t.Fatal("out-of-window schedule admitted")
	}
	if scheduleAllows(policy, time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)) {
		t.Fatal("wrong weekday admitted")
	}
}

func TestIdleOnlyAndThermalControlsFailClosed(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.IdleOnly = true
	policy.IdleCPUThresholdPercent = 15
	policy.MinIdleDuration = time.Minute
	policy.MaxCPUTemperatureC = 80
	probe := &resourceProbeStub{snapshot: HostResourceSnapshot{
		LogicalCPUs: 8,
		CPUUtilizationKnown: true,
		CPUUtilizationPercent: 5,
		IdleKnown: true,
		IdleDuration: 2 * time.Minute,
		CPUTemperatureKnown: true,
		CPUTemperatureC: 60,
	}}
	controller, err := NewLocalResourceController(policy, probe, nil)
	if err != nil {
		t.Fatal(err)
	}
	lease, err := controller.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := lease.Release(); err != nil {
		t.Fatal(err)
	}

	busy := probe.snapshot
	busy.CPUUtilizationPercent = 50
	probe.set(busy)
	if _, err := controller.Acquire(context.Background()); err == nil {
		t.Fatal("busy host admitted in idle-only mode")
	}

	hot := busy
	hot.CPUUtilizationPercent = 5
	hot.CPUTemperatureC = 80
	probe.set(hot)
	if _, err := controller.Acquire(context.Background()); !errorsIs(err, ErrLocalResourceExceeded) {
		t.Fatalf("thermal ceiling not enforced: %v", err)
	}

	unknown := hot
	unknown.CPUTemperatureKnown = false
	probe.set(unknown)
	if _, err := controller.Acquire(context.Background()); !errorsIs(err, ErrLocalResourceUnavailable) {
		t.Fatalf("missing thermal telemetry did not fail closed: %v", err)
	}
}

func TestGPUPercentageRequiresAndUsesQualifiedEnforcer(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.GPUPercent = 35
	probe := &resourceProbeStub{snapshot: HostResourceSnapshot{LogicalCPUs: 8, GPUAvailable: true}}
	if _, err := NewLocalResourceController(policy, probe, nil); err == nil {
		t.Fatal("GPU percentage accepted without enforcer")
	}
	gpu := &gpuEnforcerStub{}
	controller, err := NewLocalResourceController(policy, probe, gpu)
	if err != nil {
		t.Fatal(err)
	}
	lease, err := controller.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if gpu.percent != 35 {
		t.Fatalf("GPU percent=%v", gpu.percent)
	}
	if err := lease.Release(); err != nil {
		t.Fatal(err)
	}
	if gpu.lease == nil || !gpu.lease.released {
		t.Fatal("GPU share lease not released")
	}
}

func TestContinuousThermalMonitorCancelsLease(t *testing.T) {
	policy := DefaultLocalResourcePolicy()
	policy.MaxCPUTemperatureC = 70
	policy.TelemetryPollInterval = time.Millisecond
	probe := &resourceProbeStub{snapshot: HostResourceSnapshot{
		LogicalCPUs: 4, CPUTemperatureKnown: true, CPUTemperatureC: 50,
	}}
	controller, err := NewLocalResourceController(policy, probe, nil)
	if err != nil {
		t.Fatal(err)
	}
	lease, err := controller.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	hot := probe.snapshot
	hot.CPUTemperatureC = 75
	probe.set(hot)
	select {
	case <-lease.Context().Done():
	case <-time.After(250 * time.Millisecond):
		t.Fatal("thermal monitor did not cancel running lease")
	}
	if !errorsIs(lease.Err(), ErrLocalResourceExceeded) {
		t.Fatalf("lease error=%v", lease.Err())
	}
	if err := lease.Release(); err != nil {
		t.Fatal(err)
	}
}

func TestByteRateLimiterDeterministicallyThrottlesReader(t *testing.T) {
	clock := &fakeBandwidthClock{now: time.Unix(0, 0)}
	limiter, err := newByteRateLimiter(10, 10, clock)
	if err != nil {
		t.Fatal(err)
	}
	payload := bytes.Repeat([]byte("x"), 30)
	got, err := io.ReadAll(limiter.WrapReader(context.Background(), bytes.NewReader(payload)))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatal("rate limiter changed payload")
	}
	if clock.totalSleep() != 2*time.Second {
		t.Fatalf("total sleep=%s want=2s", clock.totalSleep())
	}
}

func TestByteRateLimiterCancellationFailsClosed(t *testing.T) {
	clock := &fakeBandwidthClock{now: time.Unix(0, 0)}
	limiter, err := newByteRateLimiter(1, 1, clock)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	buf := make([]byte, 1)
	if _, err := limiter.WrapReader(ctx, bytes.NewReader([]byte("x"))).Read(buf); err == nil {
		t.Fatal("cancelled bandwidth reader continued")
	}
}

func TestWorkUnitDownloaderUsesConfiguredBandwidthLimiter(t *testing.T) {
	payload := bytes.Repeat([]byte("d"), 30)
	digest := sha256Hex(payload)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Length", fmt.Sprint(len(payload)))
		_, _ = w.Write(payload)
	}))
	defer server.Close()

	clock := &fakeBandwidthClock{now: time.Unix(0, 0)}
	limiter, err := newByteRateLimiter(10, 10, clock)
	if err != nil {
		t.Fatal(err)
	}
	client := server.Client()
	client.Timeout = time.Minute
	downloader, err := NewWorkUnitDownloaderWithBandwidth(
		t.TempDir(), client, nil, 1024, limiter,
	)
	if err != nil {
		t.Fatal(err)
	}
	_, err = downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL, SHA256: digest, SizeBytes: uint64(len(payload)),
		MediaType: "application/octet-stream",
	})
	if err != nil {
		t.Fatal(err)
	}
	if clock.totalSleep() != 2*time.Second {
		t.Fatalf("download throttle sleep=%s", clock.totalSleep())
	}
}

func TestResultEvidenceUploaderUsesConfiguredBandwidthLimiter(t *testing.T) {
	payload := []byte("bandwidth-limited-private-proof")
	uploader, transport, result, _, _ := uploadFixture(t, [][]byte{payload})
	clock := &fakeBandwidthClock{now: time.Unix(0, 0)}
	limiter, err := newByteRateLimiter(10, 10, clock)
	if err != nil {
		t.Fatal(err)
	}
	uploader.bandwidth = limiter
	if _, err := uploader.Upload(context.Background(), result.AuthorizationRef, evidenceSources([][]byte{payload})); err != nil {
		t.Fatal(err)
	}
	if len(transport.requests) == 0 {
		t.Fatal("upload transport not called")
	}
	if clock.totalSleep() <= 0 {
		t.Fatal("upload path did not apply bandwidth limiter")
	}
}

func TestLinuxHostResourceProbeReadsCPUAndThermalsWithoutShell(t *testing.T) {
	root := t.TempDir()
	proc := filepath.Join(root, "proc-stat")
	thermal := filepath.Join(root, "thermal")
	hwmon := filepath.Join(root, "hwmon")
	dev := filepath.Join(root, "dev")
	if err := os.MkdirAll(filepath.Join(thermal, "thermal_zone0"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(hwmon, "hwmon0"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dev, "dri"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(proc, []byte("cpu 100 0 100 800 0 0 0 0\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(thermal, "thermal_zone0", "temp"), []byte("55000\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(hwmon, "hwmon0", "name"), []byte("amdgpu\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(hwmon, "hwmon0", "temp1_input"), []byte("65000\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dev, "dri", "renderD128"), []byte{}, 0o600); err != nil {
		t.Fatal(err)
	}
	probe := newLinuxHostResourceProbe(proc, thermal, hwmon, dev, time.Now)
	first, err := probe.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if first.CPUUtilizationKnown {
		t.Fatal("first CPU sample should not fabricate utilization")
	}
	if !first.CPUTemperatureKnown || first.CPUTemperatureC != 55 {
		t.Fatalf("CPU temp=%v known=%v", first.CPUTemperatureC, first.CPUTemperatureKnown)
	}
	if !first.GPUTemperatureKnown || first.GPUTemperatureC != 65 || !first.GPUAvailable {
		t.Fatalf("GPU telemetry=%+v", first)
	}
	if err := os.WriteFile(proc, []byte("cpu 150 0 150 900 0 0 0 0\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	second, err := probe.Snapshot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !second.CPUUtilizationKnown {
		t.Fatal("second CPU sample did not compute utilization")
	}
	if mathAbs(second.CPUUtilizationPercent-50) > 0.001 {
		t.Fatalf("CPU utilization=%v want=50", second.CPUUtilizationPercent)
	}
}

func errorsIs(err, target error) bool {
	return err != nil && (err == target || strings.Contains(err.Error(), target.Error()))
}

func mathAbs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}
