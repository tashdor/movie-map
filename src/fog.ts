import type {Map,CanvasSource,Coordinates} from 'maplibre-gl';
import {exploredCounty} from './geo.mjs';

export function installCountyFog(map:Map,county:any,locations:[number,number][]){
  const polygons=exploredCounty(county,locations).features[0].geometry.coordinates;
  const canvas=document.createElement('canvas'),mask=document.createElement('canvas');
  const context=canvas.getContext('2d'),maskContext=mask.getContext('2d');
  if(!context||!maskContext)throw Error('Fog canvas unavailable');
  const nativeBlur=typeof Reflect.get(context,'filter')==='string';
  // Overscan keeps the veil continuous while the map moves between redraws.
  const feather=56,margin=192,padding=feather*3;
  let frame:number|undefined;
  const corners=():Coordinates=>{
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    return [[-margin,-margin],[w+margin,-margin],[w+margin,h+margin],[-margin,h+margin]].map(point=>map.unproject(point as [number,number]).toArray()) as Coordinates;
  };
  const draw=()=>{
    const width=Math.max(1,map.getContainer().clientWidth)+margin*2;
    const height=Math.max(1,map.getContainer().clientHeight)+margin*2;
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;mask.width=width+padding*2;mask.height=height+padding*2;}
    maskContext.clearRect(0,0,mask.width,mask.height);
    maskContext.beginPath();
    for(const polygon of polygons)for(const ring of polygon){
      for(let i=0;i<ring.length;i++){
        const point=map.project(ring[i]);
        const x=point.x+margin+padding,y=point.y+margin+padding;
        if(i===0)maskContext.moveTo(x,y);else maskContext.lineTo(x,y);
      }
      maskContext.closePath();
    }
    maskContext.fillStyle='#fff';maskContext.fill('evenodd');
    context.globalCompositeOperation='source-over';if(nativeBlur)context.filter='none';context.fillStyle='#000';
    context.fillRect(0,0,width,height);
    context.globalCompositeOperation='destination-out';
    if(nativeBlur){
      context.filter=`blur(${feather}px)`;context.drawImage(mask,-padding,-padding);context.filter='none';
    }else{
      context.shadowColor='#fff';context.shadowBlur=feather*2;context.shadowOffsetX=100000;
      context.drawImage(mask,-padding-100000,-padding);
      context.shadowColor='transparent';context.shadowBlur=0;context.shadowOffsetX=0;
    }
    context.globalCompositeOperation='source-over';
    const source=map.getSource('county-fog') as CanvasSource|undefined;
    // pause() uploads the changed canvas without keeping an idle animation running.
    if(source){source.setCoordinates(corners());source.play();source.pause();}
  };
  draw();
  map.addSource('county-fog',{type:'canvas',canvas,coordinates:corners(),animate:false});
  map.addLayer({id:'county-fog',type:'raster',source:'county-fog',paint:{'raster-fade-duration':0}});
  const schedule=()=>{if(frame===undefined)frame=requestAnimationFrame(()=>{frame=undefined;draw();});};
  map.on('move',schedule);map.on('resize',schedule);
  return()=>{
    if(frame!==undefined)cancelAnimationFrame(frame);
    map.off('move',schedule);map.off('resize',schedule);
    if(map.getLayer('county-fog'))map.removeLayer('county-fog');
    if(map.getSource('county-fog'))map.removeSource('county-fog');
  };
}
