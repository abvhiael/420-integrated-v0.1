"""Independent checks over checkpoints emitted by native EVM execution (not generated expected receipts)."""
import json
import sys
from pathlib import Path
TOPIC = "0x647401a56253258955b39b7f540e68899d435772a9a445c26fc35ea637afaac7"


def verify(native):
    suites = json.loads(Path(native).read_text(encoding="utf-8-sig"))
    result = next(s["test_results"]["testNativeReplayExport()"] for s in suites.values()
                  if "testNativeReplayExport()" in s["test_results"])
    if result["status"] != "Success":
        raise ValueError("native replay did not pass")
    checkpoints = []
    for log in result["logs"]:
        # RegistryCheckpoint has 2 topics and five static ABI words.
        topics = log.get("topics", [])
        data = log.get("data", "")
        if isinstance(data, dict):
            topics = data.get("topics", topics)
            data = data.get("data", "")
        if not isinstance(data, str):
            continue
        raw = data.removeprefix("0x")
        if len(topics) != 2 or topics[0] != TOPIC or len(raw) != 320:
            continue
        step = int(topics[1], 16)
        words = [raw[i:i+64] for i in range(0, len(raw), 64)]
        checkpoints.append(dict(step=step, eligible=int(words[0],16), terms=words[1],
                                cutoff=int(words[2],16), epoch=int(words[3],16), revision=int(words[4],16)))
    expected = [True, False, False, False, True, False, False, True, False]
    if [x["step"] for x in checkpoints] != list(range(9)):
        raise ValueError("missing or duplicate native checkpoints")
    if [x["eligible"] for x in checkpoints] != expected:
        raise ValueError("native observations disagree with independent lifecycle expectations")
    if len({x["terms"] for x in checkpoints}) != 1 or int(checkpoints[0]["terms"],16) == 0:
        raise ValueError("immutable terms changed or were absent")
    if {x["cutoff"] for x in checkpoints} != {1_800_003_000}:
        raise ValueError("reschedule extended original cutoff")
    if [x["epoch"] for x in checkpoints] != [2,2,2,3,4,4,4,6,7]:
        raise ValueError("quote invalidation sequence differs")
    if [x["revision"] for x in checkpoints] != [1,2,2,2,2,2,2,2,2]:
        raise ValueError("schedule revision history differs")
    return {"nativeCheckpoints":9,"independentReplayPassed":True,"checkpoints":checkpoints}


if __name__ == "__main__":
    print(json.dumps(verify(sys.argv[1]), indent=2))
