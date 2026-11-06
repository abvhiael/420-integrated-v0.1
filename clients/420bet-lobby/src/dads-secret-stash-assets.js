// Exact approved concept-pack PNG paths. Install PNG pack at this public URL root.
export const DSS_ASSET_ROOT='/assets/420bet/dads-secret-stash';
const path=p=>DSS_ASSET_ROOT+'/'+p;
export const DSS_SYMBOL_ART=Object.freeze({
 gary:path('characters/gary_reel.png'),
 jen:path('characters/jen_reel.png'),
 tyler:path('characters/tyler_reel.png'),
 emma:path('characters/emma_reel.png'),
 keller:path('characters/mr_keller_reel.png'),
 bud:path('characters/bud_reel.png'),
 jar:path('paying/premium_stash_jar.png'),
 bong:path('paying/premium_glass_bong.png'),
 pizza:path('paying/pizza_slice.png'),
 lighter:path('paying/lighter.png'),
 papers:path('paying/papers.png'),
 A:path('paying/card_A.png'),
 K:path('paying/card_K.png'),
 Q:path('paying/card_Q.png'),
 J:path('paying/card_J.png'),
 '10':path('paying/card_10.png'),
 wild:path('special/gary_wild.png'),
 scatter:path('special/scatter.png'),
 stash:path('special/stash_crate.png'),
 mower:path('special/lawnmower.png')
});
export const DSS_BACKGROUND_ART=Object.freeze({
 main:path('backgrounds/garage_main.png'),
 free:path('backgrounds/garage_free_spins.png'),
 stash:path('backgrounds/stash_room_hold_win.png'),
 mow:path('backgrounds/suburban_lawn_cascades.png')
});
export const DSS_TRANSITION_ART=Object.freeze({
 jen:path('transitions/jen_splash.png'),
 family:path('transitions/family_splash.png'),
 keller:path('transitions/keller_splash.png'),
 bud:path('transitions/bud_splash.png')
});
export const DSS_CAST_ART=Object.freeze({
 jen:[path('characters/jen_reel.png')],
 family:[path('characters/tyler_reel.png'),path('characters/emma_reel.png')],
 keller:[path('characters/mr_keller_reel.png')],
 bud:[path('characters/bud_reel.png')],
 free:[path('characters/gary_main.png')],
 stash:[path('characters/gary_main.png')],
 mow:[path('characters/gary_main.png')]
});
export const DSS_FEATURE_ART=Object.freeze({
 jen:path('overlays/oh_shit_shes_home.png'),
 free:path('overlays/five_minutes_of_peace.png'),
 stash:path('overlays/hold_and_win.png'),
 mow:path('overlays/mow_the_lawn.png')
});
export const DSS_SYMBOL_LABELS=Object.freeze({
 gary:'Gary',jen:'Jen',tyler:'Tyler',emma:'Emma',keller:'Mr. Keller',bud:'Bud',
 jar:'Stash Jar',bong:'Glass Bong',pizza:'Pizza',lighter:'Lighter',papers:'Rolling Papers',
 A:'A',K:'K',Q:'Q',J:'J','10':'10',wild:'Gary Wild',scatter:'Scatter',stash:'Secret Stash',mower:'Lawnmower'
});

export const DSS_LARRY_ART=Object.freeze({
 main:path('characters/gary_main.png'),
 stash:path('characters/gary_hold_win.png'),
 free:path('characters/gary_free_spins.png'),
 mow:path('characters/gary_mow_the_lawn.png')
});
