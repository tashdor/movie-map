const cache=new Map();
function randomFor(seed){
  let state=2166136261;
  for(const char of seed)state=Math.imul(state^char.charCodeAt(0),16777619);
  return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
function outline(random,inset){
  const top=[],bottom=[];
  for(let x=8;x<=590;x+=32){top.push([x,8+inset+random()*7]);bottom.unshift([x,92-inset-random()*7]);}
  const points=[...top,[594-inset,28],[593-inset,53],[595-inset,76],...bottom,[5+inset,73],[7+inset,49],[5+inset,26]];
  const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const pair=p=>p.map(n=>n.toFixed(1)).join(' ');
  let path=`M${pair(midpoint(points.at(-1),points[0]))}`;
  for(let i=0;i<points.length;i++)path+=`Q${pair(points[i])} ${pair(midpoint(points[i],points[(i+1)%points.length]))}`;
  return path+'Z';
}
export function markerInk(seed){
  if(cache.has(seed))return cache.get(seed);
  const random=randomFor(String(seed));
  let paths=`<path opacity=".16" d="${outline(random,-3)}"/><path opacity=".4" d="${outline(random,-1)}"/><path d="${outline(random,1)}"/>`;
  for(let i=0;i<3;i++){
    const y=28+i*22+random()*4;
    paths+=`<path fill="none" stroke="${i%2?'#060606':'#292826'}" stroke-opacity=".22" stroke-width="${1+random()*2}" d="M${15+random()*10} ${y}Q${180+random()*80} ${y-5+random()*10} 580 ${y-2+random()*4}"/>`;
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 100" preserveAspectRatio="none"><g fill="#111">${paths}</g></svg>`;
  const url=`url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  if(cache.size>2000)cache.clear();
  cache.set(seed,url);
  return url;
}
export function inkAppearance(seed){
  const random=randomFor(String(seed));
  return {'--redaction-ink':markerInk(seed),'--ink-tilt':`${(random()*1.6-.8).toFixed(2)}deg`,'--ink-flip':random()>.5?'1':'-1'};
}
