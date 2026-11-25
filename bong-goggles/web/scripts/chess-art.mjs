// Explicit owner-uploaded art inventory. Original PNGs remain untouched.
export const chessArt=[
 ['chess-wallpaper',1600,false,300*1024],
 ['chess-logo',900,true,100*1024],
 ['chess-board',1000,true,220*1024],
 ...['white','black'].flatMap(side=>['king','queen','rook','bishop','knight','pawn'].map(piece=>['pieces/'+side+'-'+piece,256,true,35*1024])),
 ...['panel-content-large','panel-move-history','player-card-ai','player-card-you','button-easy','button-medium','button-hard','button-start-match','button-undo','button-restart','button-flip-board','icon-menu','icon-profile','icon-settings','icon-help'].map(name=>['ui/'+name,name.startsWith('panel')?500: name.startsWith('icon')?128:600,true,65*1024])
];
export const chessArtPrefix='assets/games/chess/';
export const chessArtPaths=new Set(chessArt.map(([name])=>chessArtPrefix+name+'.webp'));
export const chessArtBudget=2*1024*1024;
