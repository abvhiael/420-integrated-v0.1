// CCC-ART-1: frozen, presentation-only language and region identity.
// Schematic highway branding deliberately does not imply real road distances.
export const CHAOS_ART_DIRECTION=Object.freeze({
 name:'Cross-Country Chaos',
 voice:'Affectionate Canadian road-trip mischief; the road is the joke, not the driver.',
 title:'Coast to coast. One questionable turn at a time.',
 typography:Object.freeze({
  display:'system condensed / sign-painter bold',
  sign:'humanist sans / uppercase highway lettering',
  body:'system UI / clear mixed-case instructions',
  numbers:'tabular numerals for game kilometres'
 }),
 regions:Object.freeze({
  east:Object.freeze({
   shield:'ATLANTIC',sign:'DOWN EAST',
   line:'The ferry has other plans.',
   caption:'Sea air, fog banks, and one very opinionated moose.',
   marker:'FERRY CROSSING'
  }),
  ontario:Object.freeze({
   shield:'ONTARIO',sign:'STILL ONTARIO',
   line:'Yes. You are still in Ontario.',
   caption:'A thousand trees, another lake, and absolutely more highway.',
   marker:'GREAT LAKES'
  }),
  west:Object.freeze({
   shield:'WESTBOUND',sign:'PRAIRIES + PEAKS',
   line:'Flat roads. Tall stories. Taller mountains.',
   caption:'Grain elevators, sidewinds, and a mountain around the bend.',
   marker:'MOUNTAIN PASS'
  })
 })
});
export function chaosRegionArt(region){
 return Object.hasOwn(CHAOS_ART_DIRECTION.regions,region)
  ?CHAOS_ART_DIRECTION.regions[region]:null;
}
