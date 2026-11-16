export function countyFog(county){
  const geometry=county.features?.[0]?.geometry||county.geometry;
  const polys=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];
  return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]],...polys.map(p=>p[0])]}},...polys.flatMap(p=>p.slice(1).map(ring=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}})))]};
}
