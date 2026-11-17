package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/recovery"
)

// runSettlement consumes the certified-consensus stream. Signature verification
// and the persisted ancestry/finality owner remain mandatory for every record;
// stdin is a transport, never an alternative source of settlement authority.
func runSettlement(ctx context.Context, endpoint, jwt, trustPath, pin, dir string, repair bool) error {
	raw, err := os.ReadFile(trustPath)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(raw)
	if len(pin) != 64 || hex.EncodeToString(sum[:]) != pin {
		return fmt.Errorf("settlement trust SHA-256 mismatch or missing pin")
	}
	var trust recovery.Trust
	if err = recovery.Decode(raw, &trust); err != nil {
		return err
	}
	secret, err := eng.LoadJWTSecret(jwt)
	if err != nil {
		return err
	}
	client, err := eng.NewClient(endpoint, secret)
	if err != nil {
		return err
	}
	output := json.NewEncoder(os.Stdout)
	s, err := recovery.Open(trust, dir, client, recovery.Options{RepairSequence: repair, AfterCanonical: func(r recovery.Record) {
		_ = output.Encode(map[string]any{"event": "canonical", "slot": r.Consensus.Header.Slot, "execution": r.Payload.BlockHash})
		recovery.QualificationStop(r.Consensus.Header.Slot)
	}})
	if err != nil {
		return err
	}
	defer s.Close()
	type input struct {
		raw []byte
		err error
	}
	incoming := make(chan input)
	go func() {
		defer close(incoming)
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Buffer(make([]byte, 4096), 64<<20)
		for scanner.Scan() {
			b := append([]byte(nil), scanner.Bytes()...)
			select {
			case incoming <- input{raw: b}:
			case <-ctx.Done():
				return
			}
		}
		if err := scanner.Err(); err != nil {
			select {
			case incoming <- input{err: err}:
			case <-ctx.Done():
			}
		}
	}()
	emit := func(event string, err error) {
		message := ""
		if err != nil {
			message = err.Error()
		}
		_ = output.Encode(map[string]any{"event": event, "error": message, "status": s.Status()})
	}
	lastError := ""
	wasReady := false
	attempt := func() {
		if err := s.Reconcile(ctx); err != nil {
			if lastError != err.Error() {
				emit("halted", err)
				lastError = err.Error()
			}
			wasReady = false
		} else if !wasReady || lastError != "" {
			emit("settled", nil)
			lastError = ""
			wasReady = true
		}
	}
	attempt()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case in, ok := <-incoming:
			if !ok {
				incoming = nil
				continue
			}
			if in.err != nil {
				return in.err
			}
			var r recovery.Record
			if err := recovery.Decode(in.raw, &r); err != nil {
				emit("rejected", err)
				continue
			}
			if err := s.Queue(r); err != nil {
				emit("rejected", err)
				continue
			}
			emit("queued", nil)
			wasReady = false
			attempt()
		case <-ticker.C:
			attempt()
		}
	}
}
