// Change only the verified game panel, not the entire application shell.
import {renderCribbageRoute} from './cribbage-ui.js';
import {resolveRoute} from './routes.js';
export function updateCribbageView(root,sessionRoute,identity,enabled,pathname){
 const node=root.querySelector('.cribbage-app'),route=resolveRoute(pathname);
 if(!node||route.gameId!=='cribbage'||!sessionRoute)return false;
 node.outerHTML=renderCribbageRoute({screen:route.screen,state:sessionRoute.state,
  identity:[identity,enabled]});
 sessionRoute.bind(root);
 return true;
}
