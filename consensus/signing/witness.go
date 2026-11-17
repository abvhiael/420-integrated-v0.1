package signing

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/consensus/slashing"
	_ "github.com/lib/pq"
)

// PostgreSQL must be independently administered, outside the signer's journal
// backup/failure domain. Its complete history is the rollback witness. A signer
// never initializes a missing witness and never reconnects after losing its lock.
//
//go:embed witness.sql
var WitnessSchema string

func identityKey(p Policy) string {
	b := fmt.Sprintf("%d:%x:%d", p.Identity.ChainID, p.Identity.Genesis, p.Identity.ValidatorID)
	sum := sha256.Sum256([]byte(b))
	return hex.EncodeToString(sum[:])
}
func digest(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }

type Witness struct {
	mu      sync.Mutex
	conn    *sql.Conn
	key     string
	current []byte
	failed  error
}

func connectWitness(ctx context.Context, db *sql.DB, p Policy) (*Witness, error) {
	if err := p.Validate(); err != nil {
		return nil, err
	}
	conn, err := db.Conn(ctx)
	if err != nil {
		return nil, err
	}
	// An acknowledgement is a signing authorization only if PostgreSQL commits
	// durable WAL. Never inherit asynchronous/unlogged witness configuration.
	var fsync, fullPages, persistence string
	if err = conn.QueryRowContext(ctx, `show fsync`).Scan(&fsync); err == nil {
		err = conn.QueryRowContext(ctx, `show full_page_writes`).Scan(&fullPages)
	}
	if err == nil {
		err = conn.QueryRowContext(ctx, `select relpersistence from pg_class where oid='stake_signing_witness_v1'::regclass`).Scan(&persistence)
	}
	if err != nil || fsync != "on" || fullPages != "on" || persistence != "p" {
		conn.Close()
		return nil, fmt.Errorf("durable logged witness required: %w", slashing.ErrHistoryUnavailable)
	}
	if _, err = conn.ExecContext(ctx, `set synchronous_commit=on`); err != nil {
		conn.Close()
		return nil, err
	}
	key := identityKey(p)
	var locked bool
	if err = conn.QueryRowContext(ctx, `select pg_try_advisory_lock(hashtextextended($1,0))`, key).Scan(&locked); err != nil || !locked {
		conn.Close()
		return nil, fmt.Errorf("witness identity locked or unavailable: %v", err)
	}
	return &Witness{conn: conn, key: key}, nil
}
func (w *Witness) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.failed = slashing.ErrHistoryUnavailable
	// Conn.Close returns a session to the pool. Explicitly release our advisory
	// lock before that return, and close the pool in the owning executable.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := w.conn.ExecContext(ctx, `select pg_advisory_unlock(hashtextextended($1,0))`, w.key)
	closeErr := w.conn.Close()
	if err != nil {
		return err
	}
	return closeErr
}
func (w *Witness) read(ctx context.Context) ([]byte, error) {
	var raw []byte
	var hash string
	err := w.conn.QueryRowContext(ctx, `select history,digest from stake_signing_witness_v1 where identity=$1`, w.key).Scan(&raw, &hash)
	if err != nil || hash != digest(raw) {
		return nil, fmt.Errorf("witness missing or corrupt: %w", slashing.ErrHistoryUnavailable)
	}
	return raw, nil
}

// ProvisionWitness is only for a newly generated, never-used identity. Schema
// installation and credentials are administrator operations, not signer startup.
func ProvisionWitness(ctx context.Context, db *sql.DB, p Policy, protector *slashing.Protector) error {
	if protector == nil {
		return slashing.ErrHistoryUnavailable
	}
	unused, err := protector.Unused()
	if err != nil {
		return err
	}
	if !unused {
		return fmt.Errorf("used key requires independently verified complete history import")
	}
	return provisionWitness(ctx, db, p, protector)
}
func provisionWitness(ctx context.Context, db *sql.DB, p Policy, protector *slashing.Protector) error {
	if protector == nil {
		return slashing.ErrHistoryUnavailable
	}
	id, err := protector.HistoryIdentity()
	if err != nil {
		return err
	}
	if id != p.Identity {
		return slashing.ErrInvalidDuty
	}
	w, err := connectWitness(ctx, db, p)
	if err != nil {
		return err
	}
	defer w.Close()
	raw, err := protector.Snapshot()
	if err != nil {
		return err
	}
	_, err = w.conn.ExecContext(ctx, `insert into stake_signing_witness_v1(identity,generation,history,digest) values($1,0,$2,$3)`, w.key, raw, digest(raw))
	return err
}
func OpenWitness(ctx context.Context, db *sql.DB, p Policy, protector *slashing.Protector) (*Witness, error) {
	if protector == nil {
		return nil, slashing.ErrHistoryUnavailable
	}
	id, err := protector.HistoryIdentity()
	if err != nil {
		return nil, err
	}
	if id != p.Identity {
		return nil, slashing.ErrInvalidDuty
	}
	w, err := connectWitness(ctx, db, p)
	if err != nil {
		return nil, err
	}
	remote, err := w.read(ctx)
	if err == nil {
		var local []byte
		local, err = protector.Snapshot()
		if err == nil && !bytes.Equal(local, remote) {
			err = fmt.Errorf("offline signing history rollback or uncommitted reservation: %w", slashing.ErrHistoryUnavailable)
		}
	}
	if err != nil {
		w.Close()
		return nil, err
	}
	w.current = remote
	return w, nil
}

// Commit holds the independent key lock and checks the previous complete
// witness before reservation. A failed/uncertain commit disables this instance.
func (w *Witness) Commit(ctx context.Context, reserve func() ([]byte, error)) (err error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.failed != nil {
		return w.failed
	}
	defer func() {
		if err != nil {
			w.failed = fmt.Errorf("signer halted: %w", err)
		}
	}()
	remote, err := w.read(ctx)
	if err != nil {
		return err
	}
	if !bytes.Equal(remote, w.current) {
		return slashing.ErrHistoryUnavailable
	}
	next, err := reserve()
	if err != nil {
		return err
	}
	result, err := w.conn.ExecContext(ctx, `update stake_signing_witness_v1 set generation=generation+1,history=$2,digest=$3 where identity=$1 and digest=$4`, w.key, next, digest(next), digest(w.current))
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil || n != 1 {
		return slashing.ErrHistoryUnavailable
	}
	w.current = next
	return nil
}

// RecoverWitnessHistory explicitly restores complete independently witnessed
// history, never a caller-provided digest or an empty/reset journal.
func RecoverWitnessHistory(ctx context.Context, db *sql.DB, p Policy, path string) error {
	w, err := connectWitness(ctx, db, p)
	if err != nil {
		return err
	}
	defer w.Close()
	raw, err := w.read(ctx)
	if err != nil {
		return err
	}
	return slashing.RestoreWitnessHistory(path, p.Identity, raw)
}

// ImportWitness requires an independent complete-history hash. This does not
// certify completeness itself: key migration must obtain that evidence from the
// prior authoritative signer, never an uncertain local backup.
func ImportWitness(ctx context.Context, db *sql.DB, p Policy, protector *slashing.Protector, pin string) error {
	if protector == nil {
		return slashing.ErrHistoryUnavailable
	}
	raw, err := protector.Snapshot()
	if err != nil {
		return err
	}
	if len(pin) != 64 || digest(raw) != pin {
		return fmt.Errorf("independently verified history pin required")
	}
	return provisionWitness(ctx, db, p, protector)
}
