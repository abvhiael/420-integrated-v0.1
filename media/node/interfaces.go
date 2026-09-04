package node

import "context"

// ChainAdapter isolates the worker from any specific Ethereum RPC/client library.
// A production adapter will translate these operations to MediaJobMarket420 and
// MediaOperatorRegistry420 calls and event reads.
type ChainAdapter interface {
	PendingJobs(ctx context.Context) ([]Job, error)
	AcceptJob(ctx context.Context, jobID [32]byte) error
	RefreshJob(ctx context.Context, jobID [32]byte) (Job, error)
	MarkRunning(ctx context.Context, jobID [32]byte) error
	CommitResult(ctx context.Context, jobID [32]byte, outputRef [32]byte) error
}

// Processor executes the actual off-chain media workload. Implementations may wrap
// FFmpeg, GStreamer, WebRTC gateways, transcription engines or GPU inference.
type Processor interface {
	Process(ctx context.Context, job Job) (Result, error)
}

// LeaseStore prevents duplicate local execution when multiple worker loops share an
// operator identity. Distributed implementations may use a durable KV/lease backend.
type LeaseStore interface {
	Acquire(ctx context.Context, jobID [32]byte) (Lease, bool, error)
}

// Lease must be renewed while a job is running. Losing renewal is fail-closed.
type Lease interface {
	Renew(ctx context.Context) error
	Release() error
}
