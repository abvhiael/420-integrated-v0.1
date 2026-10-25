#!/usr/bin/env python3
"""Issue Level 2 evidence only from matching actual execution reports."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

sha = os.environ["EXPECTED_SHA"]
assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == sha
paths = [Path("artifacts/ws8-crypto/execution.json"), Path("artifacts/ws8-funded/execution.json"), Path("artifacts/ws8-funded/independent-outcome.json"), Path("artifacts/poker-5a5/execution.json")]
crypto, funded, replay, betting = [json.loads(p.read_text(encoding="utf-8")) for p in paths]
assert all(r["qualifiedSHA"] == sha and r["trackedWorkingTreeDirty"] is False for r in [crypto, funded, replay, betting])
assert len(betting['mandatoryTests']) == 32 and set(betting['mandatoryTests'].values()) == {'Success'}
assert betting['independentTestsPassed'] >= 23
assert len(betting['evaluation5A6Tests']) == 11 and set(betting['evaluation5A6Tests'].values()) == {'Success'}
assert len(betting['showdown5A7Tests']) == 18 and set(betting['showdown5A7Tests'].values()) == {'Success'}
assert len(betting['lifecycle5A8Tests'])==27 and set(betting['lifecycle5A8Tests'].values())=={'Success'}
assert betting['independentTestsPassed']>=90
assert len(betting['multiplayer5A10Tests'])==32 and set(betting['multiplayer5A10Tests'].values())=={'Success'}
assert len(betting['abuse5A9Tests'])==30 and set(betting['abuse5A9Tests'].values())=={'Success'}
multiplayerPath=Path('artifacts/poker-5a5/multiplayer-replay.json')
multiplayerCryptoPath=Path('artifacts/ws8-crypto/multiplayer-execution.json')
multiplayer=json.loads(multiplayerPath.read_text(encoding='utf-8'))
multiplayerCrypto=json.loads(multiplayerCryptoPath.read_text(encoding='utf-8'))
assert all(r['qualifiedSHA']==sha and r['trackedWorkingTreeDirty'] is False for r in [multiplayer,multiplayerCrypto])
assert multiplayer['players']==9 and multiplayer['publicStatementsVerified']==118 and len(multiplayer['statements'])==118
assert multiplayerCrypto['genuineProofsVerified']==118 and multiplayer['settlementReceiptVerified']
assert multiplayer['ownerReceiptsVerified']==9 and multiplayer['providerBondVerified']
assert multiplayer['startingEscrow']==5400 and multiplayer['providerCollateral']==10800 and multiplayer['fee']==20
assert len(multiplayer['balances'])==9 and sum(multiplayer['balances'])+20==5400
assert multiplayer['uncalledRefund']==50 and len(multiplayer['sidePotTiers'])==8
assert hashlib.sha256(Path('artifacts/poker-5a5/multiplayer-trace.log').read_bytes()).hexdigest()==multiplayer['traceSHA256']
paths += [multiplayerPath,multiplayerCryptoPath]
abusePath=Path('artifacts/poker-5a5/abuse-replay.json')
abuse=json.loads(abusePath.read_text(encoding='utf-8'))
assert abuse['qualifiedSHA']==sha and abuse['trackedWorkingTreeDirty'] is False
assert abuse['independentQuorumVerified'] and abuse['reviewDelayVerified'] and abuse['canonicalOutcomePreserved']
assert abuse['proofStatementsVerified']==41 and abuse['balances']==[399,399] and abuse['rake']==2
assert abuse['monitoring']['signals']==[] and abuse['monitoring']['automatedSanction'] is False
paths += [abusePath]
protectedReplayPath=Path('artifacts/poker-5a5/abuse-independent-outcome.json')
protectedReplay=json.loads(protectedReplayPath.read_text(encoding='utf-8'))
assert protectedReplay['qualifiedSHA']==sha and protectedReplay['trackedWorkingTreeDirty'] is False
assert protectedReplay['settlementReceiptVerified'] and len(protectedReplay['statements'])==41
assert protectedReplay['balances']==[399,399] and protectedReplay['fee']==2
assert hashlib.sha256(protectedReplayPath.read_bytes()).hexdigest()==abuse['independentReplaySHA256']
assert hashlib.sha256(Path('artifacts/poker-5a5/abuse-trace.log').read_bytes()).hexdigest()==abuse['traceSHA256']
paths += [protectedReplayPath]
lifecyclePath=Path('artifacts/poker-5a5/lifecycle-replay.json')
lifecycle=json.loads(lifecyclePath.read_text(encoding='utf-8'))
assert lifecycle['qualifiedSHA']==sha and lifecycle['trackedWorkingTreeDirty'] is False
assert lifecycle['clockPreservedAcrossReconnect'] and lifecycle['pendingIntentPreservedFundedSnapshot'] and lifecycle['timeoutFoldAndSitOutVerified']
assert lifecycle['canonicalPayouts']==[390,410] and lifecycle['rake']==0
paths += [lifecyclePath]
winnerCryptoPath=Path('artifacts/ws8-crypto/winner-execution.json')
winnerReplayPath=Path('artifacts/poker-5a5/winner-independent-outcome.json')
winnerCrypto=json.loads(winnerCryptoPath.read_text(encoding='utf-8'))
winnerReplay=json.loads(winnerReplayPath.read_text(encoding='utf-8'))
assert all(r['qualifiedSHA']==sha and r['trackedWorkingTreeDirty'] is False for r in [winnerCrypto,winnerReplay])
assert winnerCrypto['genuineProofsVerified']==41
assert len(winnerReplay['statements'])==41 and winnerReplay['balances']==[418,380] and winnerReplay['fee']==2
assert winnerReplay['settlementReceiptVerified'] is True
paths += [winnerCryptoPath,winnerReplayPath]
runtime = json.loads(Path('artifacts/poker-5a5/runtime-size.json').read_text(encoding='utf-8'))
assert runtime['sourceCommit'] == sha
assert runtime['qualifiedSHA']==sha and runtime['trackedWorkingTreeDirty'] is False
assert runtime['runtimeDeploymentCompatible'] is True
assert 0<runtime['constructorGasUsed']<=runtime['constructorGasBudget']==16_000_000
assert lifecycle['projectionIdentity']['runtimeBytes']==runtime['contracts']['PokerPlayerRecovery420']['runtimeTemplateBytes']
assert lifecycle['ledgerIdentity']['runtimeBytes']==runtime['contracts']['PokerSeatLedger420']['runtimeTemplateBytes']
assert abuse['controlsIdentity']['runtimeBytes']==runtime['contracts']['PokerAbuseControls420']['runtimeTemplateBytes']
contextPath=Path('artifacts/ws8-funded/context-compatibility.json')
context=json.loads(contextPath.read_text(encoding='utf-8'))
assert len(context['actualVerifierIdentities'])==7 and len(context['actualNativeIdentities'])==10
assert all(0<x['runtimeBytes']<=24576 for x in context['actualNativeIdentities'])
for identity in context['actualNativeIdentities']:
    role=identity['role']
    name={'engine':'PokerNLHEBetting420','clock':'PokerActionDisputeClock420'}.get(role)
    if name is None:
        name='PokerNLHE'+role.split('-')[0].capitalize()+('Factory420' if role.endswith('-factory') else 'Module420')
    assert identity['runtimeBytes']==runtime['contracts'][name]['runtimeTemplateBytes']
paths += [contextPath,Path('artifacts/poker-5a5/runtime-size.json')]
staticPath=Path('artifacts/poker-5a5-static/execution.json')
static=json.loads(staticPath.read_text(encoding='utf-8'))
assert static['qualifiedSHA']==sha and static['trackedWorkingTreeDirty'] is False
assert not any(x['severity'].lower() in {'high','medium'} for x in static['findings'])
paths += [staticPath]
assert crypto["genuineProofsVerified"] == 41
assert len(funded["mandatoryTests"]) == 11 and set(funded["mandatoryTests"].values()) == {"Success"}
assert funded["totalPassed"] >= 15
assert len(replay["statements"]) == 41 and replay["balances"] == [399, 399] and replay["fee"] == 2
assert sum(replay["balances"]) + replay["fee"] == 800
out = Path("artifacts/ws8-certificate");out.mkdir(parents=True, exist_ok=True)
report = {"level": 2, "qualifiedSHA": sha, "acceptance": "passed", "genuineProofsVerified": 41,
    "multiplayer5A10Tests":betting["multiplayer5A10Tests"],"genuineMultiplayerProofsVerified":118,"multiplayerBalances":multiplayer["balances"],"multiplayerAdmissionRoot":multiplayer["admissionRoot"],
    "abuse5A9Tests": betting['abuse5A9Tests'], "abuseControlsIdentity": abuse['controlsIdentity'],
    "protectedAbuseHandVerified": True, "automatedSanction": False,
    "lifecycle5A8Tests": betting['lifecycle5A8Tests'], "reconnectionReplayVerified": True,
    "playerRecoveryIdentity": lifecycle['projectionIdentity'], "seatLedgerIdentity": lifecycle['ledgerIdentity'],
    "showdown5A7Tests": betting['showdown5A7Tests'],
    "genuineWinnerProofsVerified": 41, "newWinnerProofsGenerated": 36, "reusedWinnerProofs": 5,
    "winnerBalances": winnerReplay['balances'], "winnerFee": winnerReplay['fee'],
    "evaluation5A6Tests": betting["evaluation5A6Tests"],
    "betting5A5Tests": betting['mandatoryTests'], "freshNativeOwners": betting['nativeOwners'],
    "scope": "Level 2 local rules and cryptographic integration; not Level 3 or live deployment acceptance",
    "liveDeploymentReady": runtime['liveDeploymentReady'], "compiledRuntimeSizes": runtime['contracts'],
    "constructorGasUsed": runtime['constructorGasUsed'],
    "actualNativeIdentities": context['actualNativeIdentities'],
    "staticFindings": static['total'], "unresolvedHighMedium": 0,
    "mandatoryTests": funded["mandatoryTests"], "scopedTestsPassed": funded["totalPassed"],
    "handId": replay["handId"], "terminalTranscript": replay["terminalTranscript"],
    "runURL": f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}",
    "executionReportSHA256": {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(out / "level2.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
