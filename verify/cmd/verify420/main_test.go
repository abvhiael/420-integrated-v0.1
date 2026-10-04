package main

import "testing"

func TestLoadConfigDeploymentContract(t *testing.T) {
	env := map[string]string{
		"VERIFY_CHAIN_ID":          "420",
		"VERIFY_RPC_URL":           "https://rpc.example.invalid",
		"VERIFY_READINESS_ADDRESS": "0x0000000000000000000000000000000000000420",
		"VERIFY_COMPILER_CACHE":    "/srv/420verify/compilers",
		"VERIFY_COMPILER_CATALOG":  "/etc/420verify/compiler-catalog.json",
		"VERIFY_EVIDENCE_STORE":    "/srv/420verify/evidence",
	}
	cfg, err := loadConfig(func(key string) string { return env[key] })
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ChainID != 420 {
		t.Fatalf("chain id=%d want=420", cfg.ChainID)
	}
	if cfg.ListenAddr != ":8425" {
		t.Fatalf("listen addr=%q want=:8425", cfg.ListenAddr)
	}
	if cfg.CompilerCatalog != env["VERIFY_COMPILER_CATALOG"] {
		t.Fatalf("compiler catalogue=%q", cfg.CompilerCatalog)
	}
}

func TestLoadConfigRejectsMissingDeploymentInputs(t *testing.T) {
	base := map[string]string{
		"VERIFY_RPC_URL":           "https://rpc.example.invalid",
		"VERIFY_READINESS_ADDRESS": "0x0000000000000000000000000000000000000420",
		"VERIFY_COMPILER_CACHE":    "/srv/420verify/compilers",
		"VERIFY_COMPILER_CATALOG":  "/etc/420verify/compiler-catalog.json",
		"VERIFY_EVIDENCE_STORE":    "/srv/420verify/evidence",
	}
	for _, key := range []string{
		"VERIFY_RPC_URL",
		"VERIFY_READINESS_ADDRESS",
		"VERIFY_COMPILER_CACHE",
		"VERIFY_COMPILER_CATALOG",
		"VERIFY_EVIDENCE_STORE",
	} {
		t.Run(key, func(t *testing.T) {
			env := make(map[string]string, len(base))
			for k, v := range base {
				env[k] = v
			}
			delete(env, key)
			if _, err := loadConfig(func(name string) string { return env[name] }); err == nil {
				t.Fatalf("missing %s must fail closed", key)
			}
		})
	}
}

func TestLoadConfigRejectsInvalidChainID(t *testing.T) {
	env := map[string]string{
		"VERIFY_CHAIN_ID":          "0",
		"VERIFY_RPC_URL":           "https://rpc.example.invalid",
		"VERIFY_READINESS_ADDRESS": "0x0000000000000000000000000000000000000420",
		"VERIFY_COMPILER_CACHE":    "/srv/420verify/compilers",
		"VERIFY_COMPILER_CATALOG":  "/etc/420verify/compiler-catalog.json",
		"VERIFY_EVIDENCE_STORE":    "/srv/420verify/evidence",
	}
	if _, err := loadConfig(func(key string) string { return env[key] }); err == nil {
		t.Fatal("zero chain id must fail closed")
	}
}
