//go:build blst

package signing

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"github.com/420integrated/420-integrated/consensus/attestation"
	"github.com/420integrated/420-integrated/consensus/finality"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	cc "github.com/420integrated/420-integrated/consensus/crypto"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	"github.com/420integrated/420-integrated/consensus/slashing"
	ct "github.com/420integrated/420-integrated/consensus/types"
)

func privateDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	return dir
}
func root(n byte) (r ct.Root) { r[0] = n; return }
func policy(t *testing.T) (Policy, []byte) {
	t.Helper()
	ikm := make([]byte, 32)
	if _, err := rand.Read(ikm); err != nil {
		t.Fatal(err)
	}
	key, pk, err := bls.SecretFromIKM(ikm)
	if err != nil {
		t.Fatal(err)
	}
	key.Destroy()
	return Policy{Identity: slashing.HistoryIdentity{ChainID: 420, Genesis: sha256.Sum256(pk[:]), ValidatorID: 42, PublicKey: pk}, ProtocolVersion: 1, CommitteeRoot: root(2), Seat: 0}, ikm
}
func proposal(p Policy, slot uint64) Duty {
	return Duty{ChainID: 420, Genesis: p.Identity.Genesis, ValidatorID: p.Identity.ValidatorID, ProtocolVersion: 1, Kind: "proposal", Proposal: &ct.ConsensusBlock{Slot: slot, ProposerSeat: p.Seat, CommitteeRoot: p.CommitteeRoot, ParentConsensusRoot: root(3), ExecutionPayloadHash: root(4), ConsensusStateRoot: root(5), SystemCallBatchRoot: root(6)}}
}
func vote(p Policy, slot, source, target uint64) Duty {
	return Duty{ChainID: 420, Genesis: p.Identity.Genesis, ValidatorID: p.Identity.ValidatorID, ProtocolVersion: 1, Kind: "qc-vote", Vote: &ct.AttestationData{Slot: slot, BlockRoot: root(8), ParentRoot: root(7), Source: ct.Checkpoint{Slot: source, Root: root(1)}, Target: ct.Checkpoint{Slot: target, Root: root(9)}}}
}
func database(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("STAKE_SIGNER_PG_DSN")
	if dsn == "" {
		if os.Getenv("STAKE_SIGNER_REQUIRE_PG") == "1" {
			t.Fatal("PostgreSQL qualification DSN required")
		}
		t.Skip("set STAKE_SIGNER_PG_DSN for independent-witness qualification")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err = db.Exec(WitnessSchema); err != nil {
		t.Fatal(err)
	}
	return db
}
func history(t *testing.T, p Policy) (string, *slashing.Protector) {
	t.Helper()
	path := filepath.Join(privateDir(t), "history.json")
	if err := slashing.InitializeHistory(path, p.Identity); err != nil {
		t.Fatal(err)
	}
	h, err := slashing.OpenProtector(path, p.Identity)
	if err != nil {
		t.Fatal(err)
	}
	return path, h
}
func protected(t *testing.T, p Policy, ikm []byte, db *sql.DB) (*Signer, *slashing.Protector, *Witness, string) {
	t.Helper()
	path, h := history(t, p)
	if err := ProvisionWitness(context.Background(), db, p, h); err != nil {
		t.Fatal(err)
	}
	w, err := OpenWitness(context.Background(), db, p, h)
	if err != nil {
		t.Fatal(err)
	}
	s, err := NewSigner(p, ikm, h, w)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close(); w.Close(); h.Close() })
	return s, h, w, path
}

type tlsFiles struct {
	dir   string
	roots *x509.CertPool
	certs map[string]tls.Certificate
	pins  map[string][32]byte
}

func transportFiles(t *testing.T) tlsFiles {
	t.Helper()
	dir := privateDir(t)
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "9.1 qualification CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	caDER, err := x509.CreateCertificate(rand.Reader, ca, ca, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatal(err)
	}
	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})
	os.WriteFile(filepath.Join(dir, "ca.pem"), caPEM, 0600)
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(caPEM)
	out := tlsFiles{dir: dir, roots: roots, certs: map[string]tls.Certificate{}, pins: map[string][32]byte{}}
	for i, name := range []string{"server", "client", "unauthorized"} {
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		leaf := &x509.Certificate{SerialNumber: big.NewInt(int64(i + 2)), Subject: pkix.Name{CommonName: name}, NotBefore: ca.NotBefore, NotAfter: ca.NotAfter, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}
		if name == "server" {
			leaf.ExtKeyUsage = []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}
			leaf.DNSNames = []string{"localhost"}
			leaf.IPAddresses = []net.IP{net.ParseIP("127.0.0.1")}
		}
		der, err := x509.CreateCertificate(rand.Reader, leaf, ca, &key.PublicKey, caKey)
		if err != nil {
			t.Fatal(err)
		}
		parsed, _ := x509.ParseCertificate(der)
		keyDER, _ := x509.MarshalPKCS8PrivateKey(key)
		certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
		keyPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
		os.WriteFile(filepath.Join(dir, name+".pem"), certPEM, 0600)
		os.WriteFile(filepath.Join(dir, name+".key"), keyPEM, 0600)
		pair, err := tls.X509KeyPair(certPEM, keyPEM)
		if err != nil {
			t.Fatal(err)
		}
		out.certs[name] = pair
		out.pins[name] = SPKIPin(parsed)
	}
	return out
}
func TestAuthenticatedBLSBoundary(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	s, _, _, _ := protected(t, p, ikm, db)
	f := transportFiles(t)
	config, err := MutualTLS(f.certs["server"], f.roots, f.pins["client"], true)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewUnstartedServer(Handler(s, f.pins["client"]))
	server.TLS = config
	server.StartTLS()
	defer server.Close()
	_, local := history(t, p)
	defer local.Close()
	clientConfig, _ := MutualTLS(f.certs["client"], f.roots, f.pins["server"], false)
	client, err := NewClient(server.URL, clientConfig, p, local)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	d := proposal(p, 10)
	got, err := client.Sign(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	if err = verifyResult(p, d, got); err != nil {
		t.Fatal(err)
	}
	wrongDomain := cc.SigningRoot(cc.DomainAttestation, 420, 1, d.Proposal.HashTreeRoot())
	if bls.Verify(got.PublicKey, wrongDomain[:], got.Signature) {
		t.Fatal("proposal signature accepted in vote domain")
	}
	retry, err := client.Sign(context.Background(), d)
	if err != nil || retry != got {
		t.Fatal("same-root retry not deterministic", err)
	}
	d.Proposal.ExecutionPayloadHash = root(99)
	if _, err = client.Sign(context.Background(), d); err == nil {
		t.Fatal("double proposal accepted")
	}
	if _, err = client.Sign(context.Background(), proposal(p, 11)); err == nil {
		t.Fatal("conflicted client continued signing")
	}
}
func TestVoteSafetyAndDomainContext(t *testing.T) {
	db := database(t)
	for _, test := range []struct {
		name          string
		first, second [3]uint64
	}{{"target-double-vote", [3]uint64{10, 1, 8}, [3]uint64{11, 2, 8}}, {"surround", [3]uint64{10, 1, 9}, [3]uint64{11, 2, 8}}, {"surrounded", [3]uint64{10, 2, 8}, [3]uint64{11, 1, 9}}} {
		t.Run(test.name, func(t *testing.T) {
			p, ikm := policy(t)
			s, _, _, _ := protected(t, p, ikm, db)
			if _, err := s.Sign(context.Background(), vote(p, test.first[0], test.first[1], test.first[2])); err != nil {
				t.Fatal(err)
			}
			if _, err := s.Sign(context.Background(), vote(p, test.second[0], test.second[1], test.second[2])); err == nil {
				t.Fatal("slashable vote signed")
			}
		})
	}
	p, ikm := policy(t)
	s, h, _, _ := protected(t, p, ikm, db)
	d := vote(p, 10, 1, 8)
	result, err := s.Sign(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	if err = verifyResult(p, d, result); err != nil {
		t.Fatal(err)
	}
	changed := p
	changed.CommitteeRoot = root(99)
	if _, err = changed.Reserve(h, d); err == nil {
		t.Fatal("same vote signed for a different QC committee")
	}
}
func TestOfflineRollbackAndExplicitRecovery(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	path, h := history(t, p)
	old, _ := h.Snapshot()
	if err := ProvisionWitness(context.Background(), db, p, h); err != nil {
		t.Fatal(err)
	}
	w, err := OpenWitness(context.Background(), db, p, h)
	if err != nil {
		t.Fatal(err)
	}
	s, err := NewSigner(p, ikm, h, w)
	if err != nil {
		t.Fatal(err)
	}
	d := proposal(p, 10)
	signed, err := s.Sign(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
	w.Close()
	h.Close()
	if err = os.WriteFile(path, old, 0600); err != nil {
		t.Fatal(err)
	}
	h, err = slashing.OpenProtector(path, p.Identity)
	if err != nil {
		t.Fatal(err)
	}
	if unexpected, err := OpenWitness(context.Background(), db, p, h); err == nil {
		unexpected.Close()
		t.Fatal("offline journal rollback accepted")
	}
	h.Close()
	if err = RecoverWitnessHistory(context.Background(), db, p, path); err != nil {
		t.Fatal(err)
	}
	h, err = slashing.OpenProtector(path, p.Identity)
	if err != nil {
		t.Fatal(err)
	}
	defer h.Close()
	w, err = OpenWitness(context.Background(), db, p, h)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	s, err = NewSigner(p, ikm, h, w)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	retry, err := s.Sign(context.Background(), d)
	if err != nil || retry != signed {
		t.Fatal("witness recovery lost idempotent signature", err)
	}
	d.Proposal.ExecutionPayloadHash = root(98)
	if _, err = s.Sign(context.Background(), d); err == nil {
		t.Fatal("witness recovery lost equivocation protection")
	}
}
func TestWitnessLossLockAndUncertainCommit(t *testing.T) {
	db := database(t)
	p, _ := policy(t)
	path, h := history(t, p)
	defer h.Close()
	if err := ProvisionWitness(context.Background(), db, p, h); err != nil {
		t.Fatal(err)
	}
	w, err := OpenWitness(context.Background(), db, p, h)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	// A second local protector is blocked; a separate journal cannot acquire the
	// independently held witness key lock either.
	if other, err := slashing.OpenProtector(path, p.Identity); err == nil {
		other.Close()
		t.Fatal("duplicate local signer accepted")
	}
	_, other := history(t, p)
	defer other.Close()
	if second, err := OpenWitness(context.Background(), db, p, other); err == nil {
		second.Close()
		t.Fatal("duplicate remote identity accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	err = w.Commit(ctx, func() ([]byte, error) {
		if _, err := p.Reserve(h, proposal(p, 10)); err != nil {
			return nil, err
		}
		raw, err := h.Snapshot()
		cancel()
		return raw, err
	})
	if err == nil {
		t.Fatal("canceled witness write accepted")
	}
	if err = w.Commit(context.Background(), func() ([]byte, error) { t.Fatal("failed witness continued reserving"); return nil, nil }); err == nil {
		t.Fatal("uncertain signer not halted")
	}
}
func TestInvalidTypedDutiesAndCredentialBoundaries(t *testing.T) {
	p, _ := policy(t)
	d := proposal(p, 10)
	for _, mutate := range []func(*Duty){func(d *Duty) { d.ChainID++ }, func(d *Duty) { d.Genesis = root(90) }, func(d *Duty) { d.ValidatorID++ }, func(d *Duty) { d.ProtocolVersion++ }, func(d *Duty) { d.Kind = "recovery" }, func(d *Duty) { d.Proposal = nil }, func(d *Duty) { d.Vote = vote(p, 10, 1, 8).Vote }} {
		b, _ := json.Marshal(d)
		var changed Duty
		json.Unmarshal(b, &changed)
		mutate(&changed)
		if _, err := p.Root(changed); err == nil {
			t.Fatal("invalid typed duty accepted")
		}
	}
	f := transportFiles(t)
	if _, err := MutualTLS(f.certs["client"], f.roots, f.pins["client"], false); err == nil {
		t.Fatal("same client/server transport identity accepted")
	}
	path := filepath.Join(t.TempDir(), "key")
	os.WriteFile(path, []byte("secret"), 0644)
	if _, err := PrivateFile(path); err == nil {
		t.Fatal("publicly readable credential accepted")
	}
	os.Chmod(path, 0600)
	link := path + ".link"
	os.Symlink(path, link)
	if _, err := PrivateFile(link); err == nil {
		t.Fatal("symlink credential accepted")
	}
	b, _ := json.Marshal(p)
	sum := sha256.Sum256(b)
	policyPath := filepath.Join(t.TempDir(), "policy.json")
	os.WriteFile(policyPath, b, 0600)
	if _, err := LoadPolicy(policyPath, hex.EncodeToString(sum[:])); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadPolicy(policyPath, string(bytes.Repeat([]byte("0"), 64))); err == nil {
		t.Fatal("policy pin bypass")
	}
}

func TestUnauthorizedTransportAndInvalidRemoteResults(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	s, h, _, _ := protected(t, p, ikm, db)
	f := transportFiles(t)
	serverConfig, _ := MutualTLS(f.certs["server"], f.roots, f.pins["client"], true)
	server := httptest.NewUnstartedServer(Handler(s, f.pins["client"]))
	server.TLS = serverConfig
	server.StartTLS()
	defer server.Close()
	before, _ := h.Snapshot()
	_, local := history(t, p)
	defer local.Close()
	unauthorized, _ := MutualTLS(f.certs["unauthorized"], f.roots, f.pins["server"], false)
	client, err := NewClient(server.URL, unauthorized, p, local)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if _, err = client.Sign(context.Background(), proposal(p, 10)); err == nil {
		t.Fatal("unauthorized mTLS signer client accepted")
	}
	after, _ := h.Snapshot()
	if !bytes.Equal(before, after) {
		t.Fatal("unauthorized request changed remote history")
	}
	d := proposal(p, 10)
	good, err := s.Sign(context.Background(), d)
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"root", "key", "signature"} {
		t.Run(kind, func(t *testing.T) {
			bad := good
			switch kind {
			case "root":
				bad.SigningRoot = root(99)
			case "key":
				bad.PublicKey[0] ^= 1
			case "signature":
				bad.Signature[0] ^= 1
			}
			fake := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _ = json.NewEncoder(w).Encode(bad) }))
			fake.TLS = serverConfig.Clone()
			fake.StartTLS()
			defer fake.Close()
			_, local := history(t, p)
			defer local.Close()
			config, _ := MutualTLS(f.certs["client"], f.roots, f.pins["server"], false)
			c, err := NewClient(fake.URL, config, p, local)
			if err != nil {
				t.Fatal(err)
			}
			defer c.Close()
			if _, err = c.Sign(context.Background(), d); err == nil {
				t.Fatal("unverified remote signature accepted")
			}
		})
	}
}
func TestIndependentWitnessCannotDisappearOrChange(t *testing.T) {
	db := database(t)
	for _, mode := range []string{"missing", "corrupt"} {
		t.Run(mode, func(t *testing.T) {
			p, ikm := policy(t)
			s, h, _, _ := protected(t, p, ikm, db)
			before, _ := h.Snapshot()
			if mode == "missing" {
				if _, err := db.Exec(`delete from stake_signing_witness_v1 where identity=$1`, identityKey(p)); err != nil {
					t.Fatal(err)
				}
			} else {
				if _, err := db.Exec(`update stake_signing_witness_v1 set digest='corrupt' where identity=$1`, identityKey(p)); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := s.Sign(context.Background(), proposal(p, 10)); err == nil {
				t.Fatal("unavailable/corrupt witness permitted signing")
			}
			after, _ := h.Snapshot()
			if !bytes.Equal(before, after) {
				t.Fatal("unavailable witness permitted local reservation")
			}
		})
	}
}

type blsAggregator struct{}

func (blsAggregator) Aggregate(signatures []ct.BLSSignature) (ct.BLSSignature, error) {
	return bls.Aggregate(signatures)
}
func TestProtectedVotesAssembleVerifiableProductionQC(t *testing.T) {
	db := database(t)
	p, _ := policy(t)
	d := vote(p, 10, 1, 8)
	collector := attestation.NewCollector(15, *d.Vote)
	pubkeys := make([]ct.BLSPubkey, 15)
	for i := 0; i < 15; i++ {
		member, ikm := policy(t)
		member.Seat = uint16(i)
		member.Identity.ValidatorID = uint64(i + 1)
		member.Identity.Genesis = p.Identity.Genesis
		pubkeys[i] = member.Identity.PublicKey
		if i >= 11 {
			continue
		}
		s, _, _, _ := protected(t, member, ikm, db)
		memberDuty := d
		memberDuty.ValidatorID = member.Identity.ValidatorID
		share, err := s.Sign(context.Background(), memberDuty)
		if err != nil {
			t.Fatal(err)
		}
		if err = collector.Add(ct.Attestation{Seat: uint16(i), Data: *d.Vote, Signature: share.Signature}); err != nil {
			t.Fatal(err)
		}
	}
	qc, err := collector.AssembleQC(1, p.CommitteeRoot, blsAggregator{})
	if err != nil {
		t.Fatal(err)
	}
	if err = finality.VerifyQC(qc, pubkeys, 420, bls.ProductionVerifier{}); err != nil {
		t.Fatal(err)
	}
	qc.BlockRoot = root(99)
	if err = finality.VerifyQC(qc, pubkeys, 420, bls.ProductionVerifier{}); err == nil {
		t.Fatal("QC tampering accepted")
	}
}

func TestExistingHistoryImportAndPersistenceFailure(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	_, h := history(t, p)
	defer h.Close()
	if _, err := p.Reserve(h, proposal(p, 10)); err != nil {
		t.Fatal(err)
	}
	if err := ProvisionWitness(context.Background(), db, p, h); err == nil {
		t.Fatal("used history silently provisioned as fresh")
	}
	raw, _ := h.Snapshot()
	if err := ImportWitness(context.Background(), db, p, h, strings.Repeat("0", 64)); err == nil {
		t.Fatal("unverified import accepted")
	}
	if err := ImportWitness(context.Background(), db, p, h, digest(raw)); err != nil {
		t.Fatal(err)
	}
	if err := ImportWitness(context.Background(), db, p, h, digest(raw)); err == nil {
		t.Fatal("existing witness overwritten")
	}
	w, err := OpenWitness(context.Background(), db, p, h)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	s, err := NewSigner(p, ikm, h, w)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	d := proposal(p, 10)
	d.Proposal.ExecutionPayloadHash = root(97)
	if _, err = s.Sign(context.Background(), d); err == nil {
		t.Fatal("legacy import lost protected proposal")
	}
	t.Run("file-write-failure", func(t *testing.T) {
		p, ikm := policy(t)
		s, h, _, path := protected(t, p, ikm, db)
		before, _ := h.Snapshot()
		dir := filepath.Dir(path)
		if err := os.Chmod(dir, 0500); err != nil {
			t.Fatal(err)
		}
		defer os.Chmod(dir, 0700)
		got, err := s.Sign(context.Background(), proposal(p, 10))
		if err == nil || got != (Result{}) {
			t.Fatal("failed history persistence released a signature")
		}
		disk, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(before, disk) {
			t.Fatal("failed reservation changed durable history")
		}
		var witnessed []byte
		if err = db.QueryRow(`select history from stake_signing_witness_v1 where identity=$1`, identityKey(p)).Scan(&witnessed); err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(before, witnessed) {
			t.Fatal("failed reservation advanced witness")
		}
	})
}

func TestWitnessTLSAndCredentialAuthentication(t *testing.T) {
	db := database(t)
	var secured bool
	var version string
	if err := db.QueryRow(`select ssl from pg_stat_ssl where pid=pg_backend_pid()`).Scan(&secured); err != nil || !secured {
		t.Fatal("witness fixture is not using TLS", err)
	}
	if err := db.QueryRow(`select version()`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	t.Logf("independent_witness=%s tls=true", version)
	parsed, err := url.Parse(os.Getenv("STAKE_SIGNER_PG_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	parsed.User = url.UserPassword(parsed.User.Username(), "incorrect-qualification-credential")
	bad, err := sql.Open("postgres", parsed.String())
	if err != nil {
		t.Fatal("malformed authentication fixture")
	}
	defer bad.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = bad.PingContext(ctx); err == nil {
		t.Fatal("witness fixture accepted incorrect database credentials")
	}
}

func TestWitnessForcesDurableAcknowledgement(t *testing.T) {
	db := database(t)
	p, _ := policy(t)
	_, h := history(t, p)
	defer h.Close()
	if err := ProvisionWitness(context.Background(), db, p, h); err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(os.Getenv("STAKE_SIGNER_PG_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	query := u.Query()
	query.Set("options", "-c synchronous_commit=off")
	u.RawQuery = query.Encode()
	asynchronous, err := sql.Open("postgres", u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer asynchronous.Close()
	w, err := OpenWitness(context.Background(), asynchronous, p, h)
	if err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	var commit string
	if err = w.conn.QueryRowContext(context.Background(), `show synchronous_commit`).Scan(&commit); err != nil || commit != "on" {
		t.Fatal("asynchronous witness acknowledgement permitted", err)
	}
}

func TestChangingKeyCannotCreateEmptyValidatorWitness(t *testing.T) {
	db := database(t)
	p, ikm := policy(t)
	s, originalHistory, originalWitness, _ := protected(t, p, ikm, db)
	if _, err := s.Sign(context.Background(), proposal(p, 10)); err != nil {
		t.Fatal(err)
	}
	s.Close()
	originalWitness.Close()
	originalHistory.Close()
	replacement, _ := policy(t)
	replacement.Identity.Genesis = p.Identity.Genesis
	replacement.Identity.ValidatorID = p.Identity.ValidatorID
	_, history := history(t, replacement)
	defer history.Close()
	if err := ProvisionWitness(context.Background(), db, replacement, history); err == nil {
		t.Fatal("BLS key change reset existing validator witness")
	}
}
