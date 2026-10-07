import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadBudtenderRuntimeConfig } from "../src/runtime-config.ts";

describe("Budtender runtime configuration", () => {
  it("uses loopback-safe defaults", () => {
    assert.deepEqual(loadBudtenderRuntimeConfig({}), {
      host: "127.0.0.1",
      port: 4207,
      publicOrigin: null,
    });
  });

  it("accepts valid loopback overrides", () => {
    assert.deepEqual(loadBudtenderRuntimeConfig({ HOST: "localhost", PORT: "4210" }), {
      host: "localhost",
      port: 4210,
      publicOrigin: null,
    });
  });

  it("fails closed on invalid ports", () => {
    for (const port of ["0", "65536", "-1", "abc", "1.5"]) {
      assert.throws(() => loadBudtenderRuntimeConfig({ PORT: port }), /PORT/);
    }
  });

  it("requires an explicit HTTPS public origin for non-loopback exposure", () => {
    assert.throws(
      () => loadBudtenderRuntimeConfig({ HOST: "0.0.0.0" }),
      /requires BUDTENDER_PUBLIC_ORIGIN/,
    );
    assert.throws(
      () => loadBudtenderRuntimeConfig({ HOST: "0.0.0.0", BUDTENDER_PUBLIC_ORIGIN: "http://bud.example" }),
      /requires HTTPS/,
    );

    assert.deepEqual(
      loadBudtenderRuntimeConfig({
        HOST: "0.0.0.0",
        PORT: "8080",
        BUDTENDER_PUBLIC_ORIGIN: "https://bud.example",
      }),
      {
        host: "0.0.0.0",
        port: 8080,
        publicOrigin: "https://bud.example",
      },
    );
  });

  it("rejects public origin strings containing path/query/credentials", () => {
    for (const origin of [
      "https://user:pass@bud.example",
      "https://bud.example/path",
      "https://bud.example/?x=1",
      "https://bud.example/#x",
    ]) {
      assert.throws(
        () => loadBudtenderRuntimeConfig({ HOST: "0.0.0.0", BUDTENDER_PUBLIC_ORIGIN: origin }),
        /origin only/,
      );
    }
  });
});
