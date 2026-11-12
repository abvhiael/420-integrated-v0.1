import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {buildExtension420} from './build.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=(await buildExtension420()).dist;
const shots=resolve(root,'visual-evidence');
mkdirSync(shots,{recursive:true});
const browser=await chromium.launchPersistentContext('',{
 channel:'chromium',headless:true,viewport:{width:1050,height:820},deviceScaleFactor:1,
 args:['--disable-extensions-except='+dist,'--load-extension='+dist],
});
let second=null;
try{
 let worker=browser.serviceWorkers()[0];
 if(!worker)worker=await browser.waitForEvent('serviceworker',{timeout:25000});
 const rootUrl='chrome-extension://'+new URL(worker.url()).host+'/';
 const page=await browser.newPage();
 const failures=[];
 page.on('pageerror',e=>failures.push('pageerror: '+e.message));
 await page.goto(rootUrl+'wallet.html',{waitUntil:'load'});
 await page.locator('#welcome').waitFor({state:'visible',timeout:15000});
 await page.screenshot({path:resolve(shots,'onboarding-01-first-run.png')});
 await page.locator('#welcome-create').click();
 await page.locator('#setup-password').fill('Correct horse battery staple 420');
 await page.locator('#setup-confirm').fill('Correct horse battery staple 420');
 await page.locator('#word-count').selectOption('24');
 await page.locator('#setup-submit').click();
 await page.locator('#confirm-phrase').waitFor({state:'visible'});
 const backupWords=(await page.locator('#new-phrase').textContent()).match(/\d+\. ([a-z]+)/g).map(s=>s.split(' ')[1]);
 assert.equal(backupWords.length,24);
 for(const input of await page.locator('#confirm-inputs input').all()){
  const index=Number((await input.getAttribute('id')).split('-').at(-1));
  await input.fill(backupWords[index]);
 }
 // No screenshot of secrets by design.
 await page.locator('#confirm-form button').click();
 await page.locator('#accounts').waitFor({state:'visible',timeout:15000});
 const initial=await page.locator('.account-row code').first().textContent();
 assert.match(initial,/^0x[0-9a-f]{40}$/);
 await page.screenshot({path:resolve(shots,'onboarding-02-account-manager.png')});
 // Chromium virtual authenticator supplies real ES256/WebAuthn browser ceremony semantics.
 const cdp=await browser.newCDPSession(page);
 await cdp.send('WebAuthn.enable');
 await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{
   protocol:'ctap2',transport:'internal',hasResidentKey:true,
   hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true,
 }});
 await page.locator('#prepare-passkey').click();
 await page.locator('#passkey-register').click();
 await page.waitForFunction(()=>document.querySelector('#passkey-status')?.textContent?.includes('Device passkey credential prepared'),{timeout:30000});
 await page.screenshot({path:resolve(shots,'onboarding-02b-pending-passkey.png')});
 const pendingRecord=await page.evaluate(async()=>(await chrome.storage.local.get('420-wallet-encrypted-vault-v1'))['420-wallet-encrypted-vault-v1']);
 assert.ok(!JSON.stringify(pendingRecord).includes('pending-onchain-enrollment'),'Public passkey binding metadata must be inside encrypted ciphertext');

 const sealed=await page.evaluate(async()=>(await chrome.storage.local.get('420-wallet-encrypted-vault-v1'))['420-wallet-encrypted-vault-v1']);
 assert.equal(sealed.schema,'420-wallet-encrypted-vault-v1');
 assert.equal(sealed.kdf.iterations>=600000,true);
 assert.equal(JSON.stringify(sealed).includes(backupWords.join(' ')),false);
 const publicConfig=await page.evaluate(async()=>(await chrome.storage.local.get('420-wallet-extension-config-v1'))['420-wallet-extension-config-v1']);
 assert.deepEqual(publicConfig.vaultAccounts,[initial]);
 await page.locator('#lock-button').click();
 await page.locator('#unlock').waitFor({state:'visible'});
 await page.screenshot({path:resolve(shots,'onboarding-03-locked.png')});
 await page.locator('#unlock-password').fill('wrong password incorrect');
 await page.locator('#unlock-form button').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Invalid wallet password'));
 assert.equal(await page.locator('#accounts').isVisible(),false);
 await page.locator('#unlock-password').fill('Correct horse battery staple 420');
 await page.locator('#unlock-form button').click();
 await page.locator('#accounts').waitFor({state:'visible'});
 await page.locator('#add-import').click();
 await page.locator('#add-type').selectOption('private-key');
 await page.locator('#add-value').fill('0x'+'11'.repeat(32));
 await page.locator('#add-form button').click();
 await page.waitForFunction(()=>document.querySelectorAll('.account-row').length===2);
 const addresses=await page.locator('.account-row code').allTextContents();
 assert.equal(addresses.length,2);
 await page.locator('#password-change').click();
 await page.locator('#secure-password').fill('Correct horse battery staple 420');
 await page.locator('#new-password').fill('Much safer replacement password 420');
 await page.locator('#new-confirm').fill('Much safer replacement password 420');
 await page.locator('#secure-form button').click();
 await page.locator('#accounts').waitFor({state:'visible'});
 const encryptedBackup=await page.evaluate(async()=>(await chrome.storage.local.get('420-wallet-encrypted-vault-v1'))['420-wallet-encrypted-vault-v1']);
 assert.equal(JSON.stringify(encryptedBackup).includes('11'.repeat(32)),false);
 await page.locator('#lock-button').click();
 await page.locator('#unlock-password').fill('Correct horse battery staple 420');
 await page.locator('#unlock-form button').click();
 await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Invalid wallet password'));
 await page.locator('#unlock-password').fill('Much safer replacement password 420');
 await page.locator('#unlock-form button').click();
 await page.locator('#accounts').waitFor({state:'visible'});
 assert.deepEqual(await page.locator('.account-row code').allTextContents(),addresses);
 await page.locator('#prepare-passkey').click();
 assert.match(await page.locator('#passkey-status').textContent(),/staged only|credential/);
 await page.locator('#passkey-back').click();
 assert.match(await page.locator('#account-list').textContent(),/NOT enrolled \/ NOT authorized/);

 await page.screenshot({path:resolve(shots,'onboarding-04-restored-accounts.png')});
 const popup=await browser.newPage();
 await popup.goto(rootUrl+'popup.html',{waitUntil:'load'});
 await popup.locator('#vault-title').waitFor();
 assert.match(await popup.locator('#vault-title').textContent(),/wallet unlocked/i);
 await popup.locator('#open-wallet').click();
 const tabs=browser.pages();
 assert.ok(tabs.length>=3,'Setup/Manage vault opens a real browser tab');
 await popup.close();
 assert.deepEqual(failures,[]);
 console.log('PASS: first run, 24-word backup confirmation, authenticated vault, wrong-password rejection, separate key import, password rotation, full inventory restoration and popup integration. No secrets photographed.');
}finally{await second?.close();await browser.close();}
