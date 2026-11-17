import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Crosshair,LocateFixed,Minus,Plus} from 'lucide-react';
import {locationSvg} from './icons';
import {filmColor} from './colors';
import {countyFog,exploredCounty} from './geo.mjs';
import type {Place,Journey} from './types';
maplibregl.setWorkerUrl(workerUrl);
const CITY={center:[-118.325,34.055] as [number,number],zoom:10.55};
type Props={basemap:'map'|'satellite';onBasemap:(view:'map'|'satellite')=>void;places:Place[];selected:Place|null;journey:Journey|null;journeys:Journey[];routeMode:boolean;film:string;resetView:number;coverage:[number,number][];onSelect:(id:number)=>void;onRoute:(id:number)=>void;onStop:(id:number,route:number)=>void;onFilm:(title:string)=>void;onView:(ids:number[])=>void;onLocationError:(text:string)=>void};
function fogTexture(){const size=128,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*Math.PI*2,v=y/size*Math.PI*2;const cloud=Math.sin(u+Math.sin(v*2))*.35+Math.sin(u*3-v*2)*.2+Math.sin(u*5+v*7)*.08;const grain=((x*37+y*61+x*y*7)%23)/23;const n=cloud*17+grain*5;const i=(y*size+x)*4;data[i]=25+n;data[i+1]=33+n;data[i+2]=36+n;data[i+3]=255;}return {width:size,height:size,data};}
function tooltip(name:string,titles:string[]){const box=document.createElement('div');box.className='marker-tooltip';box.setAttribute('role','tooltip');const movie=document.createElement('span');movie.textContent=titles.join(' / ');const title=document.createElement('strong');title.textContent=name;box.append(movie,title);return box;}
export default function AtlasMap({basemap,onBasemap,places,selected,journey,journeys,routeMode,film,resetView,coverage,onSelect,onRoute,onStop,onFilm,onView,onLocationError}:Props){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),markers=useRef<maplibregl.Marker[]>([]),routeMarkers=useRef<maplibregl.Marker[]>([]),gps=useRef<maplibregl.GeolocateControl|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[viewVersion,setViewVersion]=useState(0),[locating,setLocating]=useState(false);
  const latest=useRef({places,coverage,onView,onLocationError,onRoute});latest.current={places,coverage,onView,onLocationError,onRoute};
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    try{
      m=new maplibregl.Map({container:container.current,style:`${import.meta.env.BASE_URL}atlas-style.json`,...CITY,minZoom:5,maxZoom:18,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,canvasContextAttributes:{antialias:true}});map.current=m;
      m.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'imperial'}),'bottom-left');
      const g=new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true,timeout:12000},fitBoundsOptions:{maxZoom:14},trackUserLocation:false,showAccuracyCircle:true,showUserLocation:true});gps.current=g;m.addControl(g,'top-right');
      g.on('geolocate',()=>setLocating(false));g.on('error',event=>{setLocating(false);latest.current.onLocationError(event.code===1?'Location access denied':event.code===3?'Location request timed out':'Location unavailable');});
      m.on('load',async()=>{
        try{
          const county=await fetch(`${import.meta.env.BASE_URL}la-county.geojson`).then(r=>{if(!r.ok)throw Error('la-county.geojson');return r.json();});
          if(map.current!==m)return;
          m.addSource('county',{type:'geojson',data:exploredCounty(county,latest.current.coverage) as any});
          m.addSource('county-fog',{type:'geojson',data:countyFog(county,latest.current.coverage) as any});
          m.addImage('unexplored-mist',fogTexture());
          m.addLayer({id:'county-fog',type:'fill',source:'county-fog',paint:{'fill-pattern':'unexplored-mist','fill-opacity':0.97}});
          m.addLayer({id:'county-haze',type:'line',source:'county',paint:{'line-color':'#263237','line-width':22,'line-blur':16,'line-opacity':0.6}});
          m.addLayer({id:'county-border',type:'line',source:'county',paint:{'line-color':'#d5d0bb','line-opacity':0.35,'line-width':0.7,'line-dasharray':[3,5]}});
        }catch{if(map.current===m)latest.current.onLocationError('County boundary unavailable');}
        if(map.current===m)setReady(true);
      });
      m.on('moveend',()=>{const b=m.getBounds();latest.current.onView(latest.current.places.filter(p=>p.coordinates&&b.contains(p.coordinates)).map(p=>p.id));setViewVersion(v=>v+1);});
      m.on('click','journey-lines',e=>{const id=Number(e.features?.[0]?.properties?.id);if(id)latest.current.onRoute(id);});
      m.on('mouseenter','journey-lines',()=>{m.getCanvas().style.cursor='pointer';});m.on('mouseleave','journey-lines',()=>{m.getCanvas().style.cursor='';});
      m.on('error',e=>{if(!m.isStyleLoaded()&&/style|fetch/i.test(e.error.message))setError(true);});
    }catch{setError(true);return;}
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{resize.disconnect();m.remove();map.current=null;gps.current=null;};
  },[]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    if(basemap==='satellite'&&!m.getSource('satellite-imagery')){
      const before=m.getLayer('county-fog')?'county-fog':undefined;
      const labels=m.getStyle().layers.filter(layer=>layer.type==='symbol'&&layer.layout?.['text-field']);
      m.addSource('satellite-imagery',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagery © <a href="https://goto.arcgisonline.com/maps/World_Imagery">Esri, Vantor, Earthstar Geographics, GIS User Community</a>'});
      m.addLayer({id:'satellite-imagery',type:'raster',source:'satellite-imagery',paint:{'raster-fade-duration':0}},before);
      for(const layer of labels)if(layer.type==='symbol')m.addLayer({...layer,id:`satellite-label-${layer.id}`,paint:{...layer.paint,'text-color':'#f5f1e5','text-halo-color':'#253035','text-halo-width':1.4}},before);
    }
    for(const layer of m.getStyle().layers)if(layer.id==='satellite-imagery'||layer.id.startsWith('satellite-label-'))m.setLayoutProperty(layer.id,'visibility',basemap==='satellite'?'visible':'none');
  },[basemap,ready]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    const bounds=m.getBounds();
    const next:maplibregl.Marker[]=[];
    for(const p of places){
      if(!p.coordinates)continue;
      const outer=document.createElement('div');outer.className=`atlas-marker ${p.category} ${selected?.id===p.id?'selected':''} ${p.placement?.kind==='inferred'?'estimated':''}`;outer.style.setProperty('--film-color',filmColor(p.appearances[0].title));
      const point=m.project(p.coordinates);const roomRight=m.getContainer().clientWidth-point.x-48,roomLeft=point.x-48;const flip=roomRight<Math.min(420,p.name.length*8)&&roomLeft>roomRight;
      if(flip)outer.classList.add('opens-left');
      const icon=document.createElement('button');icon.type='button';icon.className='marker-icon';icon.setAttribute('aria-label',`Open ${p.name}`);icon.innerHTML=locationSvg(p.category);icon.addEventListener('click',e=>{e.stopPropagation();onSelect(p.id);});outer.append(icon);
      const titles=[...new Set(p.appearances.map(a=>a.title))];outer.append(tooltip(p.name,titles));
      if(bounds.contains(p.coordinates)&&selected?.id===p.id){
        const label=document.createElement('div');label.className=`marker-label ${flip?'label-left':''}`;label.style.maxWidth=`${Math.max(150,Math.min(560,flip?roomLeft:roomRight))}px`;
        const tabs=document.createElement('div');tabs.className='marker-film-tabs';
        for(const title of titles){const tab=document.createElement('button');tab.type='button';tab.textContent=title;tab.style.setProperty('--film-color',filmColor(title));tab.setAttribute('aria-label',`Show ${title} locations`);tab.addEventListener('click',e=>{e.stopPropagation();onFilm(title);});tabs.append(tab);}
        const title=document.createElement('button');title.type='button';title.className='marker-title';title.textContent=p.name;title.addEventListener('click',e=>{e.stopPropagation();onSelect(p.id);});label.append(tabs,title);outer.append(label);
      }
      next.push(new maplibregl.Marker({element:outer,anchor:'center',offset:p.baseId?[23,20]:[0,0]}).setLngLat(p.coordinates).addTo(m));
    }
    markers.current.forEach(marker=>marker.remove());markers.current=next;
    onView(places.filter(p=>p.coordinates&&bounds.contains(p.coordinates)).map(p=>p.id));
    return()=>{next.forEach(marker=>marker.remove());};
  },[places,selected?.id,ready,viewVersion,onSelect,onFilm,onView]);
  useEffect(()=>{if(ready&&resetView)map.current?.flyTo({...CITY,duration:450});},[resetView,ready]);
  useEffect(()=>{const m=map.current;if(!ready||!m||!film)return;const bounds=new maplibregl.LngLatBounds();for(const p of latest.current.places)if(p.coordinates)bounds.extend(p.coordinates);if(!bounds.isEmpty())m.fitBounds(bounds,{padding:60,maxZoom:13,duration:450});},[film,ready]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    for(const id of ['story-area-line','story-area-fill'])if(m.getLayer(id))m.removeLayer(id);
    if(m.getSource('story-area'))m.removeSource('story-area');
    if(!selected)return;
    const color=filmColor(selected.appearances[0].title);
    if(selected.placement?.geometry){m.addSource('story-area',{type:'geojson',data:{type:'Feature',properties:{},geometry:selected.placement.geometry} as any});if(selected.placement.geometry.type==='Polygon')m.addLayer({id:'story-area-fill',type:'fill',source:'story-area',paint:{'fill-color':color,'fill-opacity':0.08}});m.addLayer({id:'story-area-line',type:'line',source:'story-area',paint:{'line-color':color,'line-width':1.7,'line-dasharray':[4,3]}});}
    if(selected.placement?.viewport)m.fitBounds(selected.placement.viewport,{padding:65,duration:450});else if(selected.coordinates)m.flyTo({center:selected.coordinates,zoom:Math.max(m.getZoom(),13),duration:450,essential:false});else m.flyTo({...CITY,duration:450});
  },[selected?.id,ready]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    routeMarkers.current.forEach(x=>x.remove());routeMarkers.current=[];
    if(m.getLayer('journey-lines'))m.removeLayer('journey-lines');if(m.getLayer('journey-casing'))m.removeLayer('journey-casing');if(m.getSource('journeys'))m.removeSource('journeys');
    const routes=journey?[journey]:routeMode?journeys:[];if(!routes.length)return;
    m.addSource('journeys',{type:'geojson',data:{type:'FeatureCollection',features:routes.map(j=>({type:'Feature',properties:{id:j.id,color:j.color||filmColor(j.title)},geometry:j.geometry||{type:'LineString',coordinates:j.stops.map(s=>s.coordinates)}}))}});
    m.addLayer({id:'journey-casing',type:'line',source:'journeys',paint:{'line-color':'#f8f2e5','line-width':7,'line-opacity':0.8}});
    m.addLayer({id:'journey-lines',type:'line',source:'journeys',paint:{'line-color':['get','color'],'line-width':3.5,'line-dasharray':[3,2]}});
    const bounds=new maplibregl.LngLatBounds();
    for(const j of routes)j.stops.forEach((s,i)=>{
      const outer=document.createElement('div');outer.className='route-stop-marker';outer.style.setProperty('--film-color',j.color||filmColor(j.title));
      const button=document.createElement('button');button.className='route-marker';button.textContent=String(i+1);button.setAttribute('aria-label',`${s.name} · ${j.title}`);button.addEventListener('click',()=>s.placeId?onStop(s.placeId,j.id):onRoute(j.id));outer.append(button,tooltip(s.name,[j.title]));
      routeMarkers.current.push(new maplibregl.Marker({element:outer,offset:selected?.id===s.placeId?[0,-27]:[0,0]}).setLngLat(s.coordinates).addTo(m));bounds.extend(s.coordinates);
    });
    if(!selected)m.fitBounds(bounds,{padding:75,maxZoom:14,duration:450});
    return()=>{routeMarkers.current.forEach(x=>x.remove());};
  },[journey?.id,journeys,routeMode,selected?.id,ready,onStop,onRoute]);
  return <div className={`map-shell ${basemap==='satellite'?'satellite-view':''}`}><div ref={container} className="map-canvas" aria-label="Map of Los Angeles"/>{!ready&&<div className="map-loading">{error?'Map unavailable':'Loading…'}</div>}
    <div className="basemap-switch" role="group" aria-label="Map view">{(['map','satellite'] as const).map(view=><button key={view} aria-pressed={basemap===view} onClick={()=>onBasemap(view)}>{view==='map'?'Map':'Satellite'}</button>)}</div>
    {selected&&!selected.coordinates&&<div className="unlocated-card" style={{'--film-color':filmColor(selected.appearances[0].title)} as React.CSSProperties}><div className="marker-film-tabs">{[...new Set(selected.appearances.map(a=>a.title))].map(t=><button key={t} style={{'--film-color':filmColor(t)} as React.CSSProperties} onClick={()=>onFilm(t)}>{t}</button>)}</div><strong>{selected.name}</strong><span>{selected.placement?.address||'Los Angeles'}</span></div>}
    <div className="north-arrow" aria-hidden="true">N<svg viewBox="0 0 32 64"><path d="M16 3 27 52 16 43 5 52Z" fill="none" stroke="currentColor"/><path d="M16 3V43L5 52Z" fill="currentColor"/></svg></div>
    <div className="map-controls"><button aria-label="My location" title="My location" className={locating?'locating':''} onClick={()=>{setLocating(true);if(!gps.current?.trigger()){setLocating(false);onLocationError('Location unavailable');}}}><Crosshair size={19}/></button><button aria-label="Return to city view" title="Los Angeles" onClick={()=>map.current?.flyTo({...CITY,duration:450})}><LocateFixed size={18}/></button><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={19}/></button></div>
  </div>;
}
