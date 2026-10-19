import {
  createHash, createHmac, createCipheriv, createDecipheriv,
  createPublicKey, createPrivateKey, diffieHellman, generateKeyPairSync,
  hkdfSync, randomBytes, timingSafeEqual
} from 'node:crypto';

const D = '420.BET.POKER.CONFIDENTIAL.V1';
const sha = b => createHash('sha256').update(b).digest();
const hx = b => Buffer.from(b).toString('hex');
const encode = (...x) => Buffer.from(JSON.stringify([D, ...x]));
function requireSeed(seed) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) throw new Error('32-byte cryptographic seed required');
}
function requireContext(c) {
  if (!c || !Number.isSafeInteger(c.chainId) || c.chainId <= 0 ||
      !Number.isInteger(c.epoch) || c.epoch < 0 ||
      !Number.isInteger(c.nonce) || c.nonce <= 0 ||
      !['tableId','configHash','versionId','handId','seatSnapshotHash'].every(k => typeof c[k] === 'string' && /^0x[0-9a-fA-F]{64}$/.test(c[k])))
    throw new Error('canonical chain/table/version/hand/seating context required');
}
const contextHash = c => { requireContext(c); return sha(encode(c.chainId,c.tableId,c.configHash,c.versionId,c.handId,c.epoch,c.nonce,c.seatSnapshotHash)); };
export function providerCommitment(c, provider, seed) {
  requireSeed(seed);
  if (provider !== 'A' && provider !== 'B') throw new Error('distinct provider A/B required');
  return hx(sha(Buffer.concat([encode('provider-seed',provider),contextHash(c),seed])));
}
export function deriveDeck(c, seedA, seedB) {
  requireSeed(seedA); requireSeed(seedB);
  const master = Buffer.from(hkdfSync('sha256', Buffer.concat([seedA,seedB]), contextHash(c),encode('independent-seed-shuffle'),32));
  const cards = Array.from({length:52},(_,i)=>i);
  let counter=0;
  function index(n) {
    const range=2 ** 32;
    const limit=range-(range % n);
    for (;;) {
      const data=Buffer.alloc(4);
      data.writeUInt32BE(counter++,0);
      const value=createHmac('sha256',master).update(data).digest().readUInt32BE(0);
      if(value<limit) return value % n;
    }
  }
  for(let i=51;i>0;--i) {
    const j=index(i+1);
    [cards[i],cards[j]]=[cards[j],cards[i]];
  }
  return cards;
}
export function verifyShuffle(c, commitments, seedA, seedB, publishedCards) {
  if(!Array.isArray(publishedCards)||publishedCards.length!==52||
     new Set(publishedCards).size!==52 || publishedCards.some(v=>!Number.isInteger(v)||v<0||v>51))
    throw new Error('not a 52-card unique deck');
  for(const [label,seed] of [['A',seedA],['B',seedB]]) {
    const want=providerCommitment(c,label,seed);
    const got=commitments?.[label];
    if(typeof got!=='string'||!timingSafeEqual(Buffer.from(want),Buffer.from(got)))
      throw new Error('provider seed commitment does not match');
  }
  const expected=deriveDeck(c,seedA,seedB);
  if(expected.some((v,i)=>v!==publishedCards[i])) throw new Error('deck is not reproducible from both seeds');
  return true;
}
export function makeRecipientKeyPair() {
  const {privateKey,publicKey}=generateKeyPairSync('x25519');
  return {
    privateKey: hx(privateKey.export({format:'der',type:'pkcs8'})),
    publicKey: hx(publicKey.export({format:'der',type:'spki'}))
  };
}
export function keyFingerprint(publicKeyHex) {
  const key=Buffer.from(publicKeyHex,'hex');
  if(key.length!==44) throw new Error('malformed X25519 public key');
  createPublicKey({key,format:'der',type:'spki',});
  return hx(sha(Buffer.concat([encode('player-x25519-key'),key])));
}
function seatAAD(c,seat,seatEpoch,keyHash) {
  if(!Number.isInteger(seat)||seat<0||seat>=9||!Number.isInteger(seatEpoch)||seatEpoch<1)
    throw new Error('invalid seat epoch');
  if(typeof keyHash !== 'string'||!/^[0-9a-f]{64}$/.test(keyHash)) throw new Error('invalid key binding');
  return Buffer.concat([contextHash(c),encode('hole-cards',seat,seatEpoch,keyHash)]);
}
function keyFromShared(shared,c,seat) {
  return Buffer.from(hkdfSync('sha256',shared,contextHash(c),encode('authenticated-recipient',seat),32));
}
export function encryptHoleCards(c, seat, seatEpoch, recipientPublicKeyHex, cards, registeredKeyFingerprint) {
  if(!Array.isArray(cards)||cards.length!==2||new Set(cards).size!==2||
    cards.some(v=>!Number.isInteger(v)||v<0||v>51)) throw new Error('invalid private hole-card pair');
  const fingerprint=keyFingerprint(recipientPublicKeyHex);
  if(fingerprint!==registeredKeyFingerprint) throw new Error('unregistered recipient key');
  const recipient=createPublicKey({key:Buffer.from(recipientPublicKeyHex,'hex'),format:'der',type:'spki'});
  const ephemeral=generateKeyPairSync('x25519');
  const shared=diffieHellman({privateKey:ephemeral.privateKey,publicKey:recipient});
  const key=keyFromShared(shared,c,seat);
  const iv=randomBytes(12);
  const aad=seatAAD(c,seat,seatEpoch,fingerprint);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(aad);
  const ciphertext=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(cards))),cipher.final()]);
  return {ephemeralPublicKey:hx(ephemeral.publicKey.export({format:'der',type:'spki'})),
    iv:hx(iv),ciphertext:hx(ciphertext),tag:hx(cipher.getAuthTag()),
    keyFingerprint:fingerprint,
    envelopeHash:hx(sha(Buffer.concat([encode('sealed-seat-packet'),aad,iv,ciphertext,cipher.getAuthTag()])))};
}
export function decryptHoleCards(c, seat, seatEpoch, recipientPrivateKeyHex, packet, expectedKeyFingerprint) {
  const priv=createPrivateKey({key:Buffer.from(recipientPrivateKeyHex,'hex'),format:'der',type:'pkcs8'});
  const derivedPub=createPublicKey(priv).export({format:'der',type:'spki'});
  if(keyFingerprint(hx(derivedPub))!==expectedKeyFingerprint ||
      packet.keyFingerprint!==expectedKeyFingerprint) throw new Error('wrong recipient');
  const pub=createPublicKey({key:Buffer.from(packet.ephemeralPublicKey,'hex'),format:'der',type:'spki'});
  const shared=diffieHellman({privateKey:priv,publicKey:pub});
  const key=keyFromShared(shared,c,seat);
  const aad=seatAAD(c,seat,seatEpoch,expectedKeyFingerprint);
  const iv=Buffer.from(packet.iv,'hex');
  if(iv.length!==12) throw new Error('invalid nonce');
  const cipherBytes=Buffer.from(packet.ciphertext,'hex');
  const tag=Buffer.from(packet.tag,'hex');
  const check=hx(sha(Buffer.concat([encode('sealed-seat-packet'),aad,iv,cipherBytes,tag])));
  if(check!==packet.envelopeHash) throw new Error('tampered envelope');
  const dec=createDecipheriv('aes-256-gcm',key,iv);
  dec.setAAD(aad); dec.setAuthTag(tag);
  const cards=JSON.parse(Buffer.concat([dec.update(cipherBytes),dec.final()]).toString('utf8'));
  if(!Array.isArray(cards)||cards.length!==2||cards.some(v=>!Number.isInteger(v)||v<0||v>51)||cards[0]===cards[1])
    throw new Error('invalid decrypted cards');
  return cards;
}
