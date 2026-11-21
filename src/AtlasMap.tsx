import {memo,useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Crosshair,LocateFixed,Minus,Plus} from 'lucide-react';
import {locationSvg} from './icons';
import {filmColor} from './colors';
import {filmTitle} from './films.mjs';
import {installCountyFog} from './fog';
import {installReferenceLayers,type ReferenceLayer} from './reference-layers';
import {installPriceMarkers} from './price-markers';
import {installDangerLayer,type DangerData} from './danger-layer';
import {selectedTypes} from './location-layers.mjs';
import MapLayers,{type MovieLayerControls} from './MapLayers';
import {countyCamera} from './camera.mjs';
import {markerSites} from './marker-sites.mjs';
import {storySettingLabel,journeyStopGroups} from './logic.mjs';
import {accessibleText} from './spoilers.mjs';
import {appendRedactedText,RedactedText} from './RedactedText';
import type {Place,Journey} from './types';
maplibregl.setWorkerUrl(workerUrl);
const ZERO_PADDING={top:0,bottom:0,left:0,right:0};
const CITY={center:[-118.325,34.055] as [number,number],zoom:10.55};
type Props=MovieLayerControls&{neighborhoods:boolean;landmarks:boolean;prices:boolean;danger:boolean;dangerData:DangerData|null;onOverlay:(layer:ReferenceLayer|'prices'|'danger',enabled:boolean)=>void;basemap:'map'|'satellite';onBasemap:(view:'map'|'satellite')=>void;places:Place[];selected:Place|null;journey:Journey|null;journeys:Journey[];routeMode:boolean;film:string;resetView:number;trackView:boolean;coverage:[number,number][];onSelect:(id:number)=>void;onRoute:(id:number)=>void;onStop:(id:number,route:number)=>void;onFilm:(title:string)=>void;onView:(ids:number[])=>void;onLocationError:(text:string)=>void};
type MarkerRecord={marker:maplibregl.Marker;element:HTMLDivElement;place:Place;signature:string;label?:HTMLDivElement;members:Place[];badge?:HTMLButtonElement;chooser?:HTMLDivElement};
function closeSite(record:MarkerRecord){if(!record.chooser)return;record.chooser.remove();record.chooser=undefined;record.element.classList.remove('site-open');record.badge?.setAttribute('aria-expanded','false');if(record.label)record.label.hidden=false;}
function openSite(map:maplibregl.Map,record:MarkerRecord,onSelect:(id:number)=>void){
  if(record.chooser){closeSite(record);return;}
  const chooser=document.createElement('div');chooser.className='marker-site-choices';chooser.setAttribute('role','group');chooser.setAttribute('aria-label','Locations at this spot');
  for(const place of record.members){
    const button=document.createElement('button');button.type='button';button.style.setProperty('--film-color',filmColor(place.appearances[0].title));
    const name=document.createElement('strong');appendRedactedText(name,place.name);
    const films=document.createElement('small');films.textContent=[...new Set(place.appearances.map(a=>filmTitle(a.title)))].join(' / ');
    button.append(name,films);button.addEventListener('click',e=>{e.stopPropagation();closeSite(record);onSelect(place.id);});chooser.append(button);
  }
  record.chooser=chooser;map.getContainer().parentElement?.append(chooser);record.element.classList.add('site-open');record.badge?.setAttribute('aria-expanded','true');alignMarker(map,record);
  chooser.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();closeSite(record);record.element.querySelector<HTMLButtonElement>('.marker-icon')?.focus({preventScroll:true});}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();e.stopPropagation();const buttons=[...chooser.querySelectorAll('button')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus({preventScroll:true});
    }
  });
  chooser.querySelector('button')?.focus({preventScroll:true});
}
function alignMarker(map:maplibregl.Map,record:MarkerRecord){
  if(!record.place.coordinates)return;
  const point=map.project(record.place.coordinates),right=map.getContainer().clientWidth-point.x-48,left=point.x-48;
  const flip=right<Math.min(420,record.place.name.length*8)&&left>right;
  record.element.classList.toggle('opens-left',flip);
  const available=Math.max(150,Math.min(560,flip?left:right));
  if(record.label){record.label.classList.toggle('label-left',flip);record.label.style.maxWidth=`${available}px`;record.label.hidden=!!record.chooser||!map.getBounds().contains(record.place.coordinates);}
  if(record.chooser){
    const {clientWidth:width,clientHeight:height}=map.getContainer(),menuWidth=Math.min(310,width-28),bottom=height-point.y-20,above=bottom<240&&point.y>bottom;
    Object.assign(record.chooser.style,{width:`${menuWidth}px`,left:`${Math.max(14,Math.min(width-menuWidth-14,flip?point.x-menuWidth-22:point.x+22))}px`,top:above?'auto':`${point.y-15}px`,bottom:above?`${height-point.y-15}px`:'auto',maxHeight:`${Math.max(80,Math.min(320,above?point.y-20:bottom))}px`});
  }
}
function tooltip(name:string,titles:string[],setting?:Place['storySetting']){const box=document.createElement('div');box.className='marker-tooltip';box.setAttribute('role','tooltip');const movie=document.createElement('span');movie.textContent=titles.map(filmTitle).join(' / ');const title=document.createElement('strong');appendRedactedText(title,name);box.append(movie,title);if(setting?.canonicalLA===false){const tag=document.createElement('small');tag.className='marker-setting';tag.textContent=storySettingLabel(setting,true);box.append(tag);}return box;}
function AtlasMap({category,laOnly,showSpoilers,onCategory,onLaOnly,onSpoilers,neighborhoods,landmarks,prices,danger,dangerData,onOverlay,basemap,onBasemap,places,selected,journey,journeys,routeMode,film,resetView,trackView,coverage,onSelect,onRoute,onStop,onFilm,onView,onLocationError}:Props){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),markers=useRef(new Map<number,MarkerRecord>()),routeMarkers=useRef<maplibregl.Marker[]>([]),gps=useRef<maplibregl.GeolocateControl|null>(null),northNeedle=useRef<HTMLSpanElement>(null);
  const references=useRef<ReturnType<typeof installReferenceLayers>|null>(null),layerMenu=useRef<HTMLDetailsElement>(null);
  const dangerLayer=useRef<ReturnType<typeof installDangerLayer>|null>(null);
  const priceMarkers=useRef<ReturnType<typeof installPriceMarkers>|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(false),[locating,setLocating]=useState(false);
  const [zoomedOut,setZoomedOut]=useState(false);
  const latest=useRef({places,selected,trackView,coverage,onView,onLocationError,onRoute,onSelect,onFilm});latest.current={places,selected,trackView,coverage,onView,onLocationError,onRoute,onSelect,onFilm};
  const syncView=useRef(()=>{}),baseLayers=useRef(new Map<string,'visible'|'none'>());
  syncView.current=()=>{const m=map.current;if(!m)return;const current=latest.current;for(const record of markers.current.values())if(record.chooser||record.place.id===current.selected?.id)alignMarker(m,record);if(current.trackView){const bounds=m.getBounds();current.onView(current.places.filter(p=>p.coordinates&&bounds.contains(p.coordinates)).map(p=>p.id));}};
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    let disposeFog:(()=>void)|undefined;
    let countyData:any,countyView:ReturnType<typeof countyCamera>=null,applyingLimit=false;
    const atMinimum=()=>m.getZoom()<=m.getMinZoom()+0.00001;
    const syncZoomButton=()=>setZoomedOut(atMinimum());
    const syncNorth=()=>{if(northNeedle.current)northNeedle.current.style.transform=`rotate(${-m.getBearing()}deg)`;};
    const updateZoomLimit=()=>{
      if(!countyData)return;
      const element=m.getContainer(),view=countyCamera(countyData,latest.current.coverage,{width:element.clientWidth,height:element.clientHeight,bearing:m.getBearing()});
      if(!view)return;
      const wasAtMinimum=atMinimum();countyView=view;applyingLimit=true;
      m.setMinZoom(view.zoom);
      if(wasAtMinimum||atMinimum())m.jumpTo({...view,padding:ZERO_PADDING});
      applyingLimit=false;syncZoomButton();
    };
    const centerCountyAtMinimum=()=>{
      if(applyingLimit||!countyView||!atMinimum()||m.isRotating())return;
      const center=m.getCenter(),target=countyView.center;
      if(Math.abs(center.lng-target[0])+Math.abs(center.lat-target[1])<0.0000001)return;
      applyingLimit=true;m.jumpTo({center:target,zoom:countyView.zoom,padding:ZERO_PADDING});applyingLimit=false;
    };
    try{
      m=new maplibregl.Map({container:container.current,style:`${import.meta.env.BASE_URL}atlas-style.json`,...CITY,minZoom:5,maxZoom:18,maxPitch:0,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,canvasContextAttributes:{antialias:true}});map.current=m;
      m.on('rotate',syncNorth);m.on('rotateend',updateZoomLimit);m.on('resize',updateZoomLimit);m.on('zoom',syncZoomButton);m.on('zoomend',centerCountyAtMinimum);syncNorth();syncZoomButton();
      m.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'imperial'}),'bottom-left');
      const g=new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true,timeout:12000},fitBoundsOptions:{maxZoom:14},trackUserLocation:false,showAccuracyCircle:true,showUserLocation:true});gps.current=g;m.addControl(g,'top-right');
      g.on('geolocate',()=>setLocating(false));g.on('error',event=>{setLocating(false);latest.current.onLocationError(event.code===1?'Location access denied':event.code===3?'Location request timed out':'Location unavailable');});
      m.on('load',async()=>{
        baseLayers.current=new Map(m.getStyle().layers.map(layer=>[layer.id,layer.layout?.visibility==='none'?'none':'visible']));
        try{
          const county=await fetch(`${import.meta.env.BASE_URL}la-county.geojson`).then(r=>{if(!r.ok)throw Error('la-county.geojson');return r.json();});
          if(map.current!==m)return;
          countyData=county;updateZoomLimit();
          disposeFog=installCountyFog(m,county,latest.current.coverage);
        }catch{if(map.current===m)latest.current.onLocationError('County boundary unavailable');}
        if(map.current===m){dangerLayer.current=installDangerLayer(m);priceMarkers.current=installPriceMarkers(m,id=>latest.current.onSelect(id));references.current=installReferenceLayers(m,{baseUrl:import.meta.env.BASE_URL,onError:message=>latest.current.onLocationError(message)});setReady(true);}
      });
      m.on('moveend',()=>syncView.current());
      m.on('click',()=>{if(layerMenu.current)layerMenu.current.open=false;for(const record of markers.current.values())closeSite(record);});
      m.on('click','journey-lines',e=>{const id=Number(e.features?.[0]?.properties?.id);if(id)latest.current.onRoute(id);});
      m.on('mouseenter','journey-lines',()=>{m.getCanvas().style.cursor='pointer';});m.on('mouseleave','journey-lines',()=>{m.getCanvas().style.cursor='';});
      m.on('error',e=>{if(!m.isStyleLoaded()&&/style|fetch/i.test(e.error.message))setError(true);});
    }catch{setError(true);return;}
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{resize.disconnect();m.off('rotate',syncNorth);m.off('rotateend',updateZoomLimit);m.off('resize',updateZoomLimit);m.off('zoom',syncZoomButton);m.off('zoomend',centerCountyAtMinimum);dangerLayer.current?.destroy();dangerLayer.current=null;priceMarkers.current?.destroy();priceMarkers.current=null;references.current?.destroy();references.current=null;disposeFog?.();for(const record of markers.current.values()){closeSite(record);record.marker.remove();}markers.current.clear();m.remove();map.current=null;gps.current=null;};
  },[]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    if(basemap==='satellite'&&!m.getSource('satellite-imagery')){
      const before=m.getLayer('county-fog')?'county-fog':undefined;
      const labels=m.getStyle().layers.filter(layer=>baseLayers.current.has(layer.id)&&layer.type==='symbol'&&layer.layout?.['text-field']);
      m.addSource('satellite-imagery',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagery © <a href="https://goto.arcgisonline.com/maps/World_Imagery">Esri, Vantor, Earthstar Geographics, GIS User Community</a>'});
      m.addLayer({id:'satellite-imagery',type:'raster',source:'satellite-imagery',paint:{'raster-fade-duration':0}},before);
      for(const layer of labels)if(layer.type==='symbol')m.addLayer({...layer,id:`satellite-label-${layer.id}`,paint:{...layer.paint,'text-color':'#f5f1e5','text-halo-color':'#253035','text-halo-width':1.4}},before);
    }
    for(const [id,visibility] of baseLayers.current)if(m.getLayer(id))m.setLayoutProperty(id,'visibility',basemap==='satellite'?'none':visibility);
    for(const layer of m.getStyle().layers)if(layer.id==='satellite-imagery'||layer.id.startsWith('satellite-label-'))m.setLayoutProperty(layer.id,'visibility',basemap==='satellite'?'visible':'none');
  },[basemap,ready]);
  useEffect(()=>{if(ready)references.current?.update({neighborhoods,landmarks,basemap});},[ready,neighborhoods,landmarks,basemap]);
  useEffect(()=>{if(ready)dangerLayer.current?.update({enabled:danger,data:dangerData,basemap});},[ready,danger,dangerData,basemap]);
  useEffect(()=>{references.current?.closePopup();},[selected?.id,journey?.id,film]);
  useEffect(()=>{if(ready)priceMarkers.current?.update({enabled:prices&&selectedTypes(category).includes('home'),places,selectedId:selected?.id||null});},[ready,prices,category,places,selected?.id]);
  useEffect(()=>{
    const m=map.current;if(!ready||!m)return;
    const active=new Set<number>();
    const showSite=(record:MarkerRecord)=>{for(const other of markers.current.values())if(other!==record)closeSite(other);openSite(m,record,id=>latest.current.onSelect(id));};
    const sites=markerSites(places,selected?.id),siteById=new Map<number,{primary:Place;members:Place[];choices:Place[]}>();
    for(const site of sites)for(const member of site.members)siteById.set(member.id,site);
    for(const p of places){
      if(!p.coordinates)continue;active.add(p.id);
      const titles=[...new Set(p.appearances.map(a=>a.title))];
      const signature=JSON.stringify([p.name,p.category,p.placement?.kind,titles,p.storySetting]);
      let record=markers.current.get(p.id);
      if(!record){
        const element=document.createElement('div');element.className='atlas-marker';
        const marker=new maplibregl.Marker({element,anchor:'center',offset:[0,0],subpixelPositioning:true}).setLngLat(p.coordinates).addTo(m);
        record={marker,element,place:p,signature:'',members:[p]};markers.current.set(p.id,record);
        const current=record;element.addEventListener('mouseenter',()=>alignMarker(m,current));element.addEventListener('focusin',()=>alignMarker(m,current));
        element.addEventListener('keydown',e=>{if(e.key==='Escape'&&current.chooser){e.stopPropagation();closeSite(current);element.querySelector<HTMLButtonElement>('.marker-icon')?.focus({preventScroll:true});}});
      }
      closeSite(record);record.badge?.remove();record.badge=undefined;
      if(record.signature!==signature){
        record.element.classList.remove(record.place.category);record.element.classList.add(p.category);
        record.element.classList.toggle('estimated',p.placement?.kind==='inferred');
        record.element.style.setProperty('--film-color',filmColor(p.appearances[0].title));
        const current=record,icon=document.createElement('button');icon.type='button';icon.className='marker-icon';icon.setAttribute('aria-label',`Open ${accessibleText(p.name)}`);icon.innerHTML=locationSvg(p.category);icon.addEventListener('click',e=>{e.stopPropagation();if(current.members.length>1)showSite(current);else latest.current.onSelect(p.id);});
        record.element.replaceChildren(icon,tooltip(p.name,titles,p.storySetting));record.label=undefined;record.signature=signature;
      }
      const position=record.marker.getLngLat();if(position.lng!==p.coordinates[0]||position.lat!==p.coordinates[1])record.marker.setLngLat(p.coordinates);
      record.place=p;record.element.classList.toggle('selected',selected?.id===p.id);
      const site=siteById.get(p.id)!;record.members=site.choices;record.element.hidden=site.primary.id!==p.id;
      if(record.members.length>1&&!record.element.hidden&&(!p.isDeath||record.members.every(member=>member.isDeath))){
        const current=record,badge=document.createElement('button');badge.type='button';badge.className='marker-site-count';badge.textContent=String(record.members.length);badge.setAttribute('aria-label',`Choose among ${record.members.length} locations at this spot`);badge.setAttribute('aria-expanded','false');badge.addEventListener('click',e=>{e.stopPropagation();showSite(current);});record.element.append(badge);record.badge=badge;
      }
      if(selected?.id===p.id&&!record.label){
        const label=document.createElement('div');label.className='marker-label';
        const tabs=document.createElement('div');tabs.className='marker-film-tabs';
        for(const title of titles){const tab=document.createElement('button');tab.type='button';tab.textContent=filmTitle(title);tab.style.setProperty('--film-color',filmColor(title));tab.setAttribute('aria-label',`Show ${title} locations`);tab.addEventListener('click',()=>latest.current.onFilm(title));tabs.append(tab);}
        const title=document.createElement('button');title.type='button';title.className='marker-title';appendRedactedText(title,p.name);title.addEventListener('click',()=>latest.current.onSelect(p.id));label.append(tabs,title);if(p.storySetting?.canonicalLA===false){const tag=document.createElement('span');tag.className='marker-setting';tag.textContent=storySettingLabel(p.storySetting,true);label.append(tag);}record.element.append(label);record.label=label;
      }else if(selected?.id!==p.id&&record.label){record.label.remove();record.label=undefined;}
      if(record.label)alignMarker(m,record);
    }
    for(const [id,record] of markers.current)if(!active.has(id)){closeSite(record);record.marker.remove();markers.current.delete(id);}
    syncView.current();
  },[places,selected?.id,trackView,ready]);
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
    for(const j of routes)journeyStopGroups(j).forEach(s=>{
      const outer=document.createElement('div');outer.className='route-stop-marker'+(s.numbers.length>1?' repeated-stop':'');outer.style.setProperty('--film-color',j.color||filmColor(j.title));
      const button=document.createElement('button');button.className='route-marker'+(s.numbers.length>1?' repeated-stop':'');button.textContent=s.numbers.join('·');button.setAttribute('aria-label',`${accessibleText(s.name)} · Stops ${s.numbers.join(', ')} · ${filmTitle(j.title)}`);button.addEventListener('click',()=>s.placeId?onStop(s.placeId,j.id):onRoute(j.id));outer.append(button,tooltip(s.name,[j.title]));
      routeMarkers.current.push(new maplibregl.Marker({element:outer,anchor:'center',offset:[0,0],subpixelPositioning:true}).setLngLat(s.coordinates).addTo(m));bounds.extend(s.coordinates);
    });
    if(!selected)m.fitBounds(bounds,{padding:75,maxZoom:14,duration:450});
    return()=>{routeMarkers.current.forEach(x=>x.remove());};
  },[journey?.id,journeys,routeMode,selected?.id,ready,onStop,onRoute]);
  return <div className={`map-shell ${basemap==='satellite'?'satellite-view':''}`}><div ref={container} className="map-canvas" aria-label="Map of Los Angeles"/>{!ready&&<div className="map-loading">{error?'Map unavailable':'Loading…'}</div>}
    <div className="basemap-switch" role="group" aria-label="Map view">{(['map','satellite'] as const).map(view=><button key={view} aria-pressed={basemap===view} onClick={()=>onBasemap(view)}>{view==='map'?'Map':'Satellite'}</button>)}</div>
    <MapLayers danger={danger} prices={prices} menuRef={layerMenu} category={category} laOnly={laOnly} showSpoilers={showSpoilers} onCategory={onCategory} onLaOnly={onLaOnly} onSpoilers={onSpoilers} neighborhoods={neighborhoods} landmarks={landmarks} onOverlay={onOverlay}/>
    {danger&&<div className="danger-legend" role="img" aria-label="Known death concentration, amber for low to dark red for high"><span>Death hotspots</span><div className="danger-gradient"/><div className="danger-scale"><span>Low</span><span>High</span></div></div>}
    {selected&&!selected.coordinates&&<div className="unlocated-card" style={{'--film-color':filmColor(selected.appearances[0].title)} as React.CSSProperties}><div className="marker-film-tabs">{[...new Set(selected.appearances.map(a=>a.title))].map(t=><button key={t} style={{'--film-color':filmColor(t)} as React.CSSProperties} onClick={()=>onFilm(t)}>{filmTitle(t)}</button>)}</div><strong><RedactedText text={selected.name}/></strong><span><RedactedText text={selected.placement?.address||'Los Angeles'}/></span></div>}
    <button className="north-arrow" aria-label="Reset north" title="Reset north" onClick={()=>map.current?.resetNorth({duration:450})}><span className="north-needle" ref={northNeedle} aria-hidden="true">N<svg viewBox="0 0 32 64"><path d="M16 3 27 52 16 43 5 52Z" fill="none" stroke="currentColor"/><path d="M16 3V43L5 52Z" fill="currentColor"/></svg></span></button>
    <div className="map-controls"><button aria-label="My location" title="My location" className={locating?'locating':''} onClick={()=>{setLocating(true);if(!gps.current?.trigger()){setLocating(false);onLocationError('Location unavailable');}}}><Crosshair size={19}/></button><button aria-label="Return to city view" title="Los Angeles" onClick={()=>map.current?.flyTo({...CITY,duration:450})}><LocateFixed size={18}/></button><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" disabled={!ready||zoomedOut} onClick={()=>map.current?.zoomOut()}><Minus size={19}/></button></div>
  </div>;
}

export default memo(AtlasMap);
