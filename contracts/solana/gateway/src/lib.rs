//! Source escrow for the authenticated 420 bridge instruction profile.
//! No withdrawal or deployment is implied by this local source implementation.
use solana_program::{account_info::{next_account_info, AccountInfo}, entrypoint::ProgramResult, program::{invoke, invoke_signed}, program_error::ProgramError, program_pack::Pack, pubkey, pubkey::Pubkey, rent::Rent, system_instruction, system_program, sysvar::Sysvar};
use spl_token::state::{Account as TokenAccount, Mint};
#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub const STATE_LEN: usize = 48;
pub const RAY: Pubkey = pubkey!("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R");
pub const EURC: Pubkey = pubkey!("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr");
pub const ATA: Pubkey = pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
// keccak256("420/BRIDGE/SOLANA/NATIVE/SOL"), matching the EVM adapter.
pub const NATIVE: [u8;32] = [32, 113, 59, 116, 44, 142, 117, 186, 175, 47, 122, 1, 232, 38, 222, 27, 31, 194, 254, 29, 227, 66, 149, 210, 90, 215, 29, 216, 134, 161, 181, 143];
pub fn state_address(program: &Pubkey, asset: &[u8;32]) -> (Pubkey,u8) {Pubkey::find_program_address(&[b"420-state",asset],program)}
pub fn token_vault(state: &Pubkey, mint: &Pubkey) -> Pubkey {Pubkey::find_program_address(&[state.as_ref(),spl_token::id().as_ref(),mint.as_ref()],&ATA).0}
fn invalid<T>() -> Result<T,ProgramError> {Err(ProgramError::InvalidInstructionData)}
fn asset_ok(asset:&[u8;32]) -> bool {*asset==NATIVE || *asset==RAY.to_bytes() || *asset==EURC.to_bytes()}
fn load_nonce(program:&Pubkey,state:&AccountInfo,asset:&[u8;32]) -> Result<u64,ProgramError> {
 if state.owner!=program || !state.is_writable || state.key!=&state_address(program,asset).0 {return invalid();}
 let data=state.try_borrow_data()?;
 if data.len()!=STATE_LEN || &data[..8]!=b"420STAT1" || &data[16..48]!=asset {return invalid();}
 Ok(u64::from_le_bytes(data[8..16].try_into().unwrap()))
}
pub fn process_instruction(program:&Pubkey,accounts:&[AccountInfo],data:&[u8]) -> ProgramResult {
 if data.len()==40 && &data[..8]==b"420INIT1" {
  let asset:[u8;32]=data[8..].try_into().unwrap();if !asset_ok(&asset) || accounts.len()!=3 {return invalid();}
  let it=&mut accounts.iter();let payer=next_account_info(it)?;let state=next_account_info(it)?;let system=next_account_info(it)?;
  let (expected,bump)=state_address(program,&asset);
  if state.owner!=&system_program::id() || !payer.is_signer || !payer.is_writable || !state.is_writable || state.key!=&expected || system.key!=&system_program::id() || !state.data_is_empty() {return invalid();}
  let rent=Rent::get()?.minimum_balance(STATE_LEN);
  let seeds:&[&[u8]]=&[b"420-state",&asset,&[bump]];
  if state.lamports()==0 {
   invoke_signed(&system_instruction::create_account(payer.key,state.key,rent,STATE_LEN as u64,program),&[payer.clone(),state.clone(),system.clone()],&[seeds])?;
  } else {
   if state.lamports()<rent {invoke(&system_instruction::transfer(payer.key,state.key,rent-state.lamports()),&[payer.clone(),state.clone(),system.clone()])?;}
   invoke_signed(&system_instruction::allocate(state.key,STATE_LEN as u64),&[state.clone(),system.clone()],&[seeds])?;
   invoke_signed(&system_instruction::assign(state.key,program),&[state.clone(),system.clone()],&[seeds])?;
  }
  let mut state_data=state.try_borrow_mut_data()?;state_data[..8].copy_from_slice(b"420STAT1");state_data[8..16].copy_from_slice(&0u64.to_le_bytes());state_data[16..].copy_from_slice(&asset);return Ok(());
 }
 if data.len()!=160 || &data[..8]!=b"420SOLV1" {return invalid();}
 let amount=u64::from_le_bytes(data[8..16].try_into().unwrap());let asset:[u8;32]=data[16..48].try_into().unwrap();let nonce=u64::from_le_bytes(data[152..160].try_into().unwrap());
 if amount==0 || nonce==0 || !asset_ok(&asset) || data[48..68].iter().all(|x|*x==0) || data[68..100].iter().all(|x|*x==0) || data[100..120].iter().all(|x|*x==0) || data[120..152].iter().all(|x|*x==0) {return invalid();}
 let native=asset==NATIVE;if accounts.len()!=if native {3}else{6} {return invalid();}
 let owner=&accounts[0];let vault=&accounts[1];if !owner.is_signer || !vault.is_writable {return invalid();}
 let state=if native {vault}else{&accounts[5]};let old=load_nonce(program,state,&asset)?;
 if old.checked_add(1)!=Some(nonce) {return invalid();}
 if native {
  if !owner.is_writable || accounts[2].key!=&system_program::id() {return invalid();}
  invoke(&system_instruction::transfer(owner.key,vault.key,amount),&[owner.clone(),vault.clone(),accounts[2].clone()])?;
 } else {
  let mint=&accounts[2];let source=&accounts[3];let token=&accounts[4];
  if mint.key.to_bytes()!=asset || mint.owner!=&spl_token::id() || vault.owner!=&spl_token::id() || source.owner!=&spl_token::id() || !source.is_writable || token.key!=&spl_token::id() || vault.key!=&token_vault(state.key,mint.key) {return invalid();}
  let mint_state=Mint::unpack(&mint.try_borrow_data()?)?;let from=TokenAccount::unpack(&source.try_borrow_data()?)?;let to=TokenAccount::unpack(&vault.try_borrow_data()?)?;
  if mint_state.decimals!=6 || from.owner!=*owner.key || from.mint!=*mint.key || to.owner!=*state.key || to.mint!=*mint.key {return invalid();}
  let expected_from=from.amount.checked_sub(amount).ok_or(ProgramError::InsufficientFunds)?;let expected_to=to.amount.checked_add(amount).ok_or(ProgramError::ArithmeticOverflow)?;
  invoke(&spl_token::instruction::transfer_checked(&spl_token::id(),source.key,mint.key,vault.key,owner.key,&[],amount,6)? ,&[source.clone(),mint.clone(),vault.clone(),owner.clone(),token.clone()])?;
  if TokenAccount::unpack(&source.try_borrow_data()?)?.amount!=expected_from || TokenAccount::unpack(&vault.try_borrow_data()?)?.amount!=expected_to {return invalid();}
 }
 state.try_borrow_mut_data()?[8..16].copy_from_slice(&nonce.to_le_bytes());Ok(())
}
