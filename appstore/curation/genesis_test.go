package curation

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestGenesisPayMatchesCanonicalCatalogueWalletRegistryAndHelp(t *testing.T) {
	apps, err := GenesisApplications()
	if err != nil || len(apps) != 2 {
		t.Fatalf("curated Genesis entries: %v, %v", apps, err)
	}
	pay := apps[0]
	var catalogue struct {
		Apps []struct{ Name, Class string }
	}
	if err := json.Unmarshal(readSource(t, "../../config/genesis-applications.json"), &catalogue); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, entry := range catalogue.Apps {
		if entry.Name == pay.Name && entry.Class == pay.Classification {
			found = true
		}
	}
	if !found {
		t.Fatal("curated Pay identity differs from the Genesis application decision")
	}
	wallet := string(readSource(t, "../../wallet/web/core/genesis-app-catalog.js"))
	registry := string(readSource(t, "../../contracts/src/libraries/ServiceIds420.sol"))
	if !strings.Contains(wallet, "id: 'pay', name: '"+pay.Name+"', serviceId: '"+pay.ServiceID+"'") ||
		!strings.Contains(registry, `PAY = keccak256("`+pay.ServiceID+`")`) {
		t.Fatalf("curated Pay ID %s differs from Wallet or Registry", pay.ServiceID)
	}
	var help struct {
		Applications map[string]struct {
			Environments []string
			Records      map[string]string
		}
	}
	if err := json.Unmarshal(readSource(t, "../../packages/420-docs-context/genesis-dapps.json"), &help); err != nil {
		t.Fatal(err)
	}
	payHelp := help.Applications["420-pay"]
	if payHelp.Records["CTX-PAY-002"] != pay.HelpRoute || !strings.Contains(strings.Join(payHelp.Environments, ","), "genesis") {
		t.Fatal("Pay help must use the published Genesis user guide")
	}
	want := []string{"consumer-payments", "merchant-dashboard", "retail-pos", "hosted-checkout", "android", "ios", "developer-integrations"}
	if len(pay.Expressions) != len(want) {
		t.Fatalf("expressions: %v", pay.Expressions)
	}
	for i, expression := range pay.Expressions {
		if expression.ID != want[i] || expression.Status != Planned {
			t.Fatalf("unexpected current expression: %+v", expression)
		}
	}
}

func TestGenesisRejectsInvalidAndAuthorityBearingMetadata(t *testing.T) {
	item := strings.TrimSpace(string(genesisApps))
	item = strings.TrimSpace(item[1 : len(item)-1])
	for name, data := range map[string]string{
		"duplicate service":    "[" + item + "," + item + "]",
		"duplicate expression": strings.Replace(string(genesisApps), `"id":"ios"`, `"id":"android"`, 1),
		"unrecognized status":  strings.Replace(string(genesisApps), `"planned"`, `"active"`, 1),
		"contract authority":   "[" + strings.Replace(item, "{", `{"implementation":"0x1234",`, 1) + "]",
		"settlement authority": "[" + strings.Replace(item, "{", `{"settlementAddress":"0x1234",`, 1) + "]",
		"launch URL":           strings.Replace(string(genesisApps), `"status":"planned"`, `"appUrl":"https://example.org","status":"planned"`, 1),
		"unsafe help":          strings.Replace(string(genesisApps), "apps/pay/user-guide/", "apps/pay/../../", 1),
		"trailing JSON":        string(genesisApps) + "{}",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := decodeGenesisApplications([]byte(data)); err == nil {
				t.Fatal("invalid catalogue was accepted")
			}
		})
	}
	for _, status := range []ReleaseStatus{LocallyImplemented, TestnetQualified, ProductionAvailable} {
		raw := strings.Replace(string(genesisApps), `"planned"`, `"`+string(status)+`"`, 1)
		if _, err := decodeGenesisApplications([]byte(raw)); err != nil {
			t.Fatalf("valid status %s rejected: %v", status, err)
		}
	}
}

func readSource(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestTokenCuratedIdentity(t *testing.T) {
 apps,err:=GenesisApplications();if err!=nil{t.Fatal(err)}
 token:=apps[1]
 if token.ServiceID!="420/service/token/v1"||token.Name!="420 Token"||token.Category!="finance"||token.Classification!="GENESIS_PROTOCOL_AND_USER_APP"||token.HelpRoute!="apps/token/user-guide/"||len(token.Expressions)!=2{t.Fatalf("Token identity: %+v",token)}
 wallet:=string(readSource(t,"../../wallet/web/core/genesis-app-catalog.js"));registry:=string(readSource(t,"../../contracts/src/libraries/ServiceIds420.sol"));help:=string(readSource(t,"../../packages/420-docs-context/genesis-dapps.json"))
 if !strings.Contains(wallet,"id: 'token', name: '420 Token', serviceId: '420/service/token/v1'")||!strings.Contains(registry,`TOKEN = keccak256("420/service/token/v1")`)||!strings.Contains(help,token.HelpRoute){t.Fatal("Token catalogue, Registry or help drift")}
 for _,x:=range token.Expressions{if x.Status!=LocallyImplemented{t.Fatal("curation promoted Token release availability")}}
}
