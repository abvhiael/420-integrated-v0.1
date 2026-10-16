import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const roadmap = readFileSync('docs/rideshare/LIFTD-ROADMAP.md', 'utf8');
for (const path of ['location/providers/provider.go', 'docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md',
  'docs/genesis-services/GEN-SVC-3-TRAVEL.md', 'packages/420-sdk/src/wallet.ts',
  'services/420bnb/identity.py', 'docs/doobr/DOOBR-R01-4-BC-VANCOUVER-COMPLIANCE-CONTRACT.md',
  'services/420bnb/README.md']) {
  assert.ok(existsSync(path), `Missing integration owner source: ${path}`);
  assert.ok(roadmap.includes(path), `Missing roadmap owner reference: ${path}`);
}
for (let step = 1; step <= 10; step++) assert.ok(roadmap.includes(`| L01.${step} |`));
for (const milestone of ['M-L01-A', 'M-L01-B']) assert.ok(roadmap.includes(milestone));
const policy = readFileSync('docs/rideshare/LIFTD-VANCOUVER-PILOT-ECONOMIC-POLICY.md', 'utf8');
for (const value of ['Vancouver', 'CAD 4.00', 'CAD 1.80/km', 'CAD 0.45/minute', 'CAD 10.00',
  '80% driver', '20% platform', 'CAD 25.00', 'CAD 0.45', '10% of collected LIFTd platform']) assert.ok(policy.includes(value));
assert.ok(readFileSync('docs/rideshare/LIFTD-TESTNET-WORK-ROADMAP.md', 'utf8').includes('All entries remain pending'));
console.log('L01.1 canonical steps, integration sources, adopted policy and retained acceptance gates verified.');
