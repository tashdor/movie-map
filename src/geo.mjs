const area=ring=>Math.abs(ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1];},0));
function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export function exploredCounty(county,coordinates=[]){
  const geometry=county.features?.[0]?.geometry||county.geometry;
  const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
  const mainland=polygons.reduce((a,b)=>area(a[0])>area(b[0])?a:b);
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:polygons.filter(p=>p===mainland||coordinates.some(c=>inRing(c,p[0])&&!p.slice(1).some(r=>inRing(c,r))))}}]};
}
export function countyFog(county,coordinates=[]){
  const polys=exploredCounty(county,coordinates).features[0].geometry.coordinates;
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...polys.map(p=>p[0])]}},...polys.flatMap(p=>p.slice(1).map(ring=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}})))]};
}
