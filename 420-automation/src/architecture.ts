export const AUTOMATION_ARCHITECTURE_VERSION_420 = 'AUT-0/V1' as const;

export type AutomationTriggerClass420 =
  | 'time'
  | 'block'
  | 'event'
  | 'oracle'
  | 'manual';

export interface AutomationArchitecture420 {
  version: typeof AUTOMATION_ARCHITECTURE_VERSION_420;
  serviceName: '420Automation';
  expectedChainId: bigint;
  replaceableOffchainWorkers: boolean;
  triggerGrantsExecutionAuthority: false;
  workerMaySignUserTransactions: false;
  workerMayCustodyUserKeys: false;
  workerMayInventTarget: false;
  workerMayInventCalldata: false;
  workerMayInventValue: false;
  workerMayBypassProtocolAuthorization: false;
  workerMayDefineFinality: false;
  workerMayDefineCanonicalChain: false;
  oracleTriggerIsRemoteExecution: false;
  bridgeProofsInterchangeableWithAutomation: false;
  engineApiPublic: false;
  supportedTriggerClasses: readonly AutomationTriggerClass420[];
}

export const AUTOMATION_ARCHITECTURE_420: AutomationArchitecture420 = {
  version: AUTOMATION_ARCHITECTURE_VERSION_420,
  serviceName: '420Automation',
  expectedChainId: 420n,
  replaceableOffchainWorkers: true,
  triggerGrantsExecutionAuthority: false,
  workerMaySignUserTransactions: false,
  workerMayCustodyUserKeys: false,
  workerMayInventTarget: false,
  workerMayInventCalldata: false,
  workerMayInventValue: false,
  workerMayBypassProtocolAuthorization: false,
  workerMayDefineFinality: false,
  workerMayDefineCanonicalChain: false,
  oracleTriggerIsRemoteExecution: false,
  bridgeProofsInterchangeableWithAutomation: false,
  engineApiPublic: false,
  supportedTriggerClasses: ['time', 'block', 'event', 'oracle', 'manual'],
};

export function validateAutomationArchitecture420(
  architecture: AutomationArchitecture420 = AUTOMATION_ARCHITECTURE_420,
): string[] {
  const errors: string[] = [];

  if (architecture.version !== AUTOMATION_ARCHITECTURE_VERSION_420) errors.push('unexpected architecture version');
  if (architecture.serviceName !== '420Automation') errors.push('serviceName must be 420Automation');
  if (architecture.expectedChainId !== 420n) errors.push('expectedChainId must be 420');
  if (!architecture.replaceableOffchainWorkers) errors.push('workers must remain replaceable off-chain infrastructure');

  const forbiddenAuthorities: Array<[keyof AutomationArchitecture420, boolean]> = [
    ['triggerGrantsExecutionAuthority', architecture.triggerGrantsExecutionAuthority],
    ['workerMaySignUserTransactions', architecture.workerMaySignUserTransactions],
    ['workerMayCustodyUserKeys', architecture.workerMayCustodyUserKeys],
    ['workerMayInventTarget', architecture.workerMayInventTarget],
    ['workerMayInventCalldata', architecture.workerMayInventCalldata],
    ['workerMayInventValue', architecture.workerMayInventValue],
    ['workerMayBypassProtocolAuthorization', architecture.workerMayBypassProtocolAuthorization],
    ['workerMayDefineFinality', architecture.workerMayDefineFinality],
    ['workerMayDefineCanonicalChain', architecture.workerMayDefineCanonicalChain],
    ['oracleTriggerIsRemoteExecution', architecture.oracleTriggerIsRemoteExecution],
    ['bridgeProofsInterchangeableWithAutomation', architecture.bridgeProofsInterchangeableWithAutomation],
    ['engineApiPublic', architecture.engineApiPublic],
  ];

  for (const [name, value] of forbiddenAuthorities) {
    if (value !== false) errors.push(`${String(name)} must remain false`);
  }

  const expectedTriggers: AutomationTriggerClass420[] = ['time', 'block', 'event', 'oracle', 'manual'];
  if (architecture.supportedTriggerClasses.length !== expectedTriggers.length) {
    errors.push('supported trigger class set is incomplete');
  } else {
    for (const trigger of expectedTriggers) {
      if (!architecture.supportedTriggerClasses.includes(trigger)) errors.push(`missing trigger class ${trigger}`);
    }
  }

  return errors;
}
