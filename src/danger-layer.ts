import type {GeoJSONSource,HeatmapLayerSpecification,Map as AtlasMap} from 'maplibre-gl';
import {displayEntries} from './logic.mjs';
import {knownDeathCount} from './death-counts.mjs';
import type {Place,TimeFilter} from './types';

type Filters={film?:string;time?:TimeFilter;laOnly?:boolean};
export function deathHeatmapData(places:Place[],{film='',time,laOnly=false}:Filters={}){
  const sites=new Map<string,{coordinates:[number,number];weight:number}>();
  // Group totals come from the sourced count audit, rather than parsing victim labels.
  for(const entry of displayEntries(places,{film,time,laOnly,category:'death'})){
    const coordinates=entry.coordinates as [number,number]|null;
    if(!coordinates||!coordinates.every(Number.isFinite))continue;
    const key=coordinates.join(','),weight=Math.max(1,(entry.deaths||[]).reduce((sum:number,death:any)=>sum+knownDeathCount(death),0)),site=sites.get(key);
    if(site)site.weight+=weight;else sites.set(key,{coordinates:[...coordinates],weight});
  }
  // The render source contains no names, titles or spoiler text.
  return {type:'FeatureCollection' as const,features:[...sites.values()].map(({coordinates,weight})=>({
    type:'Feature' as const,properties:{weight},geometry:{type:'Point' as const,coordinates},
  }))};
}
export type DangerData=ReturnType<typeof deathHeatmapData>;
const sourceId='danger-scenes',layerId='danger-heatmap';

export function dangerLayerStyle():HeatmapLayerSpecification{
  return {id:layerId,type:'heatmap',source:sourceId,paint:{
    'heatmap-weight':['get','weight'],
    'heatmap-intensity':['interpolate',['linear'],['zoom'],7,.7,11,1,16,1.15],
    'heatmap-radius':['interpolate',['linear'],['zoom'],7,12,9,24,11,52,13,100,16,180,18,230],
    'heatmap-opacity':.72,
    'heatmap-color':['interpolate',['linear'],['heatmap-density'],
      0,'rgba(238,179,77,0)',.12,'rgba(238,179,77,0.22)',.3,'#eeb34d',.55,'#df7133',.78,'#b93628',1,'#721d2a'],
  }};
}

export function installDangerLayer(map:AtlasMap){
  let disposed=false,lastData:DangerData|null=null;
  return {
    update({enabled,data,basemap}:{enabled:boolean;data:DangerData|null;basemap:'map'|'satellite'}){
      if(disposed)return;
      if(enabled&&data&&!map.getSource(sourceId)){
        map.addSource(sourceId,{type:'geojson',data});
        map.addLayer(dangerLayerStyle(),map.getLayer('county-fog')?'county-fog':undefined);
        lastData=data;
      }
      if(!map.getLayer(layerId))return;
      if(enabled&&data&&data!==lastData){(map.getSource(sourceId) as GeoJSONSource).setData(data);lastData=data;}
      map.setLayoutProperty(layerId,'visibility',enabled?'visible':'none');
      // Satellite tiles sit above the paper map; keep heat above them, below labels and fog.
      const layers=map.getStyle().layers,raster=basemap==='satellite'?layers.findIndex(l=>l.id==='satellite-imagery'):-1;
      const before=layers.slice(raster+1).find(l=>l.id!==layerId&&(l.type==='symbol'||l.id.startsWith('reference-')||l.id==='county-fog'))?.id;
      map.moveLayer(layerId,before);
    },
    destroy(){
      disposed=true;
      if(map.getLayer(layerId))map.removeLayer(layerId);
      if(map.getSource(sourceId))map.removeSource(sourceId);
      lastData=null;
    },
  };
}
