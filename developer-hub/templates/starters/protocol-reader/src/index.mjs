export function resolveProtocol420(sdk, contractName, serviceName) {
  const contract = sdk.contract(contractName);
  if (!contract) throw new Error(`unknown canonical contract: ${contractName}`);
  const service = serviceName ? sdk.service(serviceName) : null;
  return Object.freeze({ contract, service });
}
