/** Minimal deterministic WCAG contrast helpers for design-token regression checks. */
export function luminance(hex){
  if(typeof hex!=='string'||!/^#[0-9a-fA-F]{6}$/.test(hex))throw new Error('invalid hex color');
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  return rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4)
    .reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
}
export function contrastRatio(foreground,background){
  const [a,b]=[luminance(foreground),luminance(background)].sort((x,y)=>y-x);
  return (a+.05)/(b+.05);
}
