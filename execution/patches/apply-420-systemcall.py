#!/usr/bin/env python3
"""Apply the 420 consensus-system-call patch to an exact go-ethereum v1.17.5 tree.

Usage:
  python3 apply-420-systemcall.py /path/to/go-ethereum

The script is intentionally anchor-checked. It aborts rather than guessing if the pinned
upstream source does not match the expected v1.17.5 structure.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys

TAG = "v1.17.5"
EXPECTED_COMMIT = "9621c6ad10934a01b5514886fb6fbd87640b6c05"
HERE = pathlib.Path(__file__).resolve().parent
SYSTEMCALL_TEMPLATE = HERE / "systemcall420.go.in"


def replace_once(path: pathlib.Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"anchor mismatch in {path}: expected exactly one occurrence")
    path.write_text(text.replace(old, new, 1))


def git(root: pathlib.Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: apply-420-systemcall.py /path/to/go-ethereum")
    root = pathlib.Path(sys.argv[1]).resolve()
    if not (root / "go.mod").exists():
        raise SystemExit("not a go-ethereum source tree")
    if not SYSTEMCALL_TEMPLATE.exists():
        raise SystemExit(f"missing patch template: {SYSTEMCALL_TEMPLATE}")

    try:
        tag = git(root, "describe", "--tags", "--exact-match")
        commit = git(root, "rev-parse", "HEAD")
    except Exception as exc:
        raise SystemExit(f"cannot verify pinned geth source: {exc}")
    if tag != TAG:
        raise SystemExit(f"refusing to patch {tag!r}; expected {TAG}")
    if commit != EXPECTED_COMMIT:
        raise SystemExit(f"refusing to patch commit {commit}; expected {EXPECTED_COMMIT}")
    if git(root, "status", "--porcelain"):
        raise SystemExit("refusing to patch dirty go-ethereum tree")

    pkg = root / "core" / "systemcall420"
    pkg.mkdir(exist_ok=True)
    target = pkg / "systemcall.go"
    if target.exists():
        raise SystemExit(f"already patched: {target}")
    target.write_text(SYSTEMCALL_TEMPLATE.read_text())

    catalyst = root / "eth" / "catalyst" / "api.go"
    replace_once(
        catalyst,
        '"github.com/ethereum/go-ethereum/core"\n',
        '"github.com/ethereum/go-ethereum/core"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n',
    )
    replace_once(
        catalyst,
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n',
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n\t\t{Namespace: "engine420", Service: &SystemCallAPI{}, Authenticated: true},\n',
    )
    replace_once(
        catalyst,
        '\treturn nil\n}\n\nconst (\n',
        '\treturn nil\n}\n\n// SystemCallAPI stages committed consensus data but never executes EVM state from RPC context.\ntype SystemCallAPI struct{}\nfunc (api *SystemCallAPI) SubmitSystemCallsV1(batch systemcall420.Batch) systemcall420.Status {\n\tif err := systemcall420.Stage(batch); err != nil { s:=err.Error(); return systemcall420.Status{Status:"INVALID",BatchRoot:batch.BatchRoot,ValidationError:&s} }\n\treturn systemcall420.Status{Status:"ACCEPTED",BatchRoot:batch.BatchRoot}\n}\n\nconst (\n',
    )

    state_processor = root / "core" / "state_processor.go"
    replace_once(state_processor, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(
        state_processor,
        '"github.com/ethereum/go-ethereum/core/state"\n',
        '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n',
    )
    replace_once(
        state_processor,
        '\tblockAccessList.Merge(bal)\n\n\t// Finalize the block, applying any consensus engine specific extras\n',
        '\tblockAccessList.Merge(bal)\n\n\tif err := Process420SystemCalls(block.NumberU64(), block.ParentHash(), header.Extra, evm, uint32(len(block.Transactions())+2), blockAccessList); err != nil {\n\t\treturn nil, fmt.Errorf("420 consensus system calls: %w", err)\n\t}\n\n\t// Finalize the block, applying any consensus engine specific extras\n',
    )
    process_fn = r'''
// Process420SystemCalls executes the consensus-staged batch committed by header.extraData.
func Process420SystemCalls(number uint64, parent common.Hash, extra []byte, evm *vm.EVM, blockAccessIndex uint32, blockAccessList *bal.ConstructionBlockAccessList) error {
    batch, ok := systemcall420.Get(number, parent)
    if !ok {
        return systemcall420.ErrNotStaged
    }
    root := systemcall420.Root(batch)
    if len(extra) != 32 || !bytes.Equal(extra, root[:]) {
        return systemcall420.ErrRoot
    }
    for i, c := range batch.Calls {
        input, err := systemcall420.GatewayInput(c)
        if err != nil {
            return err
        }
        gasLimit, gasBudget := systemCallGasBudget(evm)
        to := systemcall420.GatewayAddress
        msg := &Message{From: params.SystemAddress, GasLimit: gasLimit, GasPrice: uint256.NewInt(0), GasFeeCap: uint256.NewInt(0), GasTipCap: uint256.NewInt(0), To: &to, Data: input}
        evm.SetTxContext(NewEVMTxContext(msg))
        evm.StateDB.Prepare(evm.GetRules(), common.Address{}, common.Address{}, nil, nil, nil)
        evm.StateDB.SetTxContext(common.Hash{}, 0, blockAccessIndex+uint32(i))
        evm.StateDB.AddAddressToAccessList(to)
        _, _, err = evm.Call(msg.From, *msg.To, msg.Data, gasBudget, common.U2560)
        if evm.StateDB.AccessEvents() != nil {
            evm.StateDB.AccessEvents().Merge(evm.AccessEvents)
        }
        local := evm.StateDB.Finalise(true)
        if err != nil {
            return fmt.Errorf("420 system call sequence %d: %w", uint64(c.Sequence), err)
        }
        blockAccessList.Merge(local)
    }
    return nil
}

'''
    replace_once(state_processor, '\nvar depositTopic = common.HexToHash(', '\n' + process_fn + 'var depositTopic = common.HexToHash(')

    worker = root / "miner" / "worker.go"
    replace_once(worker, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(
        worker,
        '"github.com/ethereum/go-ethereum/core/state"\n',
        '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n',
    )
    replace_once(
        worker,
        '\twork.bal.Merge(bal)\n\n\t// Apply the consensus-specific post-transaction changes\n',
        '\twork.bal.Merge(bal)\n\tif err := core.Process420SystemCalls(work.header.Number.Uint64(), work.header.ParentHash, work.header.Extra, work.evm, uint32(work.tcount+2), work.bal); err != nil {\n\t\treturn &newPayloadResult{err: err}\n\t}\n\n\t// Apply the consensus-specific post-transaction changes\n',
    )
    replace_once(
        worker,
        '\tif len(miner.config.ExtraData) != 0 {\n\t\theader.Extra = miner.config.ExtraData\n\t}\n\tif genParams.forceOverrides {\n\t\theader.Extra = genParams.overrideExtraData\n\t}\n',
        '\tif len(miner.config.ExtraData) != 0 {\n\t\theader.Extra = miner.config.ExtraData\n\t}\n\troot420, ok420 := systemcall420.RootFor(number.Uint64(), parent.Hash())\n\tif !ok420 {\n\t\treturn nil, systemcall420.ErrNotStaged\n\t}\n\theader.Extra = root420[:]\n\tif genParams.forceOverrides {\n\t\tif len(genParams.overrideExtraData) != 0 && !bytes.Equal(genParams.overrideExtraData, root420[:]) {\n\t\t\treturn nil, systemcall420.ErrRoot\n\t\t}\n\t\theader.Extra = root420[:]\n\t}\n',
    )

    subprocess.check_call(["gofmt", "-w", str(target), str(catalyst), str(state_processor), str(worker)])
    print("420 system-call patch applied to", root)


if __name__ == "__main__":
    main()
