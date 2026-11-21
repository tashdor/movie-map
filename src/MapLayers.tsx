import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Layers} from 'lucide-react';
import {locationTypes,selectedTypes,toggleCategory} from './location-layers.mjs';
import {locationSvg} from './icons';
import type {ReferenceLayer} from './reference-layers';
import {sideTipPlacement} from './side-tip.mjs';

export type MovieLayerControls={category:string;laOnly:boolean;showSpoilers:boolean;onCategory:(value:string)=>void;onLaOnly:(enabled:boolean)=>void;onSpoilers:(enabled:boolean)=>void};
type Props=MovieLayerControls&{neighborhoods:boolean;landmarks:boolean;prices:boolean;danger:boolean;onOverlay:(layer:ReferenceLayer|'prices'|'danger',enabled:boolean)=>void;menuRef:RefObject<HTMLDetailsElement|null>};

export default function MapLayers({category,laOnly,showSpoilers,onCategory,onLaOnly,onSpoilers,neighborhoods,landmarks,prices,danger,onOverlay,menuRef}:Props){
  const selected=selectedTypes(category);
  const laStoriesHint="Only stories set in Los Angeles County. Hides local filming sites set elsewhere, and unconfirmed L.A. settings.";
  const hintAnchor=useRef<HTMLLabelElement>(null),hint=useRef<HTMLSpanElement>(null);
  const [hintHover,setHintHover]=useState(false),[hintFocus,setHintFocus]=useState(false);
  const [hintPosition,setHintPosition]=useState<{left:number;top:number;width:number}|null>(null);
  const hintOpen=hintHover||hintFocus;
  const closeHint=()=>{setHintHover(false);setHintFocus(false);};
  useLayoutEffect(()=>{
    if(!hintOpen)return;
    const placeHint=()=>{
      const menu=menuRef.current?.querySelector('.reference-options');
      if(!menu||!hintAnchor.current||!menuRef.current?.open)return;
      setHintPosition(sideTipPlacement(hintAnchor.current.getBoundingClientRect(),menu.getBoundingClientRect(),{width:window.innerWidth,height:window.innerHeight},hint.current?.offsetHeight||110));
    };
    placeHint();window.addEventListener('resize',placeHint);window.addEventListener('scroll',placeHint,true);
    return()=>{window.removeEventListener('resize',placeHint);window.removeEventListener('scroll',placeHint,true);};
  },[hintOpen,hintPosition?.width,menuRef]);
  return <div className="reference-control" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeHint();if(menuRef.current)menuRef.current.open=false;menuRef.current?.querySelector('summary')?.focus();}}}>
    <details className="layer-menu" ref={menuRef} onToggle={e=>{if(!e.currentTarget.open)closeHint();}}>
      <summary aria-label="Map layers"><Layers size={14}/>Layers</summary>
      <div className="reference-options">
        <div className="location-layers" role="group" aria-label="Location types">
          <label className="all-location-layers"><input type="checkbox" checked={category==='all'} ref={input=>{if(input)input.indeterminate=selected.length>0&&selected.length<locationTypes.length;}} onChange={e=>onCategory(e.target.checked?'all':'none')}/>All locations</label>
          {locationTypes.map(([id,label])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>onCategory(toggleCategory(category,id,e.target.checked))}/><span className="layer-glyph" aria-hidden="true" dangerouslySetInnerHTML={{__html:locationSvg(id)}}/>{label}</label>)}
        </div>
        <label className="layer-setting" ref={hintAnchor} onPointerEnter={e=>{if(e.pointerType!=='touch')setHintHover(true);}} onPointerLeave={()=>setHintHover(false)} onFocus={()=>setHintFocus(true)} onBlur={()=>setHintFocus(false)}><input type="checkbox" aria-label="L.A. stories only" aria-description={laStoriesHint} aria-describedby={hintOpen?'la-stories-hint':undefined} checked={laOnly} onChange={e=>onLaOnly(e.target.checked)}/>L.A. stories only</label>
        <div className="reference-geography">
          <label><input type="checkbox" checked={neighborhoods} onChange={e=>onOverlay('neighborhoods',e.target.checked)}/>Neighborhoods</label>
          <label><input type="checkbox" checked={landmarks} onChange={e=>onOverlay('landmarks',e.target.checked)}/>Landmarks</label>
          <label><input type="checkbox" checked={prices} onChange={e=>onOverlay('prices',e.target.checked)}/>House prices</label>
          <label className="danger-layer-choice"><input type="checkbox" checked={danger} onChange={e=>onOverlay('danger',e.target.checked)}/>Danger heatmap</label>
        </div>
      </div>
    </details>
    <label className="spoiler-toggle"><input type="checkbox" checked={showSpoilers} onChange={e=>onSpoilers(e.target.checked)}/>Spoilers</label>
    {hintOpen&&createPortal(<span ref={hint} className="layer-setting-tip" id="la-stories-hint" role="tooltip" style={{...hintPosition,visibility:hintPosition?'visible':'hidden'}}>{laStoriesHint}</span>,document.body)}
  </div>;
}
