#!/usr/bin/env python3
"""Capture actual Android screen rendering. CI-only debug build removes FLAG_SECURE
for screenshots and starts on Wallet, while committed production code is unchanged."""
import subprocess,time
from pathlib import Path
root=Path('visual-captures');root.mkdir(exist_ok=True)
def adb(*args):
 return subprocess.run(['adb',*args],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45).stdout
def snap(name):
 time.sleep(2)
 data=adb('exec-out','screencap','-p')
 assert data[:8]==b'\x89PNG\r\n\x1a\n',name
 (root/(name+'.png')).write_bytes(data)
 print('captured',name,len(data),flush=True)
adb('install','-r','app/build/outputs/apk/debug/app-debug.apk')
adb('shell','am','start','-n','io.fourtwenty.wallet/.MainActivity')
# Splash screen is shown for several seconds on cold emulator boot.
time.sleep(22)
snap('android-01-wallet')
# The four real tab Buttons occupy equal quarters of the bottom row of the 1080x2400 Pixel 6 viewport.
for n,(label,x) in enumerate([('apps',405),('activity',675),('security',945),('wallet-return',135)],2):
 adb('shell','input','tap',str(x),'2225')
 snap(f'android-0{n}-{label}')
