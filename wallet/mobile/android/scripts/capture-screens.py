#!/usr/bin/env python3
"""Screenshots from real running Android debug application on emulator.
The screenshot-only build disables FLAG_SECURE, without changing main source.
All display content is unconnected; no wallet authority or secrets are seeded.
"""
import re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path

root=Path("visual-captures");root.mkdir(exist_ok=True)
app="io.fourtwenty.wallet/.MainActivity"
def adb(*args):
 return subprocess.run(["adb",*args],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE).stdout
def snap(name):
 time.sleep(1.5)
 data=adb("exec-out","screencap","-p")
 assert data[:8]==b"\x89PNG\r\n\x1a\n",f"not PNG: {name}"
 path=root/(name+".png")
 path.write_bytes(data)
 print(f"Captured {path}, {len(data)} bytes",flush=True)
def click(label):
 for attempt in range(8):
  adb("shell","uiautomator","dump","/sdcard/window.xml")
  content=adb("shell","cat","/sdcard/window.xml").decode("utf-8",errors="replace")
  xml=ET.fromstring(content[content.index("<?xml"):])
  for el in xml.iter("node"):
   if label==el.get("text") or label==el.get("content-desc"):
    bounds=el.get("bounds") or ""
    coords=list(map(int,re.findall(r"\d+",bounds)))
    if len(coords)==4:
     x=(coords[0]+coords[2])//2;y=(coords[1]+coords[3])//2
     adb("shell","input","tap",str(x),str(y))
     print(f"Tapped {label} at {x},{y}",flush=True)
     time.sleep(1)
     return
  time.sleep(1)
 raise RuntimeError(f"Could not find visible Android element: {label}")

adb("install","-r","app/build/outputs/apk/debug/app-debug.apk")
adb("shell","am","start","-n",app)
time.sleep(3)
snap("android-01-onboarding")
click("Set up a new wallet")
snap("android-02-onboarding-security")
click("Complete onboarding")
snap("android-03-wallet")
for n,label in enumerate(["Apps","Activity","Security"],4):
 click(label+" tab")
 snap(f"android-0{n}-{label.lower()}")
