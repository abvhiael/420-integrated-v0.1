#!/usr/bin/env python3
"""MBL-A Android emulator UI journey: real taps against the installed nonproduction application.
No service authority, financial transaction, or credential acceptance is asserted.
"""
import json, os, re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path

PKG="org.integrated420.liftd.preview"
OUT=Path("mbl-a-android-evidence")
OUT.mkdir(exist_ok=True)

def adb(*args):
    return subprocess.check_output(["adb",*args],text=True,timeout=75).strip()

def tree():
    # Android UIAutomator may return a null root while React Native is rendering or
    # Android accessibility is starting. Retry is bounded and never counts as PASS.
    last_error = "unknown"
    for attempt in range(8):
        try:
            adb("shell","rm","-f","/sdcard/liftd-ui.xml")
            result=subprocess.run(["adb","shell","uiautomator","dump","--compressed","/sdcard/liftd-ui.xml"],
                                  capture_output=True,text=True,timeout=40)
            if result.returncode != 0 or "null root node" in result.stdout+result.stderr:
                raise RuntimeError((result.stdout+result.stderr)[-400:])
            xml=subprocess.run(["adb","exec-out","cat","/sdcard/liftd-ui.xml"],
                               capture_output=True,timeout=35,check=True).stdout
            if b"<hierarchy" not in xml or b"<node" not in xml:
                raise RuntimeError("Hierarchy unavailable or empty")
            root=ET.fromstring(xml)
            (OUT/"screen.xml").write_bytes(xml)
            return root
        except (OSError,RuntimeError,ET.ParseError,subprocess.SubprocessError) as exc:
            last_error=str(exc)
            time.sleep(min(2+attempt,8))
    capture("hierarchy-failure")
    (OUT/"hierarchy-error.txt").write_text(last_error[-1500:])
    raise AssertionError("Android accessibility hierarchy unavailable after 8 bounded attempts: "+last_error[-200:])

def locate(label):
    # A missing target is NOT a transport failure. We never manufacture a node.
    for attempt in range(4):
        root=tree()
        for node in root.iter("node"):
            if label in node.attrib.get("text","") or label in node.attrib.get("content-desc",""):
                return node
        time.sleep(2)
    print("UI_HIERARCHY_DIAGNOSTIC", (OUT/"screen.xml").read_text(errors="replace")[:12000], flush=True)
    try:
        (OUT/"android-logcat.txt").write_text(adb("logcat","-d","-t","600","ReactNativeJS:V","ReactNative:V","Expo:V","AndroidRuntime:E","*:S"))
    except Exception as exc:
        (OUT/"logcat-error.txt").write_text(str(exc))
    capture("missing-"+re.sub(r"[^a-z0-9]+","-",label.lower())[:50])
    raise AssertionError(f"Expected UI node absent after UI readiness window: {label}")

def tap(label):
    bounds=locate(label).attrib.get("bounds","")
    numbers=[int(n) for n in re.findall(r"\d+",bounds)]
    assert len(numbers)==4, (label,bounds)
    adb("shell","input","tap",str((numbers[0]+numbers[2])//2),str((numbers[1]+numbers[3])//2))
    time.sleep(2)

def visible(label):
    locate(label)

def capture(name):
    with open(OUT/f"{name}.png","wb") as f:
        subprocess.run(["adb","exec-out","screencap","-p"],stdout=f,check=True,timeout=60)

adb("shell","am","force-stop",PKG)
adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1")
time.sleep(6)
visible("Open rider preview")
visible("Open driver preview")
capture("welcome")
tap("Open rider preview")
visible("Your ride")
visible("NONPRODUCTION PREVIEW — booking, payment and dispatch disabled until authorized services are connected.")
visible("No confirmed trip")
for _ in range(4):
    try:
        payment_node=locate("Request payment intent with explicit consent")
        assert payment_node.attrib.get("enabled")=="false", "Payment intent unexpectedly enabled without an authorized trip"
        visible("No verified payment status")
        break
    except AssertionError as e:
        if "unexpectedly enabled" in str(e): raise
        adb("shell","input","swipe","480","1600","480","420","300")
else:
    raise AssertionError("Financial denial UI not found")
capture("rider-denied")
for _ in range(5):
    try:
        tap("Return to role selection")
        break
    except AssertionError:
        adb("shell","input","swipe","480","1600","480","400","350")
else:
    raise AssertionError("Return to role selection could not be reached")
tap("Open driver preview")
visible("Driver workspace")
visible("Unverified — cannot drive")
visible("Not confirmed online")
capture("driver-denied")
adb("shell","am","force-stop",PKG)
adb("shell","monkey","-p",PKG,"-c","android.intent.category.LAUNCHER","1")
time.sleep(5)
visible("Open rider preview")
visible("Open driver preview")
capture("relaunch-no-authority")
with open(OUT/"interactive-result.json","w") as f:
    json.dump({"rider_preview":"passed","driver_preview":"passed","identity":"unconfigured-deny","financial":"unconfigured-deny","relaunch":"no-role-resumption","testnet_authority":"not_claimed"},f,indent=2)
print("MBL-A Android interactive preview-denial and relaunch assertions: PASS")
