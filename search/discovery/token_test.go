package discovery

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/tokenread"
	"github.com/420integrated/420-integrated/search/architecture"
)

type tokenFixtureReader struct {
	fakeAssetValidatorReader
	p   tokenread.Projection
	err error
}

func (r *tokenFixtureReader) TokenDeployment(context.Context, string) (tokenread.Projection, error) {
	return r.p, r.err
}

func TestTokenSearchSnapshotAndAuthority(t *testing.T) {
	a := func(s string) string { return "0x" + strings.Repeat(s, 40) }
	h := func(s string) string { return "0x" + strings.Repeat(s, 64) }
	u := func(n uint64) *uint64 { return &n }
	r := &tokenFixtureReader{}
	r.status = status420()
	r.status.IndexedHeadHash = h("1")
	r.p = tokenread.Projection{ChainID: "420", GenesisHash: h("2"), SnapshotHeight: "100", SnapshotHash: h("1"), Token: a("a"), Creator: a("b"), Factory: a("c"), Vault: a("d"), Accounting: a("e"), TemplateID: "0x0517055aa8d8da1332a6a60f625f6d07c05e47f5b365f33b6fec4209c040ce0a", Template: "ERC20_FIXED", TemplateVersion: 1, ConfigHash: h("3"), CreationFeeWei: tokenread.FeeWei, BlockNumber: "88", BlockHash: h("4"), TransactionHash: h("5"), TransactionIndex: u(0), LogIndex: u(1), AccountingLogIndex: u(2), VaultLogIndex: u(3), FeeLogIndex: u(4), EvidenceKind: tokenread.Kind, Authoritative: new(bool)}
	d, err := NewAssetValidatorDiscovery(r)
	if err != nil {
		t.Fatal(err)
	}
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0) }
	got, err := d.ResolveToken(context.Background(), r.p.Token)
	if err != nil || len(got) != 1 || got[0].Domain != architecture.DomainAsset || got[0].Provenance.TransactionHash != r.p.TransactionHash {
		t.Fatalf("bad Token search result: %+v %v", got, err)
	}
	if !strings.Contains(got[0].Provenance.Authority, "not endorsement") {
		t.Fatal("historical projection promoted to endorsement")
	}
	*r.p.Authoritative = true
	if _, err := d.ResolveToken(context.Background(), r.p.Token); err == nil {
		t.Fatal("accepted authority")
	}
	*r.p.Authoritative = false
	r.p.SnapshotHash = h("9")
	if _, err := d.ResolveToken(context.Background(), r.p.Token); err == nil {
		t.Fatal("accepted reorg mismatch")
	}
	r.err = tokenread.ErrUnavailable
	if _, err := d.ResolveToken(context.Background(), r.p.Token); err == nil {
		t.Fatal("converted outage into not found")
	}
	r.err = tokenread.ErrNotFound
	if out, err := d.ResolveToken(context.Background(), r.p.Token); err != nil || len(out) != 0 {
		t.Fatalf("not observed: %v %v", out, err)
	}
}
