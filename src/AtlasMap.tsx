import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Crosshair,LocateFixed,Minus,Plus} from 'lucide-react';
import {locationSvg} from './icons';
import {countyFog} from './geo.mjs';
import type {Place,Journey} from './types';
maplibregl.setWorkerUrl(workerUrl);
const CITY={center:[-118.325,34.055] as [number,number],zoom:10.55};
type Props={places:Place[];selected:Place|null;journey:Journey|null;onSelect:(id:number)=>void;onFilm:(title:string)=>void;onView:(ids:number[])=>void;onLocationError:(text:string)=>void};
export default function AtlasMap({places,selected,journey,onSelect,onFilm,onView,onLocationError}:Props){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),markers=useRef<maplibregl.Marker[]>([]),routeMarkers=useRef<maplibregl.Marker[]>([]),gps=useRef<maplibregl.GeolocateControl|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[zoom,setZoom]=useState(CITY.zoom),[viewVersion,setViewVersion]=useState(0),[locating,setLocating]=useState(false);
  const latest=useRef({places,onView,onLocationError});latest.current={places,onView,onLocationError};
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    try{
      m=new maplibregl.Map({container:container.current,style:`${import.meta.env.BASE_URL}atlas-style.json`,...CITY,minZoom:5,maxZoom:18,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,canvasContextAttributes:{antialias:true}});map.current=m;
      m.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'imperial'}),'bottom-left');
      const g=new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true,timeout:12000},fitBoundsOptions:{maxZoom:14},trackUserLocation:false,showAccuracyCircle:true,showUserLocation:true});gps.current=g;m.addControl(g,'top-right');
      g.on('geolocate',()=>setLocating(false));g.on('error',event=>{setLocating(false);latest.current.onLocationError(event.code===1?'Location access denied':event.code===3?'Location request timed out':'Location unavailable');});
      m.on('load',async()=>{
        try{const [county,streets]=await Promise.all(['la-county.geojson','story-streets.geojson'].map(file=>fetch(`${import.meta.env.BASE_URL}${file}`).then(r=>{if(!r.ok)throw Error(file);return r.json();})));if(map.current!==m)return;m.addSource('county',{type:'geojson',data:county});m.addSource('story-streets',{type:'geojson',data:streets});m.addSource('county-fog',{type:'geojson',data:countyFog(county) as any});m.addLayer({id:'county-fog',type:'fill',source:'county-fog',paint:{'fill-color':'#242824','fill-opacity':0.88}});m.addLayer({id:'county-border',type:'line',source:'county',paint:{'line-color':'#e1decc','line-opacity':0.6,'line-width':1}});}catch{if(map.current===m)latest.current.onLocationError('County boundary unavailable');}
        if(map.current===m)setReady(true);
      });
      m.on('moveend',()=>{const b=m.getBounds();latest.current.onView(latest.current.places.filter(p=>p.coordinates&&b.contains(p.coordinates)).map(p=>p.id));setZoom(m.getZoom());setViewVersion(v=>v+1);});
      m.on('error',e=>{if(!m.isStyleLoaded()&&/style|fetch/i.test(e.error.message))setError(true);});
    }catch{setError(true);return;}
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{resize.disconnect();m.remove();map.current=null;gps.current=null;};
  },[]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    markers.current.forEach(x=>x.remove());
    const bounds=m.getBounds();
    markers.current=places.filter(p=>p.coordinates).map(p=>{
      const outer=document.createElement('div');outer.className=`atlas-marker ${p.category} ${selected?.id===p.id?'selected':''} ${journey?'receded':''} ${p.placement?.kind==='inferred'?'estimated':''}`;
      const icon=document.createElement('button');icon.type='button';icon.className='marker-icon';icon.setAttribute('aria-label',`Open ${p.name}`);icon.title=p.name;icon.innerHTML=locationSvg(p.category);icon.addEventListener('click',e=>{e.stopPropagation();onSelect(p.id);});outer.append(icon);
      if(p.deaths?.length&&p.category!=='death'){const death=document.createElement('span');death.className='death-badge';death.title='Death';death.innerHTML=locationSvg('death');outer.append(death);}
      const isSelected=selected?.id===p.id;
      if(bounds.contains(p.coordinates!)&&(isSelected||p.featured&&(zoom>11.25||[1,11,16,31,53,83,91].includes(p.id)))){
        const label=document.createElement('div');label.className='marker-label';
        const point=m.project(p.coordinates!);const roomRight=m.getContainer().clientWidth-point.x-48;const roomLeft=point.x-48;const flip=roomRight<Math.min(420,p.name.length*8)&&roomLeft>roomRight;
        if(flip)label.classList.add('label-left');label.style.maxWidth=`${Math.max(160,Math.min(560,flip?roomLeft:roomRight))}px`;
        const tabs=document.createElement('div');tabs.className='marker-film-tabs';
        for(const title of [...new Set(p.appearances.map(a=>a.title))]){const tab=document.createElement('button');tab.type='button';tab.textContent=title;tab.setAttribute('aria-label',`Show ${title} locations`);tab.addEventListener('click',e=>{e.stopPropagation();onFilm(title);});tabs.append(tab);}
        const title=document.createElement('button');title.type='button';title.className='marker-title';title.textContent=p.name;title.addEventListener('click',e=>{e.stopPropagation();onSelect(p.id);});label.append(tabs,title);outer.append(label);
      }
      return new maplibregl.Marker({element:outer,anchor:'center'}).setLngLat(p.coordinates!).addTo(m);
    });
    onView(places.filter(p=>p.coordinates&&bounds.contains(p.coordinates)).map(p=>p.id));
    return()=>{markers.current.forEach(x=>x.remove());markers.current=[];};
  },[places,selected?.id,journey?.id,ready,zoom,viewVersion,onSelect,onFilm,onView]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    for(const id of ['story-road','story-area-line','story-area-fill'])if(m.getLayer(id))m.removeLayer(id);
    if(m.getSource('story-area'))m.removeSource('story-area');
    if(!selected)return;
    if(selected.placement?.geometry){m.addSource('story-area',{type:'geojson',data:{type:'Feature',properties:{},geometry:selected.placement.geometry} as any});if(selected.placement.geometry.type==='Polygon')m.addLayer({id:'story-area-fill',type:'fill',source:'story-area',paint:{'fill-color':'#a5402e','fill-opacity':0.08}});m.addLayer({id:'story-area-line',type:'line',source:'story-area',paint:{'line-color':'#a5402e','line-width':1.7,'line-dasharray':[4,3]}});}
    if(selected.placement?.roadName)m.addLayer({id:'story-road',type:'line',source:'story-streets',filter:['==',['get','street'],selected.placement.roadName],paint:{'line-color':'#a5402e','line-width':5,'line-opacity':0.8}});
    if(selected.placement?.viewport)m.fitBounds(selected.placement.viewport,{padding:65,duration:700});else if(selected.coordinates)m.flyTo({center:selected.coordinates,zoom:Math.max(m.getZoom(),13),duration:700,essential:false});else m.flyTo({...CITY,duration:700});
  },[selected?.id,ready]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    routeMarkers.current.forEach(x=>x.remove());routeMarkers.current=[];
    if(m.getLayer('journey-line'))m.removeLayer('journey-line');if(m.getSource('journey'))m.removeSource('journey');if(!journey)return;
    m.addSource('journey',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:journey.stops.map(s=>s.coordinates)}}});m.addLayer({id:'journey-line',type:'line',source:'journey',paint:{'line-color':'#a5402e','line-width':2.5,'line-dasharray':[2,2]}});
    journey.stops.forEach((s,i)=>{const button=document.createElement('button');button.className='route-marker';button.textContent=String(i+1);button.setAttribute('aria-label',s.name);button.addEventListener('click',()=>s.placeId?onSelect(s.placeId):m.flyTo({center:s.coordinates,zoom:14}));routeMarkers.current.push(new maplibregl.Marker({element:button}).setLngLat(s.coordinates).addTo(m));});
    const b=new maplibregl.LngLatBounds();journey.stops.forEach(s=>b.extend(s.coordinates));m.fitBounds(b,{padding:75,maxZoom:14,duration:700});
    return()=>{routeMarkers.current.forEach(x=>x.remove());};
  },[journey?.id,ready,onSelect]);
  return <div className="map-shell"><div ref={container} className="map-canvas" aria-label="Map of Los Angeles"/>{!ready&&<div className="map-loading">{error?'Map unavailable':'Loading…'}</div>}
    {selected&&!selected.coordinates&&<div className="unlocated-card"><div className="marker-film-tabs">{[...new Set(selected.appearances.map(a=>a.title))].map(t=><button key={t} onClick={()=>onFilm(t)}>{t}</button>)}</div><strong>{selected.name}</strong><span>{selected.placement?.address||'Los Angeles'}</span></div>}
    <div className="north-arrow" aria-hidden="true">N<svg viewBox="0 0 32 64"><path d="M16 3 27 52 16 43 5 52Z" fill="none" stroke="currentColor"/><path d="M16 3V43L5 52Z" fill="currentColor"/></svg></div>
    <div className="map-controls"><button aria-label="My location" title="My location" className={locating?'locating':''} onClick={()=>{setLocating(true);if(!gps.current?.trigger()){setLocating(false);onLocationError('Location unavailable');}}}><Crosshair size={19}/></button><button aria-label="Return to city view" title="Los Angeles" onClick={()=>map.current?.flyTo({...CITY,duration:700})}><LocateFixed size={18}/></button><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={19}/></button></div>
  </div>;
}
