// Uploaded canonical files live directly under /assets/420bet/{cabinet,backgrounds,symbols,overlays}.
const ROOT='/assets/420bet';
export const EMERALD_ASSETS=Object.freeze({
 cabinet:ROOT+'/cabinet/420bet_slots_cabinet_empty.png',
 wallpaper:ROOT+'/backgrounds/420bet_slots_wallpaper.png',
 symbols:Object.freeze(['01_bud.png','02_grinder.png','03_lighter.png','04_bong.png','05_chips.png','06_wild.png','07_scatter.png'].map(n=>ROOT+'/symbols/'+n)),
 bigWin:ROOT+'/overlays/420bet_big_win_overlay.png',
 freeSpins:ROOT+'/overlays/420bet_free_spins_overlay.png'
});
