import type {Map,CanvasSource,Coordinates} from 'maplibre-gl';
import {exploredCounty,fogViewportMode} from './geo.mjs';

export function installCountyFog(map:Map,county:any,locations:[number,number][]){
  const polygons=exploredCounty(county,locations).features[0].geometry.coordinates;
  const canvas=document.createElement('canvas'),mask=document.createElement('canvas');
  canvas.width=canvas.height=1;
  const context=canvas.getContext('2d'),maskContext=mask.getContext('2d');
  if(!context||!maskContext)throw Error('Fog canvas unavailable');
  const nativeBlur=typeof Reflect.get(context,'filter')==='string';
  // Overscan preserves the veil in motion; half-resolution paint keeps the same CSS-pixel feather.
  const feather=56,margin=192,scale=.5,padding=feather*3*scale;
  let frame:number|undefined,mode='',forceFrame=false;
  let painted:{center:[number,number];zoom:number;bearing:number;width:number;height:number}|undefined;
  const corners=():Coordinates=>{
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    return [[-margin,-margin],[w+margin,-margin],[w+margin,h+margin],[-margin,h+margin]].map(point=>map.unproject(point as [number,number]).toArray()) as Coordinates;
  };
  const draw=(force=false)=>{
    const {clientWidth:w,clientHeight:h}=map.getContainer();
    if(!force&&mode==='feathered'&&painted&&painted.width===w&&painted.height===h){
      const point=map.project(painted.center),rotation=Math.abs((map.getBearing()-painted.bearing+540)%360-180);
      // The georeferenced texture already follows the camera. Repaint before its overscan is exhausted.
      if(Math.abs(point.x-w/2)<margin/2&&Math.abs(point.y-h/2)<margin/2&&Math.abs(map.getZoom()-painted.zoom)<.12&&rotation<2)return;
    }
    const projected=polygons.map((polygon:any)=>polygon.map((ring:any)=>ring.map((coordinate:[number,number])=>{const point=map.project(coordinate);return [point.x,point.y];})));
    const next=fogViewportMode(projected,w,h,feather*3);
    if(next==='clear'){
      if(mode!=='clear'&&map.getLayer('county-fog'))map.setLayoutProperty('county-fog','visibility','none');
      mode=next;return;
    }
    let changed=next!==mode;
    if(next==='black'){
      if(canvas.width!==1||canvas.height!==1){canvas.width=canvas.height=1;changed=true;}
      if(changed){context.globalCompositeOperation='source-over';if(nativeBlur)context.filter='none';context.fillStyle='#000';context.fillRect(0,0,1,1);}
    }else{
      const width=Math.ceil((Math.max(1,w)+margin*2)*scale),height=Math.ceil((Math.max(1,h)+margin*2)*scale);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;mask.width=width+padding*2;mask.height=height+padding*2;}
      maskContext.clearRect(0,0,mask.width,mask.height);maskContext.beginPath();
      for(const polygon of projected)for(const ring of polygon){
        ring.forEach(([x,y]:[number,number],i:number)=>{const px=(x+margin)*scale+padding,py=(y+margin)*scale+padding;if(i===0)maskContext.moveTo(px,py);else maskContext.lineTo(px,py);});
        maskContext.closePath();
      }
      maskContext.fillStyle='#fff';maskContext.fill('evenodd');
      context.globalCompositeOperation='source-over';if(nativeBlur)context.filter='none';context.fillStyle='#000';context.fillRect(0,0,width,height);
      context.globalCompositeOperation='destination-out';
      if(nativeBlur){context.filter=`blur(${feather*scale}px)`;context.drawImage(mask,-padding,-padding);context.filter='none';}
      else{context.shadowColor='#fff';context.shadowBlur=feather*2*scale;context.shadowOffsetX=100000;context.drawImage(mask,-padding-100000,-padding);context.shadowColor='transparent';context.shadowBlur=0;context.shadowOffsetX=0;}
      context.globalCompositeOperation='source-over';changed=true;
    }
    const source=map.getSource('county-fog') as CanvasSource|undefined;
    if(source){source.setCoordinates(corners());if(changed){source.play();source.pause();}}
    if(mode==='clear'&&map.getLayer('county-fog'))map.setLayoutProperty('county-fog','visibility','visible');
    if(next==='feathered')painted={center:map.unproject([w/2,h/2]).toArray() as [number,number],zoom:map.getZoom(),bearing:map.getBearing(),width:w,height:h};
    mode=next;
  };
  draw();
  map.addSource('county-fog',{type:'canvas',canvas,coordinates:corners(),animate:false});
  map.addLayer({id:'county-fog',type:'raster',source:'county-fog',layout:{visibility:mode==='clear'?'none':'visible'},paint:{'raster-fade-duration':0}});
  const schedule=()=>{if(frame===undefined)frame=requestAnimationFrame(()=>{frame=undefined;const force=forceFrame;forceFrame=false;draw(force);});};
  const settle=()=>{forceFrame=true;schedule();};
  map.on('move',schedule);map.on('moveend',settle);map.on('resize',settle);
  return()=>{if(frame!==undefined)cancelAnimationFrame(frame);map.off('move',schedule);map.off('moveend',settle);map.off('resize',settle);if(map.getLayer('county-fog'))map.removeLayer('county-fog');if(map.getSource('county-fog'))map.removeSource('county-fog');};
}
