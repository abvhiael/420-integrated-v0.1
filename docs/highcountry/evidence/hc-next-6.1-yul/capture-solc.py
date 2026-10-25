#!/usr/bin/env python3
import sys,subprocess,pathlib
if '--version' in sys.argv:
 sys.exit(subprocess.call(['/root/.svm/0.8.24/solc-0.8.24','--version']))
pathlib.Path('/tmp/main-shard0-input.json').write_bytes(sys.stdin.buffer.read())
print('Captured compiler input for isolation',file=sys.stderr);sys.exit(1)
