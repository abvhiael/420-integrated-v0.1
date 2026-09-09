#!/usr/bin/env python3
"""Enable Geth's existing P-256 verifier at 0x0100 for node420 Cancun/Prague rules.

420 launches with Cancun active at genesis while Prague is deliberately deferred.
Pinned go-ethereum v1.17.5 already contains the audited p256Verify implementation,
but upstream activates it only in the Osaka precompile table. This bounded patch
adds that same implementation to Cancun and Prague so the capability is stable
across a future Prague activation without pulling unrelated Osaka behavior forward.
"""

from pathlib import Path
import subprocess
import sys

EXPECTED_COMMIT = "9621c6ad10934a01b5514886fb6fbd87640b6c05"
TARGET = Path("core/vm/contracts.go")
P256_ENTRY = "\tcommon.BytesToAddress([]byte{0x1, 0x00}): &p256Verify{}, // 420: P-256 at 0x0100\n"


def die(message: str) -> None:
    raise SystemExit(f"fatal: {message}")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        die(f"{label} anchor count {count}, expected exactly 1")
    return source.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        die("usage: apply-420-p256.py <go-ethereum-checkout>")

    root = Path(sys.argv[1]).resolve()
    if not (root / ".git").exists():
        die(f"not a git checkout: {root}")

    commit = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip()
    if commit != EXPECTED_COMMIT:
        die(f"checkout is {commit}, expected {EXPECTED_COMMIT}")

    target = root / TARGET
    source = target.read_text()
    if "type p256Verify struct{}" not in source:
        die("pinned upstream no longer exposes the expected p256Verify implementation")
    if P256_ENTRY.strip() in source:
        die("420 P-256 patch is already applied")

    cancun_old = """var PrecompiledContractsCancun = PrecompiledContracts{\n\tcommon.BytesToAddress([]byte{0x1}): &ecrecover{},\n\tcommon.BytesToAddress([]byte{0x2}): &sha256hash{},\n\tcommon.BytesToAddress([]byte{0x3}): &ripemd160hash{},\n\tcommon.BytesToAddress([]byte{0x4}): &dataCopy{},\n\tcommon.BytesToAddress([]byte{0x5}): &bigModExp{eip2565: true, eip7823: false, eip7883: false},\n\tcommon.BytesToAddress([]byte{0x6}): &bn256AddIstanbul{},\n\tcommon.BytesToAddress([]byte{0x7}): &bn256ScalarMulIstanbul{},\n\tcommon.BytesToAddress([]byte{0x8}): &bn256PairingIstanbul{},\n\tcommon.BytesToAddress([]byte{0x9}): &blake2F{},\n\tcommon.BytesToAddress([]byte{0xa}): &kzgPointEvaluation{},\n}\n"""
    cancun_new = cancun_old[:-2] + P256_ENTRY + "}\n"
    source = replace_once(source, cancun_old, cancun_new, "Cancun precompile table")

    prague_old = """var PrecompiledContractsPrague = PrecompiledContracts{\n\tcommon.BytesToAddress([]byte{0x01}): &ecrecover{},\n\tcommon.BytesToAddress([]byte{0x02}): &sha256hash{},\n\tcommon.BytesToAddress([]byte{0x03}): &ripemd160hash{},\n\tcommon.BytesToAddress([]byte{0x04}): &dataCopy{},\n\tcommon.BytesToAddress([]byte{0x05}): &bigModExp{eip2565: true, eip7823: false, eip7883: false},\n\tcommon.BytesToAddress([]byte{0x06}): &bn256AddIstanbul{},\n\tcommon.BytesToAddress([]byte{0x07}): &bn256ScalarMulIstanbul{},\n\tcommon.BytesToAddress([]byte{0x08}): &bn256PairingIstanbul{},\n\tcommon.BytesToAddress([]byte{0x09}): &blake2F{},\n\tcommon.BytesToAddress([]byte{0x0a}): &kzgPointEvaluation{},\n\tcommon.BytesToAddress([]byte{0x0b}): &bls12381G1Add{},\n\tcommon.BytesToAddress([]byte{0x0c}): &bls12381G1MultiExp{},\n\tcommon.BytesToAddress([]byte{0x0d}): &bls12381G2Add{},\n\tcommon.BytesToAddress([]byte{0x0e}): &bls12381G2MultiExp{},\n\tcommon.BytesToAddress([]byte{0x0f}): &bls12381Pairing{},\n\tcommon.BytesToAddress([]byte{0x10}): &bls12381MapG1{},\n\tcommon.BytesToAddress([]byte{0x11}): &bls12381MapG2{},\n}\n"""
    prague_new = prague_old[:-2] + P256_ENTRY + "}\n"
    source = replace_once(source, prague_old, prague_new, "Prague precompile table")

    target.write_text(source)
    subprocess.check_call(["gofmt", "-w", str(target)])
    print("enabled node420 P-256 precompile at 0x0100 for Cancun and Prague")


if __name__ == "__main__":
    main()
