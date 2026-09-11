package decoder

import "testing"

func TestCatalogServiceSummaryOrdersHistoryAndSelectsActive(t *testing.T) {
	c := NewCatalog()
	if err := c.ApplyVersion(VersionPublished{ServiceID:"swap",Version:1,Implementation:"0xaaa",BlockNumber:7,BlockHash:"0x07",Active:false}); err != nil { t.Fatal(err) }
	if err := c.ApplyVersion(VersionPublished{ServiceID:"swap",Version:2,Implementation:"0xbbb",BlockNumber:9,BlockHash:"0x09",Active:true}); err != nil { t.Fatal(err) }
	s, err := c.Service("SWAP"); if err != nil { t.Fatal(err) }
	if s.LatestVersion != 2 || s.ActiveVersion != 2 || s.Implementation != "0xbbb" { t.Fatalf("unexpected summary: %+v", s) }
	if len(s.Versions) != 2 || s.Versions[0].Version != 1 || s.Versions[1].Version != 2 { t.Fatalf("unexpected history: %+v", s.Versions) }
}

func TestCatalogServicesSortsByServiceID(t *testing.T) {
	c := NewCatalog()
	for _, ev := range []VersionPublished{{ServiceID:"zeta",Version:1,Implementation:"0x1",BlockNumber:1,BlockHash:"0x1",Active:true},{ServiceID:"alpha",Version:1,Implementation:"0x2",BlockNumber:2,BlockHash:"0x2",Active:true}} { if err := c.ApplyVersion(ev); err != nil { t.Fatal(err) } }
	got := c.Services(); if len(got)!=2 || got[0].ServiceID!="alpha" || got[1].ServiceID!="zeta" { t.Fatalf("unexpected services: %+v",got) }
}
