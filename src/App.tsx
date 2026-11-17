import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronDown,ExternalLink,MapPin,Pause,Play,Route,Search,Share2,SlidersHorizontal,Users,X} from 'lucide-react';
import AtlasMap from './AtlasMap';
import raw from './data/atlas.json';
import {displayEntries,readState,stateHash,timeLabel,selectPlace,backState} from './logic.mjs';
import {filmColor} from './colors';
import {locationSvg} from './icons';
import type {AtlasData,AtlasState,Photo,PhotoPair,Place,TimeFilter} from './types';
const data=raw as unknown as AtlasData;
const coverage=data.places.flatMap(p=>p.coordinates?[p.coordinates]:[]);
const categories=[['all','All'],['home','Homes'],['work','Work'],['hangout','Hangouts'],['event','Events'],['death','Deaths']];
const photoUrl=(p:Photo)=>`${import.meta.env.BASE_URL}${p.src.replace(/^\/?(?:public\/)?/,'')}`;
const occupants=(p:Place)=>[...new Set(p.appearances.flatMap(a=>a.characters?.map(c=>c.name)||p.people))];
const ink=(title:string)=>({'--film-color':filmColor(title)} as React.CSSProperties);
function Glyph({type}:{type:string}){return <span className="inline-glyph" dangerouslySetInnerHTML={{__html:locationSvg(type)}}/>;}
function Pictures({media,name,onOpen}:{media?:PhotoPair;name:string;onOpen:(p:Photo)=>void}){
  if(!media)return null;
  return <div className="photo-pair">{(['screen','place'] as const).map(kind=>{const p=media[kind];return p?<figure key={kind}><button aria-label={`Enlarge ${kind==='screen'?'screen image':'filming-site photo'} of ${name}`} onClick={()=>onOpen(p)}><img src={photoUrl(p)} alt={p.alt||(kind==='screen'?`${name} on screen`:`Filming site for ${name}`)} loading="lazy"/></button><figcaption>{kind==='screen'?(p.title||'On screen'):(p.caption||'Filming site')}{p.date&&<span>{p.date}</span>}</figcaption></figure>:null;})}</div>;
}
function Timeline({time,onChange}:{time:TimeFilter;onChange:(v:TimeFilter)=>void}){
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{if(time.all)setPlaying(false);},[time.all]);
  useEffect(()=>{if(!playing)return;const timer=window.setInterval(()=>onChange({...time,all:false,from:time.from>=2020?1930:time.from+1,to:time.from>=2020?1939:Math.min(2030,time.to+1)}),1100);return()=>clearInterval(timer);},[playing,time,onChange]);
  const range=(from:number,to:number)=>{setPlaying(false);onChange({...time,from,to,all:from===1930&&to===2030});};
  return <section className="timeline" aria-label="Story date range"><div className="time-heading"><strong>{time.all?'All time':time.from===time.to?time.from:<>{time.from}<span>—</span>{time.to}</>}</strong><button aria-label={playing?'Pause timeline':'Play timeline'} onClick={()=>{if(time.all)onChange({...time,all:false,from:1930,to:1939});setPlaying(!playing);}}>{playing?<Pause size={16}/>:<Play size={16}/>}</button></div><div className="time-ruler"><div className="range-track"><div className="range-selection" style={{left:`${time.all?0:time.from-1930}%`,right:`${time.all?0:2030-time.to}%`}}/><input aria-label="Start year" type="range" min="1930" max="2030" value={time.all?1930:time.from} onChange={e=>range(Math.min(+e.target.value,time.to),time.to)}/><input aria-label="End year" type="range" min="1930" max="2030" value={time.all?2030:time.to} onChange={e=>range(time.from,Math.max(time.from,+e.target.value))}/></div><div className="ruler-ticks">{[1930,1940,1950,1960,1970,1980,1990,2000,2010,2020,2030].map(y=><span key={y}>{y%20===10?y:''}</span>)}</div></div><div className="time-presets"><button className={time.all?'chosen':''} onClick={()=>{setPlaying(false);onChange({...time,all:true,from:1930,to:2030});}}>All time</button>{[1930,1980,1990,2010].map(y=><button key={y} className={!time.all&&time.from===y&&time.to===y+9?'chosen':''} onClick={()=>range(y,y+9)}>{y}s</button>)}</div></section>;
}
export default function App(){
  const [state,setState]=useState<AtlasState>(()=>readState(location.hash) as AtlasState);
  const [mapReset,setMapReset]=useState(0);
  const [effectiveTime,setEffectiveTime]=useState(state.time),[nearbyOnly,setNearbyOnly]=useState(false),[viewIds,setViewIds]=useState<number[]>([]),[filtersOpen,setFiltersOpen]=useState(false),[mobileOpen,setMobileOpen]=useState(()=>Boolean(state.selected||state.route||state.person)),[toast,setToast]=useState(''),[photo,setPhoto]=useState<Photo|null>(null);
  const scroll=useRef<HTMLDivElement>(null),photoDialog=useRef<HTMLDialogElement>(null);
  const update=(patch:Partial<AtlasState>)=>setState(s=>({...s,...patch}));
  const select=useCallback((id:number)=>{setState(s=>selectPlace(s,id));setMobileOpen(true);},[]);
  const selectFilm=useCallback((film:string)=>{setState(s=>({...s,film,query:'',category:'all',selected:null,route:null,person:null,tab:'places'}));if(!film)setMapReset(v=>v+1);},[]);
  const selectRoute=useCallback((id:number)=>{setState(s=>({...s,route:id,selected:null,person:null,tab:'journeys'}));setMobileOpen(true);},[]);
  const selectStop=useCallback((id:number,route:number)=>{setState(s=>({...s,route,selected:id,person:null,tab:'journeys'}));setMobileOpen(true);},[]);
  const selectPerson=(name:string)=>{update({person:name,selected:null,route:null,query:'',category:'all',tab:'people'});setMobileOpen(true);};
  const back=()=>setState(s=>backState(s));
  const setTime=useCallback((time:TimeFilter)=>setState(s=>({...s,time})),[]);
  const onView=useCallback((ids:number[])=>setViewIds(old=>old.length===ids.length&&old.every((id,i)=>id===ids[i])?old:ids),[]),notify=useCallback((message:string)=>setToast(message),[]);
  useEffect(()=>{const timer=setTimeout(()=>setEffectiveTime(state.time),80);return()=>clearTimeout(timer);},[state.time]);
  useEffect(()=>{const timer=setTimeout(()=>{const hash=stateHash(state);if(hash!==location.hash)try{history.replaceState(null,'',location.pathname+location.search+hash);}catch{/* Browser history limits must not unmount the atlas. */}},250);return()=>clearTimeout(timer);},[state]);
  useEffect(()=>{const f=()=>setState(readState(location.hash) as AtlasState);addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f);},[]);
  useEffect(()=>{scroll.current?.scrollTo({top:0});},[state.selected,state.route,state.person,state.tab]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2800);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{if(photo&&!photoDialog.current?.open)photoDialog.current?.showModal();else if(!photo)photoDialog.current?.close();},[photo]);
  useEffect(()=>{const f=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(photoDialog.current?.open){setPhoto(null);return;}setState(s=>backState(s));}};addEventListener('keydown',f);return()=>removeEventListener('keydown',f);},[]);
  const films=useMemo(()=>[...new Set(data.places.flatMap(p=>p.appearances.map(a=>a.title)))].sort(),[]);
  const entries=useMemo(()=>displayEntries(data.places,{query:state.query,category:state.category,film:state.film,time:effectiveTime}) as Place[],[state.query,state.category,state.film,effectiveTime]);
  const lookup=useMemo(()=>displayEntries(data.places,{film:state.film,time:effectiveTime}) as Place[],[state.film,effectiveTime]);
  const visible=useMemo(()=>[...entries].sort((a,b)=>Number(b.featured)-Number(a.featured)||Math.abs(a.id)-Math.abs(b.id)||b.id-a.id),[entries]);
  const selected=lookup.find(p=>p.id===state.selected)||null;
  const list=nearbyOnly?visible.filter(p=>viewIds.includes(p.id)):visible;
  const people=useMemo(()=>{const found=new Map<string,Place[]>();for(const p of list)for(const name of occupants(p))found.set(name,[...(found.get(name)||[]),p]);const all=[...found].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));const q=state.query.toLowerCase().trim();const names=q?all.filter(([n])=>n.toLowerCase().includes(q)):all;return names.length?names:all;},[list,state.query]);
  const personPlaces=state.person?lookup.filter(p=>occupants(p).includes(state.person!)):[];
  const journeys=useMemo(()=>data.journeys.filter(j=>(effectiveTime.all||j.year!==null&&j.year>=effectiveTime.from&&j.year<=effectiveTime.to||j.year===null&&effectiveTime.undated)&&(!state.film||j.title===state.film)&&(!state.query||`${j.name} ${j.title}`.toLowerCase().includes(state.query.toLowerCase()))),[effectiveTime,state.film,state.query]);
  const journey=journeys.find(j=>j.id===state.route)||null;
  const mapPlaces=state.person?personPlaces:state.tab==='journeys'?(selected?[selected]:[]):visible;
  const hasFilters=Boolean(state.film||state.query||state.category!=='all'||!state.time.all||nearbyOnly||state.person);
  const reset=()=>{setState({selected:null,route:null,person:null,query:'',category:'all',film:'',tab:'places',time:{all:true,from:1930,to:2030,undated:false}});setNearbyOnly(false);setMapReset(v=>v+1);};
  const share=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+location.search+stateHash(state));setToast('Link copied');}catch{setToast('Copy the address-bar link');}};
  const sources=(p:Place)=>{const ids=new Set([...p.appearances.flatMap(a=>[...a.source_ids,...(a.story_time?.source_ids||[])]),...(p.placement?.sourceIds||[])]);return data.sources.filter(s=>ids.has(s.id));};
  const filmTabs=(p:Place)=><div className="place-films">{[...new Set(p.appearances.map(a=>a.title))].map(t=><button style={ink(t)} key={t} aria-label={`Show ${t} locations`} onClick={()=>selectFilm(t)}>{t}<ArrowRight size={12}/></button>)}</div>;
  const row=(p:Place)=><button key={p.id} style={ink(p.appearances[0].title)} className="directory-row" onClick={()=>select(p.id)}><Glyph type={p.category}/><span><strong>{p.name}</strong><small>{[...new Set(p.appearances.map(a=>a.title))].join(' / ')}</small></span><ArrowRight size={13}/></button>;
  const noResults=state.tab==='people'?!people.length:state.tab==='journeys'?!journeys.length:!list.length;
  return <div className="atlas-app"><header className="masthead"><button className="wordmark" aria-label="Reset atlas" onClick={reset}><span>LOS ANGELES <i>✦</i></span><strong>OTHERWISE.</strong></button><button className="share-button" aria-label="Share atlas" onClick={share}><Share2 size={18}/></button></header>
    <div className="atlas-workspace"><aside className={`directory ${mobileOpen?'mobile-open':''}`} aria-label="Directory"><div className="search-wrap"><Search size={17}/><input aria-label="Search" placeholder="Search" value={state.query} onChange={e=>{update({query:e.target.value,selected:null,route:null,person:null});setMobileOpen(true);}}/></div><nav className="directory-tabs" aria-label="Browse">{[['places','Places',MapPin],['people','People',Users],['journeys','Routes',Route]].map(([tab,title,Icon])=><button key={String(tab)} className={state.tab===tab?'active':''} onClick={()=>update({tab:String(tab),selected:null,route:null,person:null})}>{typeof Icon!=='string'&&<Icon size={15}/>}<span>{String(title)}</span></button>)}</nav>
      <div className="filter-bar"><select aria-label="Film or series" value={state.film} onChange={e=>selectFilm(e.target.value)}><option value="">All films & series</option>{films.map(f=><option key={f}>{f}</option>)}</select><button aria-label="More filters" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15}/></button>{hasFilters&&<button className="show-all" onClick={reset}>Show all</button>}</div>
      {filtersOpen&&<div className="extra-filters"><label><input type="checkbox" checked={nearbyOnly} onChange={e=>setNearbyOnly(e.target.checked)}/>In map view</label><label><input type="checkbox" checked={state.time.undated} onChange={e=>setTime({...state.time,undated:e.target.checked})}/>Undated</label></div>}
      <div className="directory-scroll" ref={scroll}>
      {selected?<div className="place-detail"><button className="back-button" aria-label={state.route?'Back to route':state.person?'Back to person':state.tab==='people'?'Back to people':state.tab==='journeys'?'Back to routes':'Back to places'} onClick={back}><ArrowLeft size={17}/></button><h1>{selected.name}</h1>{filmTabs(selected)}<div className="place-address">{selected.placement?.address||selected.area}</div><Pictures media={selected.media} name={selected.name} onOpen={setPhoto}/>
        <div className="people-at">{occupants(selected).map(n=><button key={n} onClick={()=>selectPerson(n)}><span>{n}</span><ArrowRight size={13}/></button>)}</div>
        <div className="appearance-list">{selected.appearances.map((a,i)=><div className="appearance" key={a.title+i}><span>{timeLabel(a)}</span><div>{a.story_role}<small>{a.title}{a.episodes?' · '+a.episodes.join(' / '):''}</small></div></div>)}</div>
        {!!selected.deaths?.length&&<div className="deaths-list">{selected.deaths.map(d=><div style={ink(d.title)} key={d.title}><Glyph type="death"/><span>{d.people.join(', ')}</span></div>)}</div>}
        <details className="source-notes"><summary>Sources<ChevronDown size={13}/></summary>{selected.placement&&<p>{selected.placement.address}</p>}{selected.placement?.reason&&<p>{selected.placement.reason}</p>}<p>Filming site<br/>{selected.address}<br/>{selected.area}</p><ul>{sources(selected).map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}<ExternalLink size={11}/></a></li>)}</ul>{selected.media&&<ul>{[selected.media.screen,selected.media.place].filter(Boolean).map((p,i)=><li key={i}><a href={p!.sourceUrl} target="_blank" rel="noreferrer">{p!.credit}{p!.date?' · '+p!.date:''}<ExternalLink size={11}/></a>{p!.license?.startsWith('http')&&<a href={p!.license} target="_blank" rel="noreferrer">License</a>}{p!.note&&<span>{p!.note}</span>}</li>)}</ul>}{selected.media?.note&&<p>{selected.media.note}</p>}</details>
      </div>:state.person?<div className="person-detail"><button className="back-button" aria-label="Back to people" onClick={back}><ArrowLeft size={17}/></button><h1>{state.person}</h1><div className="person-locations">{personPlaces.map(row)}</div></div>:journey?<div className="journey-detail" style={{'--film-color':journey.color||filmColor(journey.title)} as React.CSSProperties}><button className="back-button" aria-label="Back to routes" onClick={back}><ArrowLeft size={17}/></button><h1>{journey.name}</h1><button className="single-film-tab" style={ink(journey.title)} onClick={()=>selectFilm(journey.title)}>{journey.title}<ArrowRight size={12}/></button><div className="journey-date">{journey.year||''}</div><ol className="journey-stops">{journey.stops.map((s,i)=>{const p=data.places.find(p=>p.id===s.placeId);return <li key={i}><button disabled={!s.placeId} onClick={()=>s.placeId&&selectStop(s.placeId,journey.id)}><span>{i+1}</span>{s.name}{s.placeId&&<ArrowRight size={13}/>}</button>{p?.media&&<Pictures media={p.media} name={s.name} onOpen={setPhoto}/>}</li>;})}</ol><details className="source-notes"><summary>Sources<ChevronDown size={13}/></summary>{journey.precision&&<p>{journey.precision}</p>}<ul>{data.sources.filter(s=>journey.source_ids.includes(s.id)).map(s=><li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></details></div>:<>
        {state.tab==='places'&&<div className="category-filters">{categories.map(([id,label])=><button key={id} aria-label={label} className={state.category===id?'active':''} onClick={()=>update({category:id})}>{id!=='all'&&<Glyph type={id}/>}<span>{label}</span></button>)}</div>}
        {state.tab==='places'&&<div className="place-list">{list.map(row)}</div>}
        {state.tab==='people'&&<div className="resident-list">{people.map(([name])=><button className="person-row" key={name} onClick={()=>selectPerson(name)}><span>{name}</span><ArrowRight size={14}/></button>)}</div>}
        {state.tab==='journeys'&&<div className="journey-list">{journeys.map(j=><button style={{'--film-color':j.color||filmColor(j.title)} as React.CSSProperties} key={j.id} onClick={()=>selectRoute(j.id)}><Route size={21}/><span><strong>{j.name}</strong><small>{j.title}</small></span><ArrowRight size={14}/></button>)}</div>}
        {noResults&&<div className="empty-state">No matches</div>}
      </>}
      </div><button className="mobile-map-return" onClick={()=>setMobileOpen(false)}>Map<MapPin size={15}/></button>
    </aside><main className="map-and-time"><div className="map-region"><AtlasMap places={mapPlaces} selected={selected} journey={journey} journeys={journeys} routeMode={state.tab==='journeys'} film={state.film} coverage={coverage} resetView={mapReset} onSelect={select} onRoute={selectRoute} onStop={selectStop} onFilm={selectFilm} onView={onView} onLocationError={notify}/><button className="mobile-directory-toggle" onClick={()=>setMobileOpen(true)}><Search size={17}/>Places</button></div><Timeline time={state.time} onChange={setTime}/></main></div>
    {toast&&<div className="toast" role="status"><Check size={14}/>{toast}</div>}
    <dialog className="photo-dialog" ref={photoDialog} aria-label="Location photo" onClose={()=>setPhoto(null)} onClick={e=>{if(e.target===photoDialog.current)setPhoto(null);}}><button className="photo-close" aria-label="Close photo" onClick={()=>setPhoto(null)}><X size={22}/></button>{photo&&<><img src={photoUrl(photo)} alt={photo.alt||photo.note||'Location photograph'}/><a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.credit}{photo.date?' · '+photo.date:''}<ExternalLink size={12}/></a></>}</dialog>
  </div>;
}
