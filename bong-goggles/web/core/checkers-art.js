// Coordinates surveyed on the exact 2048 x 1892 owner-approved board.
export const BOARD_SIZE=Object.freeze([2048,1892]);
export const FILE_EDGES=Object.freeze([215,427,640,851,1064,1274,1486,1699,1916]);
export const RANK_EDGES=Object.freeze([94,307,507,708,909,1113,1318,1518,1720]);
export const ART_PREFIX='/assets/games/checkers/';
export const BOARD_ART=ART_PREFIX+'boards/checkers-board-coordinates.webp';
export const WALLPAPER_ART=ART_PREFIX+'backgrounds/checkers-wallpaper.webp';
export const SQUARES=Object.freeze(Array.from({length:64},(_,i)=>{
 const row=Math.floor(i/8),col=i%8,x0=FILE_EDGES[col],x1=FILE_EDGES[col+1],y0=RANK_EDGES[row],y1=RANK_EDGES[row+1];
 return Object.freeze({id:'ABCDEFGH'[col]+(8-row),row,col,dark:(row+col)%2===1,x:(x0+x1)/2,y:(y0+y1)/2,width:x1-x0,height:y1-y0});
}));
export function checkerArtwork(color,king=false,selected=false){
 if(!['red','black'].includes(color)||typeof king!=='boolean'||typeof selected!=='boolean')throw Error('Invalid checker artwork state');
 return ART_PREFIX+'pieces/checker-'+color+'-'+(king?(selected?'king-selected':'king'):(selected?'selected':'regular'))+'.webp';
}
export function playerAvatar(color){
 if(!['red','black'].includes(color))throw Error('Invalid checker color');
 return ART_PREFIX+'avatars/player-'+color+'.webp';
}
export function checkerPlacement(id){
 const square=SQUARES.find(s=>s.id===id);
 if(!square)throw Error('Unknown checker square');
 const size=Math.min(square.width,square.height)*0.88;
 return Object.freeze({left:100*square.x/BOARD_SIZE[0],top:100*square.y/BOARD_SIZE[1],width:100*size/BOARD_SIZE[0],height:100*size/BOARD_SIZE[1]});
}
