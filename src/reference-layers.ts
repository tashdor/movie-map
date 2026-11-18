import {Popup,type Map as AtlasMap,type MapLayerMouseEvent} from 'maplibre-gl';
import {landmarkLinks} from './reference-overlays.mjs';

export type ReferenceLayer='neighborhoods'|'landmarks';
type Settings={neighborhoods:boolean;landmarks:boolean;basemap:'map'|'satellite'};
type Options={baseUrl:string;onError:(message:string)=>void;fetcher?:typeof fetch};
const ids={
  neighborhoods:['reference-neighborhood-fill','reference-neighborhood-lines','reference-neighborhood-labels'],
  landmarks:['reference-landmark-hit','reference-landmark-points','reference-landmark-labels'],
};
const hitLayers=ids.landmarks;
const neighborhoodCredit='Neighborhoods: <a href="https://maps.latimes.com/neighborhoods/">Los Angeles Times · Mapping L.A.</a> (<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>; normalized)';

export function installReferenceLayers(map:AtlasMap,{baseUrl,onError,fetcher=fetch}:Options){
  let settings:Settings={neighborhoods:false,landmarks:false,basemap:'map'},disposed=false,popup:Popup|undefined;
  const pending=new Map<ReferenceLayer,Promise<void>>();
  const nativeNeighborhoodVisibility=map.getLayer('label_other')&&map.getLayoutProperty('label_other','visibility')==='none'?'none':'visible';
  const sourceId=(kind:ReferenceLayer)=>`reference-${kind}`;
  const beforeFog=()=>map.getLayer('county-fog')?'county-fog':undefined;
  const closePopup=()=>{popup?.remove();popup=undefined;};

  function sync(){
    if(disposed)return;
    const satellite=settings.basemap==='satellite';
    for(const id of ['label_other','satellite-label-label_other'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',!settings.neighborhoods&&(id.startsWith('satellite-')===satellite)?nativeNeighborhoodVisibility:'none');
    for(const kind of ['neighborhoods','landmarks'] as const)for(const id of ids[kind])if(map.getLayer(id)){
      map.setLayoutProperty(id,'visibility',settings[kind]?'visible':'none');
      // Keep reference ink above either basemap and underneath the county mask.
      map.moveLayer(id,beforeFog());
    }
    if(map.getLayer(ids.neighborhoods[0])){
      map.setPaintProperty(ids.neighborhoods[0],'fill-color',satellite?'#e8dfbe':'#727960');
      map.setPaintProperty(ids.neighborhoods[0],'fill-opacity',satellite?.025:.035);
      map.setPaintProperty(ids.neighborhoods[1],'line-color',satellite?'#e8dfbe':'#6b725e');
      map.setPaintProperty(ids.neighborhoods[2],'text-color',satellite?'#fff4ce':'#60684f');
      map.setPaintProperty(ids.neighborhoods[2],'text-halo-color',satellite?'#202a28':'#f4f0e4');
    }
    if(map.getLayer(ids.landmarks[1])){
      map.setPaintProperty(ids.landmarks[1],'circle-color',satellite?'#fff1c8':'#f4f0e4');
      map.setPaintProperty(ids.landmarks[1],'circle-stroke-color',satellite?'#202b30':'#455b62');
      map.setPaintProperty(ids.landmarks[2],'text-color',satellite?'#fff1c8':'#455b62');
      map.setPaintProperty(ids.landmarks[2],'text-halo-color',satellite?'#202b30':'#f4f0e4');
    }
  }

  function load(kind:ReferenceLayer){
    if(pending.has(kind))return pending.get(kind);
    const request=(async()=>{
      const response=await fetcher(`${baseUrl}la-${kind}.geojson`);
      if(!response.ok)throw Error(kind);
      const data=await response.json();
      if(disposed)return;
      map.addSource(sourceId(kind),{type:'geojson',data,...(kind==='neighborhoods'?{attribution:neighborhoodCredit}:{})});
      if(kind==='neighborhoods'){
        map.addLayer({id:ids.neighborhoods[0],type:'fill',source:sourceId(kind),paint:{'fill-color':'#727960','fill-opacity':.035}},beforeFog());
        map.addLayer({id:ids.neighborhoods[1],type:'line',source:sourceId(kind),paint:{'line-color':'#6b725e','line-opacity':.65,'line-width':['interpolate',['linear'],['zoom'],8,.55,13,1.1,18,1.6],'line-dasharray':[3,2]}},beforeFog());
        map.addLayer({id:ids.neighborhoods[2],type:'symbol',source:sourceId(kind),minzoom:9.5,layout:{'text-field':['get','name'],'text-font':['Noto Sans Italic'],'text-size':['interpolate',['linear'],['zoom'],10,11,15,14],'text-transform':'uppercase','text-letter-spacing':.12,'text-max-width':12,'text-padding':7},paint:{'text-color':'#60684f','text-halo-color':'#f4f0e4','text-halo-width':1.8}},beforeFog());
      }else{
        map.addLayer({id:ids.landmarks[0],type:'circle',source:sourceId(kind),paint:{'circle-radius':12,'circle-opacity':0}},beforeFog());
        map.addLayer({id:ids.landmarks[1],type:'circle',source:sourceId(kind),paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,2.5,12,4,16,5],'circle-color':'#f4f0e4','circle-stroke-color':'#455b62','circle-stroke-width':1.4}},beforeFog());
        map.addLayer({id:ids.landmarks[2],type:'symbol',source:sourceId(kind),minzoom:10,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],10,10,14,12],'text-anchor':'left','text-offset':[1.5,0],'text-max-width':15,'text-padding':3},paint:{'text-color':'#455b62','text-halo-color':'#f4f0e4','text-halo-width':1.7}},beforeFog());
      }
      sync();
    })().catch(()=>{if(!disposed)onError(`${kind==='neighborhoods'?'Neighborhoods':'Landmarks'} unavailable`);});
    pending.set(kind,request);return request;
  }

  function showLandmark(event:MapLayerMouseEvent){
    if(!settings.landmarks)return;
    const feature=event.features?.[0];if(!feature||feature.geometry.type!=='Point')return;
    const properties=feature.properties,links=landmarkLinks(properties),content=document.createElement('section');
    content.className='landmark-details';content.setAttribute('aria-label','L.A. landmark');
    const category=document.createElement('small');category.textContent=properties.category;
    const title=document.createElement('h2');title.textContent=properties.name;
    const address=document.createElement('p');address.textContent=properties.address;
    const navigation=document.createElement('nav');navigation.setAttribute('aria-label','Landmark links');
    for(const [label,url] of [['Official website',links.website],['Google Maps',links.maps]] as const)if(url){
      const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noreferrer';navigation.append(link);
    }
    content.append(category,title,address,navigation);closePopup();
    popup=new Popup({className:'reference-popup',maxWidth:'280px',offset:10}).setLngLat(feature.geometry.coordinates as [number,number]).setDOMContent(content).addTo(map);
  }
  const pointer=()=>{if(settings.landmarks)map.getCanvas().style.cursor='pointer';};
  const unpointer=()=>{map.getCanvas().style.cursor='';};
  map.on('click',hitLayers,showLandmark);map.on('mouseenter',hitLayers,pointer);map.on('mouseleave',hitLayers,unpointer);

  return {
    update(next:Settings){settings=next;if(!next.landmarks){closePopup();unpointer();}for(const kind of ['neighborhoods','landmarks'] as const)if(next[kind])void load(kind);sync();},
    closePopup,
    destroy(){settings={...settings,neighborhoods:false,landmarks:false};sync();disposed=true;closePopup();unpointer();map.off('click',hitLayers,showLandmark);map.off('mouseenter',hitLayers,pointer);map.off('mouseleave',hitLayers,unpointer);for(const id of [...ids.neighborhoods,...ids.landmarks].reverse())if(map.getLayer(id))map.removeLayer(id);for(const kind of ['neighborhoods','landmarks'] as const)if(map.getSource(sourceId(kind)))map.removeSource(sourceId(kind));},
  };
}
