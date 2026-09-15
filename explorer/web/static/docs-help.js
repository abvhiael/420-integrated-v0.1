const BASE='https://abvhiael.github.io/420-integrated-v0.1/';
const PUBLISHED=new Set(['development','genesis']);
const TARGETS=Object.freeze({
  'CTX-EXPLORER-001':'apps/explorer/index/',
  'CTX-EXPLORER-002':'apps/explorer/user-guide/',
  'CTX-EXPLORER-003':'apps/explorer/permissions/',
  'CTX-EXPLORER-004':'apps/explorer/fees/',
  'CTX-EXPLORER-005':'apps/explorer/security/',
  'CTX-EXPLORER-006':'apps/explorer/troubleshooting/'
});

export function resolveExplorerHelp(contextId,{environment,versionIntent='current'}={}){
  if(!TARGETS[contextId]) return {available:false,reason:'unknown-context'};
  if(!PUBLISHED.has(environment)) return {available:false,reason:'unpublished-environment'};
  if(versionIntent!=='current') return {available:false,reason:'unsupported-version-intent'};
  return {available:true,url:new URL(TARGETS[contextId],BASE).toString(),contextId,environment,versionIntent,authority:'documentation-navigation-only'};
}

export function installExplorerHelp({environment}={}){
  for(const node of document.querySelectorAll('[data-doc-context]')){
    const resolved=resolveExplorerHelp(node.dataset.docContext,{environment,versionIntent:'current'});
    if(!resolved.available){
      node.removeAttribute('href');
      node.setAttribute('aria-disabled','true');
      node.dataset.helpState='unavailable';
      continue;
    }
    node.href=resolved.url;
    node.target='_blank';
    node.rel='noopener noreferrer';
    node.dataset.helpState='available';
  }
}
