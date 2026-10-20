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
    adb("shell","uiautomator","dump","/sdcard/liftd-ui.xml")
    subprocess.check_call(["adb","pull","/sdcard/liftd-ui.xml",str(OUT/"screen.xml")],stdout=subprocess.DEVNULL)
    return ET.parse(OUT/"screen.xml").getroot()

def locate(label):
    root=tree()
    for node in root.iter("node"):
        if node.attrib.get("text")==label or node.attrib.get("content-desc")==label:
            return node
    raise AssertionError(f"Expected visible UI node absent: {label}")

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
capture("rider-denied")
tap("Return to role selection")
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
