#!/usr/bin/env python3
import sys,os,subprocess,pathlib
if '--version' in sys.argv:sys.exit(subprocess.call(['/root/.svm/0.8.24/solc-0.8.24','--version']))
pathlib.Path(os.environ['CAPTURE_OUTPUT']).write_bytes(sys.stdin.buffer.read())
print('Captured compiler input for size qualification',file=sys.stderr);sys.exit(1)
