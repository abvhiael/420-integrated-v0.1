#!/usr/bin/env python3
"""Diagnose Yul stack failure in a temporary copy of the already-isolated test.
No production code, invariant, or checked-in assertions are modified.
"""
import re
import subprocess
from pathlib import Path

p=Path("test/poker-l1/BetPokerNLHEBetting54.t.sol")
original=p.read_text()
pattern=re.compile(r"\bfunction\s+(test\w+)\s*\(")
functions={}
for m in pattern.finditer(original):
    start=original.find("{",m.end())
    if start<0:continue
    level=0
    for end in range(start,len(original)):
        if original[end]=="{":level+=1
        if original[end]=="}":
            level-=1
            if level==0:break
    functions[m.group(1)]=(start,end)
names=list(functions)
print("YUL_BISECT_TEST_FUNCTIONS",len(names),names,flush=True)

def attempt(stubbed,label):
    source=original
    for name in sorted(stubbed,key=lambda n:functions[n][0],reverse=True):
        a,b=functions[name]
        source=source[:a+1]+" revert(); "+source[b:]
    p.write_text(source)
    cmd=["forge","build",str(p)]
    run=subprocess.run(cmd,capture_output=True,text=True)
    messages=(run.stdout+"\n"+run.stderr)
    print("YUL_BISECT",label,"pass" if run.returncode==0 else "FAIL",
          "stubbed",",".join(stubbed),flush=True)
    if run.returncode:
        print("YUL_BISECT_ERROR",messages[-450:].replace("\n"," "),flush=True)
    return run.returncode==0

try:
    allstub=attempt(names,"all-test-bodies-disabled")
    if not allstub:
        print("YUL_BISECT_RESULT helper/constructor/inherited compilation culprit, not individual test body",flush=True)
    else:
        unmodified=list(names)
        while len(unmodified)>1:
            half=len(unmodified)//2
            # Keep first half as real functions; stub everything else.
            first=set(unmodified[:half])
            passed=attempt([n for n in names if n not in first],"half-"+str(len(first)))
            if passed:
                unmodified=unmodified[half:]
            else:
                unmodified=unmodified[:half]
        culprit=unmodified[0]
        stillfails=attempt([n for n in names if n!=culprit],"individual-"+culprit)
        print("YUL_BISECT_RESULT",culprit,"causes overflow" if not stillfails else "not isolated",flush=True)
finally:
    p.write_text(original)
