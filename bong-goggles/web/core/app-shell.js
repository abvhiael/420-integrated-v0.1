import {navigationItems,resolveRoute,routeAccess} from './routes.js';
import {card,emptyState,canonicalHandoffs,escapeHtml,skeleton} from './design-system.js';
import {renderProfileView,renderRelationshipLists} from './profile-ui.js';

function navMarkup(items,activeId,placement){
  return `<nav class="app-nav app-nav--${placement}" aria-label="${placement==='mobile'?'Primary mobile':'Primary'}">
    ${items.map(item=>`<a href="${item.path}" data-route="${item.id}" aria-current="${item.id===activeId?'page':'false'}" class="app-nav__item ${item.access.allowed?'':'is-locked'}">
      <span aria-hidden="true">${escapeHtml(item.icon)}</span>
      <span>${escapeHtml(item.label)}</span>
    </a>`).join('')}
  </nav>`;
}

function routePlaceholder(route,access,{profileProjection=null,relationshipProjection=null,relationshipCollection=null,viewer=null,walletView=null}={}){
  if(route.id==='profile'){
    return renderProfileView({
      profile:profileProjection,
      relationship:relationshipProjection,
      viewer,
      walletView
    });
  }
  if(route.id==='friends'){
    if(!access.allowed){
      return card({
        eyebrow:'Read-only mode',
        title:'Friends requires 420Wallet',
        body:'<p>Connect 420Wallet on the configured network to view account-scoped social graph lists.</p>'
      });
    }
    if(!relationshipCollection){
      return card({
        eyebrow:'Canonical projection',
        title:'Friends',
        body:emptyState({
          title:'Relationship projection unavailable',
          message:'The browser will not synthesize friends/followers/following state. A qualified indexer transport must supply the canonical projection.'
        })
      });
    }
    return card({
      eyebrow:'Canonical social graph',
      title:'Friends',
      body:renderRelationshipLists({
        viewer,
        relationships:relationshipCollection.relationships??[],
        profiles:relationshipCollection.profiles??[],
        list:'friends'
      })
    });
  }
  if(!access.allowed){
    return card({
      eyebrow:'Read-only mode',
      title:`${route.label} requires 420Wallet`,
      body:`<p>Connect 420Wallet on the configured 420 network to access this area. Public Bong Goggles browsing remains available.</p>`
    });
  }
  return card({
    eyebrow:'BG-19 web application',
    title:route.label,
    body:emptyState({
      title:`${route.label} surface ready`,
      message:'The reusable application shell is active. Feature-specific data and actions are implemented in later BG-19 increments.'
    })
  });
}

export function renderApplicationShell({
  pathname='/',
  walletView=null,
  bootstrapState='ready',
  appOrigin='https://bonggoggles.420integrated.org',
  walletHref=null,
  explorerHref=null,
  announcement=null,
  profileProjection=null,
  relationshipProjection=null,
  relationshipCollection=null
}={}){
  const route=resolveRoute(pathname);
  const access=routeAccess(route,{
    connected:walletView?.connected===true,
    supportedNetwork:walletView?.supportedNetwork!==false
  });
  const nav=navigationItems({
    connected:walletView?.connected===true,
    supportedNetwork:walletView?.supportedNetwork!==false
  });
  const degraded=bootstrapState==='degraded'||bootstrapState==='unsupported-network';
  const content=bootstrapState==='loading'
    ?card({title:'Loading Bong Goggles',body:skeleton({lines:4})})
    :route.id==='not-found'
      ?card({title:'Page not found',body:emptyState({title:'404',message:'That Bong Goggles route does not exist.'})})
      :routePlaceholder(route,access,{profileProjection,relationshipProjection,relationshipCollection,viewer:walletView?.account??null,walletView});

  return `<div class="app-shell" data-route="${escapeHtml(route.id)}">
    <header class="app-header">
      <a class="brand" href="/" data-route="home" aria-label="Bong Goggles home">
        <span class="brand__mark" aria-hidden="true">420</span>
        <span><strong>Bong Goggles</strong><small>420 Integrated social</small></span>
      </a>
      <div class="header-state">
        <span class="status">${escapeHtml(bootstrapState)}</span>
        <span class="account-chip">${walletView?.connected?escapeHtml(walletView.account):'read-only'}</span>
      </div>
    </header>
    ${degraded?`<div class="system-banner" role="status">Canonical services are degraded or the active network is unsupported. Write actions remain unavailable.</div>`:''}
    ${announcement?`<div class="system-banner system-banner--info" role="status">${escapeHtml(announcement)}</div>`:''}
    <div class="app-layout">
      <aside class="app-sidebar">
        ${navMarkup(nav,route.id,'desktop')}
        ${canonicalHandoffs({walletHref,explorerHref})}
      </aside>
      <main class="app-content" id="main-content" tabindex="-1">
        <div class="route-heading">
          <p class="eyebrow">${escapeHtml(route.id==='not-found'?'Navigation':access.mode)}</p>
          <h1>${escapeHtml(route.label)}</h1>
        </div>
        ${content}
      </main>
      <aside class="app-rail" aria-label="Application status">
        ${card({
          eyebrow:'Authority',
          title:'Canonical state',
          body:`<p>Bong Goggles presents indexed and canonical state. 420Wallet remains the approval boundary for writes.</p><dl class="mini-grid"><div><dt>Network</dt><dd>${escapeHtml(walletView?.chainId??'—')}</dd></div><div><dt>Session</dt><dd>${escapeHtml(walletView?.sessionState??'none')}</dd></div></dl>`
        })}
      </aside>
    </div>
    ${navMarkup(nav.filter(item=>['home','discover','messages','notifications','profile'].includes(item.id)),route.id,'mobile')}
  </div>`;
}

export function navigateWithoutReload(event,{windowObject=window,onNavigate}={}){
  const anchor=event.target?.closest?.('a[data-route]');
  if(!anchor) return false;
  const url=new URL(anchor.href,windowObject.location.href);
  if(url.origin!==windowObject.location.origin) return false;
  event.preventDefault();
  windowObject.history.pushState({},'',url.pathname);
  onNavigate?.(url.pathname);
  return true;
}
