import { id } from 'ethers';
import type { Hex } from './chain-source.js';
import type { ProtocolEventDescriptor420, ProtocolField420 } from './protocol-decoder.js';

export interface CompensationDeployment420 {
  vault: Hex;
  splitter: Hex;
  vaultCodeHash: Hex;
  splitterCodeHash: Hex;
}
export function compensationDescriptors420(deployment: CompensationDeployment420): ProtocolEventDescriptor420[] {
  const addresses = [deployment.vault, deployment.splitter].map(x => x.toLowerCase());
  if (addresses.some(x => !/^0x[0-9a-f]{40}$/.test(x) || /^0x0{40}$/.test(x)) || addresses[0] === addresses[1]) throw new Error('invalid compensation deployment');
  const event = (address: Hex, name: string, fields: ProtocolField420[]): ProtocolEventDescriptor420 => ({
    protocol: '420DevelopmentCompensation', eventName: name, contractAddress: address,
    topic0: id(name+'('+fields.map(f=>f.kind).join(',')+')') as Hex, fields
  });
  const field = (name: string, kind: ProtocolField420['kind'], indexed = false): ProtocolField420 => ({name,kind,indexed});
  return [
    event(deployment.vault,'DevelopmentCompensationForwarded',[
      field('contributionId','bytes32',true),field('sourceApplicationId','bytes32',true),field('revenueRef','bytes32',true),
      field('source','address'),field('asset','address'),field('beneficiary','address'),field('grossProtocolRevenue','uint256'),
      field('compensationBps','uint16'),field('compensationAmount','uint256'),field('policyRef','bytes32')]),
    event(deployment.splitter,'CompensationVaultBound',[field('immutableVault','address',true)]),
    event(deployment.splitter,'FounderCompensationDeposited',[field('sourceVault','address',true),field('amount','uint256')]),
    event(deployment.splitter,'FounderTokenCompensationCredited',[field('sourceVault','address',true),field('token','address',true),field('contributionId','bytes32',true),field('amount','uint256')]),
    event(deployment.splitter,'FounderCompensationClaimed',[field('beneficiary','address',true),field('asset','address',true),field('amount','uint256')])
  ];
}
