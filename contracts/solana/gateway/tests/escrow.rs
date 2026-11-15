use solana_gateway_420::{process_instruction,state_address,token_vault,NATIVE,RAY,EURC,STATE_LEN};
use solana_program::{program_option::COption,program_pack::Pack,pubkey::Pubkey,system_program};
use solana_program_test::{processor,ProgramTest,ProgramTestContext};
use solana_sdk::{account::Account,instruction::{AccountMeta,Instruction},signature::Signer,transaction::Transaction};
use spl_token::state::{Account as TokenAccount,AccountState,Mint};
fn state_data(asset:[u8;32],nonce:u64)->Vec<u8>{let mut v=vec![0;STATE_LEN];v[..8].copy_from_slice(b"420STAT1");v[8..16].copy_from_slice(&nonce.to_le_bytes());v[16..].copy_from_slice(&asset);v}
fn data(asset:[u8;32],nonce:u64,amount:u64)->Vec<u8>{let mut v=b"420SOLV1".to_vec();v.extend(amount.to_le_bytes());v.extend(asset);v.extend([0x42;20]);v.extend([0x42;32]);v.extend([0x42;20]);v.extend([0x42;32]);v.extend(nonce.to_le_bytes());assert_eq!(v.len(),160);v}
fn token_data(mint:Pubkey,owner:Pubkey,amount:u64)->Vec<u8>{let mut v=vec![0;TokenAccount::LEN];TokenAccount::pack(TokenAccount{mint,owner,amount,delegate:COption::None,state:AccountState::Initialized,is_native:COption::None,delegated_amount:0,close_authority:COption::None},&mut v).unwrap();v}
async fn send(c:&mut ProgramTestContext,ix:Instruction)->bool {let block=c.banks_client.get_latest_blockhash().await.unwrap();let t=Transaction::new_signed_with_payer(&[ix],Some(&c.payer.pubkey()),&[&c.payer],block);c.banks_client.process_transaction(t).await.is_ok()}
#[tokio::test]
async fn native_deposit_nonce_and_atomic_failure(){
 let program=Pubkey::new_unique();let(state,_)=state_address(&program,&NATIVE);let mut p=ProgramTest::new("solana_gateway_420",program,processor!(process_instruction));p.add_account(state,Account{lamports:10_000_000,data:state_data(NATIVE,0),owner:program,executable:false,rent_epoch:0});let mut c=p.start_with_context().await;let owner=c.payer.pubkey();
 let ix=|n,a|Instruction{program_id:program,accounts:vec![AccountMeta::new(owner,true),AccountMeta::new(state,false),AccountMeta::new_readonly(system_program::id(),false)],data:data(NATIVE,n,a)};
 assert!(send(&mut c,ix(1,42000)).await);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(a.lamports,10_042_000);assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),1);
 assert!(!send(&mut c,ix(1,42001)).await);assert!(!send(&mut c,ix(2,u64::MAX)).await);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(a.lamports,10_042_000);assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),1);
}
#[tokio::test]
async fn ray_and_eurc_real_spl_cpi_and_rollback(){
 for mint in [RAY,EURC] {let program=Pubkey::new_unique();let(state,_)=state_address(&program,&mint.to_bytes());let vault=token_vault(&state,&mint);let source=Pubkey::new_unique();let owner=solana_sdk::signature::Keypair::new();let mut p=ProgramTest::new("solana_gateway_420",program,processor!(process_instruction));p.add_program("spl_token",spl_token::id(),processor!(spl_token::processor::Processor::process));
 p.add_account(state,Account{lamports:10_000_000,data:state_data(mint.to_bytes(),0),owner:program,executable:false,rent_epoch:0});let mut md=vec![0;Mint::LEN];Mint::pack(Mint{mint_authority:COption::None,supply:100000000,decimals:6,is_initialized:true,freeze_authority:COption::None},&mut md).unwrap();p.add_account(mint,Account{lamports:10_000_000,data:md,owner:spl_token::id(),executable:false,rent_epoch:0});
 for (key,authority,amount) in [(source,owner.pubkey(),100000000),(vault,state,0)] {p.add_account(key,Account{lamports:10_000_000,data:token_data(mint,authority,amount),owner:spl_token::id(),executable:false,rent_epoch:0});}
 p.add_account(owner.pubkey(),Account{lamports:100000000,data:vec![],owner:system_program::id(),executable:false,rent_epoch:0});let mut c=p.start_with_context().await;
 let ix=|nonce,amount|Instruction{program_id:program,accounts:vec![AccountMeta::new_readonly(owner.pubkey(),true),AccountMeta::new(vault,false),AccountMeta::new_readonly(mint,false),AccountMeta::new(source,false),AccountMeta::new_readonly(spl_token::id(),false),AccountMeta::new(state,false)],data:data(mint.to_bytes(),nonce,amount)};
 let block=c.banks_client.get_latest_blockhash().await.unwrap();let t=Transaction::new_signed_with_payer(&[ix(1,42000000)],Some(&c.payer.pubkey()),&[&c.payer,&owner],block);c.banks_client.process_transaction(t).await.unwrap();
 let balance=|a:Account|TokenAccount::unpack(&a.data).unwrap().amount;assert_eq!(balance(c.banks_client.get_account(vault).await.unwrap().unwrap()),42000000);
 let block=c.banks_client.get_latest_blockhash().await.unwrap();let t=Transaction::new_signed_with_payer(&[ix(2,100000000)],Some(&c.payer.pubkey()),&[&c.payer,&owner],block);assert!(c.banks_client.process_transaction(t).await.is_err());assert_eq!(balance(c.banks_client.get_account(vault).await.unwrap().unwrap()),42000000);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),1);
 let mut frozen=c.banks_client.get_account(source).await.unwrap().unwrap();let mut from=TokenAccount::unpack(&frozen.data).unwrap();from.state=AccountState::Frozen;TokenAccount::pack(from,&mut frozen.data).unwrap();c.set_account(&source,&solana_sdk::account::AccountSharedData::from(frozen));
 let block=c.banks_client.get_latest_blockhash().await.unwrap();let t=Transaction::new_signed_with_payer(&[ix(2,1000000)],Some(&c.payer.pubkey()),&[&c.payer,&owner],block);assert!(c.banks_client.process_transaction(t).await.is_err());assert_eq!(balance(c.banks_client.get_account(vault).await.unwrap().unwrap()),42000000);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),1);
 }
}
#[tokio::test]
async fn prefunded_state_can_initialize_only_once(){let program=Pubkey::new_unique();let(state,_)=state_address(&program,&NATIVE);let mut p=ProgramTest::new("solana_gateway_420",program,processor!(process_instruction));p.add_account(state,Account{lamports:1,data:vec![],owner:system_program::id(),executable:false,rent_epoch:0});let mut c=p.start_with_context().await;let mut bytes=b"420INIT1".to_vec();bytes.extend(NATIVE);let ix=Instruction{program_id:program,accounts:vec![AccountMeta::new(c.payer.pubkey(),true),AccountMeta::new(state,false),AccountMeta::new_readonly(system_program::id(),false)],data:bytes};assert!(send(&mut c,ix.clone()).await);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(a.owner,program);assert_eq!(a.data.len(),STATE_LEN);c.get_new_latest_blockhash().await.unwrap();assert!(!send(&mut c,ix).await);}

#[test]
fn pda_bindings_match_independent_python_reference(){
 let f:serde_json::Value=serde_json::from_str(&std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"),"/../../test/fixtures/solana/controlled-program-bindings.json")).unwrap()).unwrap();
 let bytes=|name:&str| {let h=f[name].as_str().unwrap();let mut b=[0u8;32];for i in 0..32 {b[i]=u8::from_str_radix(&h[i*2..i*2+2],16).unwrap();}b};
 let program=Pubkey::new_from_array(bytes("program"));assert_eq!(spl_token::id().to_bytes(),bytes("token_program"));assert_eq!(token_vault(&state_address(&program,&RAY.to_bytes()).0,&RAY).to_bytes(),bytes("ray_vault"));assert_eq!(token_vault(&state_address(&program,&EURC.to_bytes()).0,&EURC).to_bytes(),bytes("eurc_vault"));
 for (name,asset) in [("native_state",NATIVE),("ray_state",RAY.to_bytes()),("eurc_state",EURC.to_bytes())] {assert_eq!(state_address(&program,&asset).0.to_bytes(),bytes(name));}
}
#[tokio::test]
async fn native_wrong_authority_vault_and_destination_rejected(){
 let program=Pubkey::new_unique();let(state,_)=state_address(&program,&NATIVE);let fake=Pubkey::new_unique();let outsider=Pubkey::new_unique();let mut p=ProgramTest::new("solana_gateway_420",program,processor!(process_instruction));
 for key in [state,fake] {p.add_account(key,Account{lamports:10_000_000,data:state_data(NATIVE,0),owner:program,executable:false,rent_epoch:0});}
 p.add_account(outsider,Account{lamports:10_000_000,data:vec![],owner:system_program::id(),executable:false,rent_epoch:0});let mut c=p.start_with_context().await;
 let wrong_owner=Instruction{program_id:program,accounts:vec![AccountMeta::new(outsider,false),AccountMeta::new(state,false),AccountMeta::new_readonly(system_program::id(),false)],data:data(NATIVE,1,42000)};assert!(!send(&mut c,wrong_owner).await);
 let wrong_vault=Instruction{program_id:program,accounts:vec![AccountMeta::new(c.payer.pubkey(),true),AccountMeta::new(fake,false),AccountMeta::new_readonly(system_program::id(),false)],data:data(NATIVE,1,42000)};assert!(!send(&mut c,wrong_vault).await);
 let mut bad=data(NATIVE,1,42001);bad[48..68].fill(0);let wrong_destination=Instruction{program_id:program,accounts:vec![AccountMeta::new(c.payer.pubkey(),true),AccountMeta::new(state,false),AccountMeta::new_readonly(system_program::id(),false)],data:bad};assert!(!send(&mut c,wrong_destination).await);
 let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(a.lamports,10_000_000);assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),0);
}
fn cpi_caller(program:&Pubkey,accounts:&[solana_program::account_info::AccountInfo],data:&[u8])->solana_program::entrypoint::ProgramResult {
 let (_,bump)=Pubkey::find_program_address(&[b"controlled-owner"],program);
 let ix=Instruction{program_id:*accounts[3].key,accounts:vec![AccountMeta::new(*accounts[0].key,true),AccountMeta::new(*accounts[1].key,false),AccountMeta::new_readonly(system_program::id(),false)],data:data.to_vec()};
 solana_program::program::invoke_signed(&ix,accounts,&[&[b"controlled-owner",&[bump]]])
}
#[tokio::test]
async fn cpi_pda_owner_can_deposit_without_an_outer_owner_signature(){
 let gateway=Pubkey::new_unique();let caller=Pubkey::new_unique();let(owner,_)=Pubkey::find_program_address(&[b"controlled-owner"],&caller);let(state,_)=state_address(&gateway,&NATIVE);
 let mut p=ProgramTest::new("solana_gateway_420",gateway,processor!(process_instruction));p.prefer_bpf(false);p.add_program("cpi_caller",caller,processor!(cpi_caller));p.prefer_bpf(true);
 p.add_account(state,Account{lamports:10_000_000,data:state_data(NATIVE,0),owner:gateway,executable:false,rent_epoch:0});p.add_account(owner,Account{lamports:10_000_000,data:vec![],owner:system_program::id(),executable:false,rent_epoch:0});let mut c=p.start_with_context().await;
 let ix=Instruction{program_id:caller,accounts:vec![AccountMeta::new(owner,false),AccountMeta::new(state,false),AccountMeta::new_readonly(system_program::id(),false),AccountMeta::new_readonly(gateway,false)],data:data(NATIVE,1,42000)};assert!(send(&mut c,ix).await);let a=c.banks_client.get_account(state).await.unwrap().unwrap();assert_eq!(a.lamports,10_042_000);assert_eq!(u64::from_le_bytes(a.data[8..16].try_into().unwrap()),1);
}
