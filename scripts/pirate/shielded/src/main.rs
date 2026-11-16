//! Pinned Pirate native crypto integration. Never prints viewing credentials.
use std::{fs,io::{Cursor,Read},path::Path,os::unix::{fs::{MetadataExt,OpenOptionsExt}}};
use serde::Deserialize;
use serde_json::{json,Value};
use sha2::{Sha256,Digest};
use zeroize::{Zeroize,Zeroizing};
use zcash_primitives::transaction::{Transaction,Authorization,sighash::{signature_hash,SignableInput},txid::TxIdDigester};
use zcash_protocol::{consensus::BranchId,value::Zatoshis};
use zcash_transparent::{bundle as tb,address::Script,sighash::TransparentAuthorizingContext};
use incrementalmerkletree::{Hashable,Level};
const SOURCE:&str="b14db80bfc1a819b958e36d1e0127e94c395d445";
type R<T>=Result<T,Box<dyn std::error::Error>>;
#[track_caller]
fn need(v:bool)->R<()> {if v{Ok(())}else{Err(format!("invalid evidence at check {}",std::panic::Location::caller().line()).into())}}
fn b32(s:&str)->R<[u8;32]>{Ok(hex::decode(s)?.try_into().map_err(|_|"bad width")?)}
#[derive(Clone,Debug)]struct EmptyAuth;
impl tb::Authorization for EmptyAuth {type ScriptSig=Script;}
impl TransparentAuthorizingContext for EmptyAuth{fn input_amounts(&self)->Vec<Zatoshis>{vec![]}fn input_scriptpubkeys(&self)->Vec<Script>{vec![]}}
struct MapEmpty;
impl tb::MapAuth<tb::Authorized,EmptyAuth> for MapEmpty{fn map_script_sig(&self,s:Script)->Script{s}fn map_authorization(&self,_:tb::Authorized)->EmptyAuth{EmptyAuth}}
struct ShieldedAuth;
impl Authorization for ShieldedAuth{type TransparentAuth=EmptyAuth;type SaplingAuth=sapling_crypto::bundle::Authorized;type OrchardAuth=orchard::bundle::Authorized;}
#[derive(Deserialize)]#[serde(deny_unknown_fields)]struct Request{mode:String,raw_file:String,branch_id:u32,pool:Option<u8>,output_index:Option<usize>,position:Option<u64>,root:Option<String>,siblings:Option<Vec<String>>,commitments:Option<Vec<String>>}
fn read_private(path:&Path)->R<Zeroizing<Vec<u8>>>{
 let mut f=fs::OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW).open(path)?;let m=f.metadata()?;
 need(m.is_file()&&m.uid()==unsafe{libc::geteuid()}&&m.mode()&0o077==0&&m.len()<=1024)?;
 let mut v=Vec::new();f.read_to_end(&mut v)?;Ok(Zeroizing::new(v))
}
fn describe(t:&Transaction)->Value{
 let s=t.sapling_bundle();let i=t.ironwood_bundle();json!({"txid":hex::encode(t.txid().as_ref()),"version":format!("{:?}",t.version()),"sapling_outputs":s.map(|b|b.shielded_outputs().iter().map(|o|hex::encode(o.cmu().to_bytes())).collect::<Vec<_>>()).unwrap_or_default(),"sapling_nullifiers":s.map(|b|b.shielded_spends().iter().map(|x|hex::encode(x.nullifier().0)).collect::<Vec<_>>()).unwrap_or_default(),"ironwood_outputs":i.map(|b|b.actions().iter().map(|x|hex::encode(x.cmx().to_bytes())).collect::<Vec<_>>()).unwrap_or_default(),"ironwood_nullifiers":i.map(|b|b.actions().iter().map(|x|hex::encode(x.nullifier().to_bytes())).collect::<Vec<_>>()).unwrap_or_default()})
}
fn compact(c:&mut Cursor<&[u8]>)->R<usize>{let mut tag=[0];c.read_exact(&mut tag)?;let n=match tag[0]{0..=252=>tag[0] as u64,x=>{let w=if x==253{2}else if x==254{4}else{8};let mut b=[0;8];c.read_exact(&mut b[..w])?;let n=u64::from_le_bytes(b);need(n>=if w==2{253}else if w==4{65536}else{4294967296})?;n}};Ok(n.try_into()?)}
fn parameter(dir:&Path,name:&str,expected:&str)->R<Cursor<Vec<u8>>>{let bytes=fs::read(dir.join(name))?;need(hex::encode(Sha256::digest(&bytes))==expected)?;Ok(Cursor::new(bytes))}
fn witness<H:Hashable+Clone>(nodes:Vec<H>,position:usize)->R<(H,Vec<H>)>{
 use incrementalmerkletree::{frontier::CommitmentTree,witness::IncrementalWitness};
 need(position<nodes.len()&&nodes.len()<=1_000_000)?;
 let mut tree=CommitmentTree::<H,32>::empty();let mut witness=None;
 for (i,n) in nodes.into_iter().enumerate(){tree.append(n.clone()).map_err(|_|"tree full")?;if let Some(ref mut w)=witness{IncrementalWitness::append(w,n).map_err(|_|"tree full")?;}if i==position{witness=IncrementalWitness::from_tree(tree.clone());}}
 let w=witness.ok_or("witness")?;let path=w.path().ok_or("path")?;Ok((w.root(),path.path_elems().to_vec()))
}
fn execute(r:Request,key:Option<&Path>,params:Option<&Path>)->R<Value>{
 if r.mode=="witness"{
  let nodes=r.commitments.ok_or("commitments")?;let position=r.position.ok_or("position")? as usize;
  let (root,siblings)=if r.pool==Some(0){let ns=nodes.iter().map(|s|->R<sapling_crypto::Node>{Option::from(sapling_crypto::Node::from_bytes(b32(s)?)).ok_or_else(||"commitment".into())}).collect::<R<Vec<_>>>()?;let (root,path)=witness(ns,position)?;(hex::encode(root.to_bytes()),path.iter().map(|x|hex::encode(x.to_bytes())).collect::<Vec<_>>())}
  else{need(r.pool==Some(1))?;let ns=nodes.iter().map(|s|->R<orchard::tree::MerkleHashOrchard>{Option::from(orchard::tree::MerkleHashOrchard::from_bytes(&b32(s)?)).ok_or_else(||"commitment".into())}).collect::<R<Vec<_>>>()?;let (root,path)=witness(ns,position)?;(hex::encode(root.to_bytes()),path.iter().map(|x|hex::encode(x.to_bytes())).collect::<Vec<_>>())};return Ok(json!({"root":root,"siblings":siblings,"position":position}));
 }
 let mut input=fs::File::open(&r.raw_file)?.take(4_000_001);let mut raw=Vec::new();input.read_to_end(&mut raw)?;need(raw.len()<=4_000_000)?;let branch=BranchId::try_from(r.branch_id)?;
 if r.mode=="inspect-block"{
  let mut c=Cursor::new(raw.as_slice());c.set_position(140);let n=compact(&mut c)?;need(n<=1344)?;c.set_position(c.position()+n as u64);let count=compact(&mut c)?;need(count<=10000)?;let mut txs=vec![];
  for _ in 0..count{let start=c.position() as usize;let t=Transaction::read(&mut c,branch)?;let mut v=describe(&t);v["raw"]=json!(hex::encode(&raw[start..c.position() as usize]));txs.push(v)}need(c.position()==raw.len() as u64)?;return Ok(json!({"source":SOURCE,"transactions":txs}));
 }
 let mut c=Cursor::new(raw.as_slice());let tx=Transaction::read(&mut c,branch)?;need(c.position()==raw.len() as u64)?;need(tx.consensus_branch_id()==branch&&tx.version().valid_in_branch(branch))?;
 if r.mode=="inspect"{return Ok(describe(&tx))}
 need(r.mode=="verify"||r.mode=="decrypt")?;need(tx.orchard_bundle().is_none()&&tx.sprout_bundle().is_none())?;
 need(tx.transparent_bundle().map_or(true,|x|x.vin.is_empty()))?;
 need(tx.sapling_bundle().is_some()||tx.ironwood_bundle().is_some())?;
 let desc=describe(&tx);let data=tx.into_data().map_authorization::<ShieldedAuth>(MapEmpty,(),());let digest=data.digest(TxIdDigester);let sighash=*signature_hash(&data,&SignableInput::Shielded,&digest).as_ref();
 if let Some(b)=data.sapling_bundle(){
  let dir=params.ok_or("proving parameters missing")?;
  let p=sapling_crypto::circuit::SpendParameters::read(parameter(dir,"sapling-spend.params","8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13")?,false)?;
  let q=sapling_crypto::circuit::OutputParameters::read(parameter(dir,"sapling-output.params","2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4")?,false)?;
  let mut v=sapling_crypto::BatchValidator::new();need(v.check_bundle(b.clone(),sighash))?;need(v.validate(&p.verifying_key(),&q.verifying_key(),rand_core::OsRng))?;
 }
 if let Some(b)=data.ironwood_bundle(){
  need(b.bundle_version()==orchard::bundle::BundleVersion::ironwood_v3())?;
  let vk=orchard::circuit::VerifyingKey::build(orchard::circuit::OrchardCircuitVersion::PostNu6_3);
  let mut v=orchard::bundle::BatchValidator::new(&vk);v.add_bundle(b,sighash)?;need(v.validate(rand_core::OsRng))?;
 }
 if r.mode=="verify"{return Ok(json!({"source":SOURCE,"shielded_authorization_validated":true,"transaction":desc,"raw_sha256":hex::encode(Sha256::digest(&raw))}))}
 let mut secret=read_private(key.ok_or("private viewing credential required")?)?;
 // Binary full viewing keys only: no command-line credentials, incoming-only keys,
 // logging, network access, or key material in successful/error output.
 need(secret.len()==96)?;let mut identity=Sha256::new();identity.update(b"420/ARRR/FVK/V1");identity.update(secret.as_slice());let key_id=hex::encode(identity.finalize());
 let index=r.output_index.ok_or("index")?;let pool=r.pool.ok_or("pool")?;let position=r.position.ok_or("position")?;need(position<(1u64<<32))?;
 let siblings=r.siblings.as_ref().ok_or("witness")?;need(siblings.len()==32)?;let expected=b32(r.root.as_ref().ok_or("root")?)?;
 let (amount,memo,cm,nf,address)=if pool==0{
  use sapling_crypto::{keys::FullViewingKey,note_encryption::{PreparedIncomingViewingKey,try_sapling_note_decryption,Zip212Enforcement},Node};
  // Upstream CtOption evaluation can reach an expect on malformed AK bytes.
  // Validate RedJubjub encoding first; retain native subgroup/identity checks.
  let ak=Zeroizing::new(<[u8;32]>::try_from(&secret[..32])?);
  redjubjub::VerificationKey::<redjubjub::SpendAuth>::try_from(*ak).map_err(|_|"invalid Sapling viewing key")?;
  let fvk=FullViewingKey::read(secret.as_slice())?;let ivk=PreparedIncomingViewingKey::new(&fvk.vk.ivk());let b=data.sapling_bundle().ok_or("pool")?;let output=b.shielded_outputs().get(index).ok_or("index")?;
  let (note,address,memo)=try_sapling_note_decryption(&ivk,output,Zip212Enforcement::Off).ok_or("ownership")?;
  let cm=note.cmu().to_bytes();need(cm==output.cmu().to_bytes())?;let mut node=Node::from_cmu(&note.cmu());
  for (level,s) in siblings.iter().enumerate(){let other=Option::<Node>::from(Node::from_bytes(b32(s)?)).ok_or("witness")?;node=if position>>level&1==0{Node::combine(Level::from(level as u8),&node,&other)}else{Node::combine(Level::from(level as u8),&other,&node)}}need(node.to_bytes()==expected)?;
  (note.value().inner(),memo,cm,note.nf(&fvk.vk.nk,position).0,address.to_bytes())
 }else{
  need(pool==1)?;use orchard::{keys::{FullViewingKey,Scope,PreparedIncomingViewingKey},note_encryption::IronwoodDomain,tree::{MerklePath,MerkleHashOrchard},note::ExtractedNoteCommitment};
  let key=Zeroizing::new(<[u8;96]>::try_from(secret.as_slice())?);let fvk=FullViewingKey::from_bytes(&key).ok_or("full key")?;let b=data.ironwood_bundle().ok_or("pool")?;let action=b.actions().get(index).ok_or("index")?;let domain=IronwoodDomain::for_action(action);
  let mut decrypted=None;for scope in [Scope::External,Scope::Internal]{let ivk=PreparedIncomingViewingKey::new(&fvk.to_ivk(scope));if let Some(n)=zcash_note_encryption::try_note_decryption(&domain,&ivk,action){decrypted=Some(n);break}}
  let (note,address,memo)=decrypted.ok_or("ownership")?;let cm=ExtractedNoteCommitment::from(note.commitment());need(cm==*action.cmx())?;
  let nodes=siblings.iter().map(|s|->R<MerkleHashOrchard>{Option::from(MerkleHashOrchard::from_bytes(&b32(s)?)).ok_or_else(||"witness".into())}).collect::<R<Vec<_>>>()?;
  let path=MerklePath::from_parts(position as u32,nodes.try_into().map_err(|_|"witness")?);need(path.root(cm).to_bytes()==expected)?;
  (note.value().inner(),memo,cm.to_bytes(),note.nullifier(&fvk).to_bytes(),address.to_raw_address_bytes())
 };
 secret.zeroize();need(amount>0&&amount<=200_000_000*100_000_000)?;
 need(&memo[..8]==b"420ARRR1"&&memo[68..].iter().all(|x|*x==0))?;
 need(u64::from_le_bytes(memo[60..68].try_into()?)==amount)?;
 Ok(json!({"source":SOURCE,"shielded_authorization_validated":true,"ownership_validated":true,"witness_validated":true,"pool":pool,"key_id":key_id,"txid":desc["txid"],"raw_sha256":hex::encode(Sha256::digest(raw)),"output_index":index,"position":position,"root":hex::encode(expected),"note_commitment":hex::encode(cm),"nullifier":hex::encode(nf),"amount":amount,"recipient":hex::encode(&memo[40..60]),"memo":hex::encode(memo),"address_hash":hex::encode(Sha256::digest(address))}))
}
fn main(){unsafe{let limit=libc::rlimit{rlim_cur:0,rlim_max:0};if libc::setrlimit(libc::RLIMIT_CORE,&limit)!=0||libc::prctl(libc::PR_SET_DUMPABLE,0)!=0{eprintln!("private worker isolation unavailable");std::process::exit(2)}}std::panic::set_hook(Box::new(|_|{}));let args:Vec<_>=std::env::args().collect();let run=||->R<Value>{need(args.len()>=2)?;let req:Request=serde_json::from_slice(&fs::read(&args[1])?)?;execute(req,args.get(2).map(Path::new),args.get(3).map(Path::new))};match std::panic::catch_unwind(run){Ok(Ok(v))=>println!("{}",v),_=>{eprintln!("shielded evidence rejected");std::process::exit(2)}}}
