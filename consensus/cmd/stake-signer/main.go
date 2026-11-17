package main

import (
	"context"
	"database/sql"
	"encoding/hex"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/420integrated/420-integrated/consensus/signing"
	"github.com/420integrated/420-integrated/consensus/slashing"
)

func run() error {
	policyPath := flag.String("policy", "", "independently provisioned signing policy")
	policyPin := flag.String("policy-sha256", "", "required policy SHA-256")
	history := flag.String("history", "", "private durable signing journal (never auto-created)")
	keyPath := flag.String("bls-ikm", "", "private hex BLS IKM; signer process only")
	dsnPath := flag.String("witness-dsn", "", "private independent PostgreSQL TLS connection credential file")
	cert := flag.String("tls-cert", "", "signer TLS certificate")
	key := flag.String("tls-key", "", "private signer TLS key")
	ca := flag.String("tls-ca", "", "validator client CA")
	peer := flag.String("client-spki-sha256", "", "authorized validator transport public-key SHA-256")
	listen := flag.String("listen", "127.0.0.1:9443", "mTLS listener")
	provision := flag.Bool("provision-never-used-key", false, "explicitly provision history + independent witness for a fresh, never-used key")
	recoverHistory := flag.Bool("recover-witness-history", false, "explicitly recover complete history from the independent witness, then exit")
	importPin := flag.String("import-verified-history-sha256", "", "explicit independent complete-history digest for an existing key; never overwrite an existing witness")
	flag.Parse()
	if (*provision && *recoverHistory) || (*importPin != "" && (*provision || *recoverHistory)) {
		return fmt.Errorf("provision and recovery are mutually exclusive")
	}
	policy, err := signing.LoadPolicy(*policyPath, *policyPin)
	if err != nil {
		return err
	}
	dsn, err := signing.LoadWitnessDSN(*dsnPath)
	if err != nil {
		return err
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if *recoverHistory {
		return signing.RecoverWitnessHistory(ctx, db, policy, *history)
	}
	raw, err := signing.PrivateFile(*keyPath)
	if err != nil {
		return err
	}
	ikm, err := hex.DecodeString(strings.TrimSpace(string(raw)))
	if err != nil || len(ikm) != 32 {
		return fmt.Errorf("private BLS IKM must contain 32 bytes")
	}
	defer clear(ikm)
	defer clear(raw)
	if err = signing.ValidateKey(policy, ikm); err != nil {
		return err
	}
	if *provision {
		if err = slashing.InitializeHistory(*history, policy.Identity); err != nil {
			return err
		}
	}
	protector, err := slashing.OpenProtector(*history, policy.Identity)
	if err != nil {
		return err
	}
	defer protector.Close()
	if *importPin != "" {
		return signing.ImportWitness(ctx, db, policy, protector, *importPin)
	}
	if *provision {
		return signing.ProvisionWitness(ctx, db, policy, protector)
	}
	witness, err := signing.OpenWitness(ctx, db, policy, protector)
	if err != nil {
		return err
	}
	defer witness.Close()
	signer, err := signing.NewSigner(policy, ikm, protector, witness)
	clear(ikm)
	clear(raw)
	if err != nil {
		return err
	}
	defer signer.Close()
	config, pin, err := signing.LoadTLS(*cert, *key, *ca, *peer, true)
	if err != nil {
		return err
	}
	server := &http.Server{Addr: *listen, Handler: signing.Handler(signer, pin), TLSConfig: config, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	listener, err := net.Listen("tcp", *listen)
	if err != nil {
		return err
	}
	go func() {
		<-ctx.Done()
		timeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(timeout)
	}()
	err = server.ServeTLS(listener, "", "")
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "protected signer halted:", err)
		os.Exit(1)
	}
}
