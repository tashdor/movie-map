import {MercatorCoordinate} from 'maplibre-gl';
import {exploredCounty} from './geo.mjs';

export function countyCamera(county,locations,{width,height,bearing=0,padding=24}){
  if(width<=padding*2||height<=padding*2)return null;
  const radians=-bearing*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const polygons=exploredCounty(county,locations).features[0].geometry.coordinates;
  for(const polygon of polygons)for(const ring of polygon)for(const coordinate of ring){
    const point=MercatorCoordinate.fromLngLat(coordinate);
    const x=point.x*cos-point.y*sin,y=point.x*sin+point.y*cos;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  const scale=Math.min((width-padding*2)/(maxX-minX),(height-padding*2)/(maxY-minY));
  const x=(minX+maxX)/2,y=(minY+maxY)/2;
  const center=new MercatorCoordinate(x*cos+y*sin,-x*sin+y*cos).toLngLat().toArray();
  return {center,zoom:Math.log2(scale/512),bearing};
}
