import type {RefObject} from 'react';
import {Layers} from 'lucide-react';
import {locationTypes,selectedTypes,toggleCategory} from './location-layers.mjs';
import {locationSvg} from './icons';
import type {ReferenceLayer} from './reference-layers';

export type MovieLayerControls={category:string;laOnly:boolean;showSpoilers:boolean;onCategory:(value:string)=>void;onLaOnly:(enabled:boolean)=>void;onSpoilers:(enabled:boolean)=>void};
type Props=MovieLayerControls&{neighborhoods:boolean;landmarks:boolean;prices:boolean;danger:boolean;onOverlay:(layer:ReferenceLayer|'prices'|'danger',enabled:boolean)=>void;menuRef:RefObject<HTMLDetailsElement|null>};

export default function MapLayers({category,laOnly,showSpoilers,onCategory,onLaOnly,onSpoilers,neighborhoods,landmarks,prices,danger,onOverlay,menuRef}:Props){
  const selected=selectedTypes(category);
  return <div className="reference-control" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(menuRef.current)menuRef.current.open=false;menuRef.current?.querySelector('summary')?.focus();}}}>
    <details className="layer-menu" ref={menuRef}>
      <summary aria-label="Map layers"><Layers size={14}/>Layers</summary>
      <div className="reference-options">
        <div className="location-layers" role="group" aria-label="Location types">
          <label className="all-location-layers"><input type="checkbox" checked={category==='all'} ref={input=>{if(input)input.indeterminate=selected.length>0&&selected.length<locationTypes.length;}} onChange={e=>onCategory(e.target.checked?'all':'none')}/>All locations</label>
          {locationTypes.map(([id,label])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>onCategory(toggleCategory(category,id,e.target.checked))}/><span className="layer-glyph" aria-hidden="true" dangerouslySetInnerHTML={{__html:locationSvg(id)}}/>{label}</label>)}
        </div>
        <label className="layer-setting"><input type="checkbox" checked={laOnly} onChange={e=>onLaOnly(e.target.checked)}/>L.A. stories only</label>
        <div className="reference-geography">
          <label><input type="checkbox" checked={neighborhoods} onChange={e=>onOverlay('neighborhoods',e.target.checked)}/>Neighborhoods</label>
          <label><input type="checkbox" checked={landmarks} onChange={e=>onOverlay('landmarks',e.target.checked)}/>Landmarks</label>
          <label><input type="checkbox" checked={prices} onChange={e=>onOverlay('prices',e.target.checked)}/>House prices</label>
          <label className="danger-layer-choice"><input type="checkbox" checked={danger} onChange={e=>onOverlay('danger',e.target.checked)}/>Danger heatmap</label>
        </div>
      </div>
    </details>
    <label className="spoiler-toggle"><input type="checkbox" checked={showSpoilers} onChange={e=>onSpoilers(e.target.checked)}/>Spoilers</label>
  </div>;
}
