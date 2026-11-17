package main

import (
	"bufio"
	"context"
	"encoding/json"
	"os"

	"github.com/420integrated/420-integrated/consensus/recovery"
	"github.com/420integrated/420-integrated/consensus/signing"
	"github.com/420integrated/420-integrated/consensus/slashing"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

// runProtectedSigning is the production typed-duty boundary. No validator key,
// witness credential, Wallet key or Engine JWT is accepted in this process mode.
// Duty selection/fork choice remains the consensus caller's responsibility;
// every emitted proposal/vote signature must pass local + remote protection.
func runProtectedSigning(ctx context.Context, endpoint, policyPath, policyPin, history, cert, key, ca, peer string) error {
	policy, err := signing.LoadPolicy(policyPath, policyPin)
	if err != nil {
		return err
	}
	config, _, err := signing.LoadTLS(cert, key, ca, peer, false)
	if err != nil {
		return err
	}
	protector, err := slashing.OpenProtector(history, policy.Identity)
	if err != nil {
		return err
	}
	defer protector.Close()
	client, err := signing.NewClient(endpoint, config, policy, protector)
	if err != nil {
		return err
	}
	defer client.Close()
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 4096), 64<<10)
	output := json.NewEncoder(os.Stdout)
	type input struct {
		raw []byte
		err error
	}
	incoming := make(chan input)
	go func() {
		defer close(incoming)
		for scanner.Scan() {
			raw := append([]byte(nil), scanner.Bytes()...)
			select {
			case incoming <- input{raw: raw}:
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
	for {
		var item input
		select {
		case <-ctx.Done():
			return nil
		case next, ok := <-incoming:
			if !ok {
				return nil
			}
			item = next
		}
		if item.err != nil {
			return item.err
		}
		if err = ctx.Err(); err != nil {
			return err
		}
		var duty signing.Duty
		if err = recovery.Decode(item.raw, &duty); err != nil {
			return err
		}
		result, err := client.Sign(ctx, duty)
		if err != nil {
			return err
		}
		if duty.Vote != nil {
			// QC votes use the existing collector's DomainQC representation; ordinary
			// attestations use DomainAttestation and cannot be passed as QC shares.
			att := ct.Attestation{Seat: policy.Seat, Data: *duty.Vote, Signature: result.Signature}
			err = output.Encode(struct {
				Kind        string
				Attestation ct.Attestation
				Result      signing.Result
			}{duty.Kind, att, result})
		} else {
			err = output.Encode(struct {
				Kind     string
				Proposal *ct.ConsensusBlock
				Result   signing.Result
			}{duty.Kind, duty.Proposal, result})
		}
		if err != nil {
			return err
		}
	}
}
