import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { identityMarkup } from '../identity-management-ui.js';

test('Wallet shell exposes canonical Identity management navigation and module binding', async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.equal(html.includes('data-scroll-target="#identity-management-panel"'),true);
  assert.equal(html.includes('src="./identity-management-ui.js"'),true);
});

test('Identity UI covers every canonical user workflow with accessible status and recovery surfaces',()=>{
  const html=identityMarkup();
  for(const token of [
    'identity-create-profile','identity-update-profile',
    'identity-transfer-controller','identity-accept-controller',
    'identity-check-name','identity-set-name','identity-unlink-name',
    'identity-load-credential','identity-reject-credential',
    'role="status"','role="alert"','aria-live="polite"','aria-live="assertive"'
  ]) assert.equal(html.includes(token),true,token);
});

test('Identity UI states trust and legal-identity boundaries without overclaiming wallet ownership',()=>{
  const html=identityMarkup();
  assert.match(html,/does not prove legal identity or wallet ownership/i);
  assert.match(html,/Trust class describes issuer policy only/i);
  assert.match(html,/not proof of legal identity, wallet ownership, reputation, or authorization/i);
  assert.match(html,/strong binding is shown only when Names420 claims this profile and Identity420 points back/i);
});

test('Identity UI distinguishes loading/empty/error/transaction/recovery semantics in source contract', async()=>{
  const source=await readFile(new URL('../identity-management-ui.js',import.meta.url),'utf8');
  for(const token of [
    'Not connected','Profile not found','Credential not found','Action blocked',
    'Transaction submitted','Confirmed','Recovery:','Reload required',
    'waiting for chain confirmation','Canonical profile loaded','Credential loaded'
  ]) assert.equal(source.includes(token),true,token);
});

test('Identity writes require explicit confirmation and irreversible rejection warning', async()=>{
  const source=await readFile(new URL('../identity-management-ui.js',import.meta.url),'utf8');
  assert.match(source,/Create this public pseudonymous Identity420 profile/);
  assert.match(source,/Nominate .* as the new profile controller/);
  assert.match(source,/strong binding only while both contracts agree/);
  assert.match(source,/Rejection is irreversible in the current Identity420 protocol/);
});
