import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { Place, Journey } from './types';

maplibregl.setWorkerUrl(workerUrl);
const CITY = { center: [-118.325, 34.055] as [number,number], zoom: 10.55 };

export default function AtlasMap({places,selected,journey,onSelect,onView}:{places:Place[];selected:Place|null;journey:Journey|null;onSelect:(id:number)=>void;onView:(ids:number[])=>void}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map|null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const routeMarkers = useRef<maplibregl.Marker[]>([]);
  const [ready,setReady]=useState(false), [error,setError]=useState(false), [zoom,setZoom]=useState(CITY.zoom);
  const latest=useRef({places,onView}); latest.current={places,onView};
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    try {
      m = new maplibregl.Map({container:container.current,style:`${import.meta.env.BASE_URL}atlas-style.json`,...CITY,maxZoom:18,minZoom:8,maxBounds:[[-119,33.45],[-117.5,34.6]],attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,canvasContextAttributes:{antialias:true}});
      map.current=m;
      m.addControl(new maplibregl.ScaleControl({maxWidth:110,unit:'imperial'}),'bottom-left');
      m.on('load',()=>setReady(true));
      m.on('moveend',()=>{const bounds=m.getBounds();latest.current.onView(latest.current.places.filter(p=>bounds.contains(p.coordinates)).map(p=>p.id));setZoom(m.getZoom());});
      m.on('error',e=>{if(!m.isStyleLoaded() && /style|fetch/i.test(e.error.message))setError(true);});
    } catch {setError(true);return;}
    const observer = new ResizeObserver(()=>m.resize());observer.observe(container.current);
    return ()=>{observer.disconnect();setReady(false);m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!ready||!map.current)return;
    markers.current.forEach(m=>m.remove());
    markers.current=places.map(p=>{
      const button=document.createElement('button');button.type='button';
      button.className=`atlas-marker ${p.category} ${selected?.id===p.id?'selected':''} ${journey?'receded':''}`;
      button.setAttribute('aria-label',`Open ${p.name}`);button.title=p.name;
      const number=document.createElement('span');number.className='marker-number';number.textContent=String(p.id).padStart(2,'0');button.append(number);
      if(selected?.id===p.id || p.featured && (zoom>11.25||[1,11,16,31,53,83,91].includes(p.id))){const label=document.createElement('span');label.className='marker-label';label.textContent=p.short;button.append(label);}
      button.addEventListener('click',event=>{event.stopPropagation();onSelect(p.id);});
      return new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(p.coordinates).addTo(map.current!);
    });
    const bounds=map.current.getBounds();onView(places.filter(p=>bounds.contains(p.coordinates)).map(p=>p.id));
    return ()=>{markers.current.forEach(m=>m.remove());markers.current=[];};
  },[places,selected?.id,journey?.id,ready,zoom,onSelect,onView]);
  useEffect(()=>{
    if(!ready||!map.current||!selected)return;
    map.current.flyTo({center:selected.coordinates,zoom:Math.max(map.current.getZoom(),13),duration:850,essential:false});
  },[selected?.id,ready]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    routeMarkers.current.forEach(marker=>marker.remove());routeMarkers.current=[];
    if(m.getLayer('journey-line'))m.removeLayer('journey-line');
    if(m.getSource('journey'))m.removeSource('journey');
    if(!journey)return;
    m.addSource('journey',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:journey.stops.map(s=>s.coordinates)}}});
    m.addLayer({id:'journey-line',type:'line',source:'journey',paint:{'line-color':'#a5402e','line-width':2.5,'line-dasharray':[2,2],'line-opacity':0.85}});
    journey.stops.forEach((stop,i)=>{const b=document.createElement('button');b.type='button';b.className='route-marker';b.textContent=String(i+1);b.title=stop.name;b.setAttribute('aria-label',stop.name);b.addEventListener('click',()=>{if(stop.placeId)onSelect(stop.placeId);else m.flyTo({center:stop.coordinates,zoom:14});});routeMarkers.current.push(new maplibregl.Marker({element:b}).setLngLat(stop.coordinates).addTo(m));});
    const bounds=new maplibregl.LngLatBounds();journey.stops.forEach(s=>bounds.extend(s.coordinates));m.fitBounds(bounds,{padding:75,maxZoom:14,duration:900});
    return ()=>{routeMarkers.current.forEach(marker=>marker.remove());routeMarkers.current=[];};
  },[journey?.id,ready,onSelect]);
  return <div className="map-shell">
    <div ref={container} className="map-canvas" aria-label="Interactive map of fictional Los Angeles" />
    {!ready&&<div className="map-loading"><span className="compass-star">✦</span><span>{error?'The background map is unavailable. The directory is still open.':'Unfolding Los Angeles…'}</span></div>}
    <div className="map-edition"><span>LOS ANGELES & VICINITY</span><span>FICTIONAL ATLAS / PLATE 01</span></div>
    <div className="north-arrow" aria-hidden="true"><span>N</span><svg viewBox="0 0 32 64"><path d="M16 3 27 52 16 43 5 52Z" fill="none" stroke="currentColor"/><path d="M16 3V43L5 52Z" fill="currentColor"/></svg></div>
    <div className="map-controls"><button title="Return to Los Angeles" aria-label="Return to city view" onClick={()=>map.current?.flyTo({...CITY,duration:900})}><LocateFixed size={18}/></button><button title="Zoom in" aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={19}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={19}/></button></div>
    <div className="map-key"><span><i className="home"/>Home</span><span><i className="work"/>Work</span><span><i className="hangout"/>Hangout</span><span><i className="event"/>Event</span></div>
    <div className="ocean-label" aria-hidden="true">PACIFIC<br/>OCEAN</div>
  </div>;
}
