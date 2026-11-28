import {escapeHtml as esc} from './design-system.js';
import {renderGameAccountPanel} from './account-identity.js';
import {BOARD_ART,WALLPAPER_ART,playerAvatar} from './checkers-art.js';
import {CHECKERS_PROTOCOL} from './checkers-protocol.js';
const screens=['intro','rules','play','setup','table','results','history','rematch'];
const labels={intro:'Overview',rules:'Rules',play:'Play',setup:'Opponents',table:'Table',results:'Results',history:'History',rematch:'Rematch'};
const rules='Two players, twelve pieces each, dark squares only. Black moves first. Men move and capture forward; kings move and capture in both directions. Captures and continued jumps are compulsory. Reaching the king row during a jump ends the turn. No flying kings. Victory by removing all opposing pieces or leaving no legal moves. Automatic draw thresholds await rules qualification.';
export function renderCheckersFoundation({screen='intro',accountIdentityState=null,accountIdentityEnabled=false}={}){
 if(!screens.includes(screen))throw Error('Invalid Checkers screen');
 const nav=screens.map(s=>'<a data-route="classic-game" href="/games/checkers'+(s==='intro'?'':'/'+s)+'" aria-current="'+(s===screen?'page':'false')+'">'+labels[s]+'</a>').join('');
 const message=screen==='rules'?rules:screen==='intro'?'Standard North American Checkers. Custom emerald and gold artwork.':screen==='history'?'No Checkers match history is available before release.':'No authorized Checkers match is available. Gameplay remains disabled until rules and session qualification.';
 return '<section class="ck-foundation" aria-label="Checkers"><a href="/games" data-route="games">All games</a><h2>Checkers</h2><nav aria-label="Checkers screens">'+nav+'</nav><p role="status">Registered · Gameplay not released</p><p>'+esc(message)+'</p><div class="ck-art-preview"><img src="'+BOARD_ART+'" alt="Approved empty eight by eight Checkers board"><div class="ck-portraits"><img src="'+playerAvatar('red')+'" alt="Red player artwork"><img src="'+playerAvatar('black')+'" alt="Black player artwork"></div></div><p>State protocol: '+CHECKERS_PROTOCOL+' · Non-wagering · No wallet required</p>'+renderGameAccountPanel(accountIdentityState,{enabled:accountIdentityEnabled})+'<p><a href="/games/rooms" data-route="classic-rooms">Authenticated multiplayer lobbies</a> (no Checkers match start)</p></section>';
}
